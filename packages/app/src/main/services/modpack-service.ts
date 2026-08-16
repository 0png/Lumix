import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import extract from 'extract-zip';
import { downloadFile } from './http-client';
import type {
  CoreType,
  ModpackCandidateDto,
  ModpackContentSummary,
  ModpackInstallProgressEvent,
  ModpackWarning,
} from '../../shared/ipc-types';
import { IpcErrorCode, createIpcError, formatIpcError } from '../../shared/ipc-types';

const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 16 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 100_000;
const PACK_ROOT_SEARCH_DEPTH = 2;
const RESERVED_ROOT_FILES = new Set(['server.json', 'eula.txt', 'run.bat', 'forge-config.json', 'loader-config.json']);

interface ModrinthFile {
  path: string;
  hashes?: { sha1?: string; sha512?: string };
  env?: { client?: string; server?: string };
  downloads: string[];
  fileSize?: number;
}

interface ModrinthIndex {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  summary?: string;
  files: ModrinthFile[];
  dependencies: Record<string, string>;
}

interface CurseForgeManifest {
  manifestType: string;
  manifestVersion: number;
  name: string;
  version?: string;
  author?: string;
  overrides?: string;
  minecraft: {
    version: string;
    modLoaders?: Array<{ id: string; primary?: boolean }>;
  };
  files?: Array<{ projectID: number; fileID: number; required?: boolean }>;
}

interface ParsedModpack {
  candidate: ModpackCandidateDto;
  root: string;
  modrinthFiles: ModrinthFile[];
  overrideDirectories: string[];
}

export interface InstallModpackOptions {
  allowIncomplete?: boolean;
  onProgress?: (event: ModpackInstallProgressEvent) => void;
}

export interface InstallModpackFilesResult {
  installedFiles: number;
  skippedClientOnlyFiles: number;
  unresolvedFiles: number;
  warnings: ModpackWarning[];
}

export class ModpackService {
  async scan(archivePath: string): Promise<ModpackCandidateDto> {
    return this.withExtractedArchive(archivePath, async (root) => {
      const parsed = await this.parseExtractedPack(root, archivePath);
      return parsed.candidate;
    });
  }

  async install(
    archivePath: string,
    targetDir: string,
    options: InstallModpackOptions = {}
  ): Promise<InstallModpackFilesResult> {
    return this.withExtractedArchive(archivePath, async (root) => {
      const parsed = await this.parseExtractedPack(root, archivePath);
      if (!parsed.candidate.canInstall && !options.allowIncomplete) {
        throw this.error(
          IpcErrorCode.MODPACK_INCOMPLETE,
          '模組包含有無法自動取得的必要檔案，請確認警告後再決定是否繼續'
        );
      }

      const downloadableFiles = parsed.modrinthFiles.filter((file) => file.env?.server !== 'unsupported');
      let completed = 0;
      const total = downloadableFiles.length + parsed.candidate.includedFiles;
      options.onProgress?.(this.progress('files', completed, total, '正在下載伺服器端模組與資源'));

      for (const file of downloadableFiles) {
        const destination = resolveSafeDestination(targetDir, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await this.downloadIndexedFile(file, destination);
        completed += 1;
        options.onProgress?.(this.progress('files', completed, total, `已安裝 ${file.path}`));
      }

      options.onProgress?.(this.progress('overrides', completed, total, '正在載入設定檔與伺服器覆寫內容'));
      for (const overrideDirectory of parsed.overrideDirectories) {
        const source = path.join(parsed.root, overrideDirectory);
        if (await exists(source)) {
          completed += await copyDirectorySafely(source, targetDir, () => {
            options.onProgress?.(this.progress('overrides', completed + 1, total, '正在載入模組包設定'));
          });
        }
      }

      return {
        installedFiles: completed,
        skippedClientOnlyFiles: parsed.candidate.clientOnlyFiles,
        unresolvedFiles: parsed.candidate.unresolvedFiles,
        warnings: parsed.candidate.warnings,
      };
    });
  }

  private async withExtractedArchive<T>(archivePath: string, action: (root: string) => Promise<T>): Promise<T> {
    const resolvedArchive = path.resolve(archivePath);
    const extension = path.extname(resolvedArchive).toLowerCase();
    if (extension !== '.mrpack' && extension !== '.zip') {
      throw this.error(IpcErrorCode.MODPACK_INVALID_ARCHIVE, '請選擇 .mrpack 或 .zip 模組包');
    }

    const stat = await fs.stat(resolvedArchive).catch(() => null);
    if (!stat?.isFile()) {
      throw this.error(IpcErrorCode.MODPACK_INVALID_ARCHIVE, '找不到指定的模組包檔案');
    }
    if (stat.size > MAX_ARCHIVE_BYTES) {
      throw this.error(IpcErrorCode.MODPACK_INVALID_ARCHIVE, '模組包超過 4 GB 安全限制');
    }

    const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-modpack-'));
    try {
      let extractedBytes = 0;
      let entryCount = 0;
      await extract(resolvedArchive, {
        dir: stagingDir,
        onEntry: (entry) => {
          entryCount += 1;
          extractedBytes += entry.uncompressedSize;
          if (entryCount > MAX_ARCHIVE_ENTRIES || extractedBytes > MAX_EXTRACTED_BYTES) {
            throw this.error(IpcErrorCode.MODPACK_INVALID_ARCHIVE, '模組包解壓後超過安全限制');
          }
        },
      });
      const root = await findPackRoot(stagingDir);
      return await action(root);
    } catch (error) {
      if (error instanceof Error && /^[A-Z_]+:/.test(error.message)) throw error;
      throw this.error(
        IpcErrorCode.MODPACK_INVALID_ARCHIVE,
        `無法解析模組包：${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async parseExtractedPack(root: string, archivePath: string): Promise<ParsedModpack> {
    const modrinthIndexPath = path.join(root, 'modrinth.index.json');
    if (await exists(modrinthIndexPath)) {
      return this.parseModrinth(root, archivePath, modrinthIndexPath);
    }

    const curseForgeManifestPath = path.join(root, 'manifest.json');
    if (await exists(curseForgeManifestPath)) {
      return this.parseCurseForge(root, archivePath, curseForgeManifestPath);
    }

    throw this.error(
      IpcErrorCode.MODPACK_UNSUPPORTED_FORMAT,
      '找不到 modrinth.index.json 或 CurseForge manifest.json'
    );
  }

  private async parseModrinth(root: string, archivePath: string, indexPath: string): Promise<ParsedModpack> {
    const index = await readJson<ModrinthIndex>(indexPath);
    if (index.game !== 'minecraft' || !Array.isArray(index.files) || !index.dependencies?.minecraft) {
      throw this.error(IpcErrorCode.MODPACK_INVALID_ARCHIVE, 'Modrinth 索引缺少必要欄位');
    }

    const loader = detectModrinthLoader(index.dependencies);
    const serverFiles = index.files.filter((file) => file.env?.server !== 'unsupported');
    const reservedFiles = serverFiles.filter((file) => isReservedTargetPath(file.path));
    const supportedFiles = serverFiles.filter((file) => !isReservedTargetPath(file.path));
    const clientOnlyFiles = index.files.length - serverFiles.length;
    const overrideDirectories = ['overrides', 'server-overrides'];
    const allIncludedPaths = await listOverrideFiles(root, overrideDirectories);
    const includedPaths = allIncludedPaths.filter((filePath) => !isReservedTargetPath(filePath));
    const warnings: ModpackWarning[] = [];

    if (!loader.coreType) {
      warnings.push(loader.warning ?? { code: 'missingLoader' });
    }
    if (clientOnlyFiles > 0) {
      warnings.push({ code: 'clientOnlyFiles', count: clientOnlyFiles });
    }
    const reservedCount = reservedFiles.length + (allIncludedPaths.length - includedPaths.length);
    if (reservedCount > 0) {
      warnings.push({ code: 'reservedFiles', count: reservedCount });
    }

    return {
      root,
      modrinthFiles: supportedFiles,
      overrideDirectories,
      candidate: {
        archivePath: path.resolve(archivePath),
        format: 'modrinth',
        name: index.name || path.basename(archivePath, path.extname(archivePath)),
        version: index.versionId,
        mcVersion: index.dependencies.minecraft,
        coreType: loader.coreType,
        loaderVersion: loader.version,
        downloadableFiles: supportedFiles.length,
        includedFiles: includedPaths.length,
        clientOnlyFiles,
        unresolvedFiles: 0,
        content: summarizeContent([...supportedFiles.map((file) => file.path), ...includedPaths]),
        warnings,
        canInstall: Boolean(loader.coreType),
      },
    };
  }

  private async parseCurseForge(root: string, archivePath: string, manifestPath: string): Promise<ParsedModpack> {
    const manifest = await readJson<CurseForgeManifest>(manifestPath);
    if (manifest.manifestType !== 'minecraftModpack' || !manifest.minecraft?.version) {
      throw this.error(IpcErrorCode.MODPACK_INVALID_ARCHIVE, 'CurseForge manifest 缺少必要欄位');
    }

    const loader = detectCurseForgeLoader(manifest.minecraft.modLoaders ?? []);
    const overrideDirectory = normalizeRelativePath(manifest.overrides || 'overrides');
    const overrideDirectories = [overrideDirectory];
    const allIncludedPaths = await listOverrideFiles(root, overrideDirectories);
    const includedPaths = allIncludedPaths.filter((filePath) => !isReservedTargetPath(filePath));
    const unresolvedFiles = manifest.files?.length ?? 0;
    const warnings: ModpackWarning[] = [];

    if (!loader.coreType) {
      warnings.push(loader.warning ?? { code: 'missingLoader' });
    }
    if (unresolvedFiles > 0) {
      warnings.push({ code: 'curseForgeAuth', count: unresolvedFiles });
    }
    if (allIncludedPaths.length !== includedPaths.length) {
      warnings.push({ code: 'reservedFiles', count: allIncludedPaths.length - includedPaths.length });
    }

    return {
      root,
      modrinthFiles: [],
      overrideDirectories,
      candidate: {
        archivePath: path.resolve(archivePath),
        format: 'curseforge',
        name: manifest.name || path.basename(archivePath, path.extname(archivePath)),
        version: manifest.version,
        mcVersion: manifest.minecraft.version,
        coreType: loader.coreType,
        loaderVersion: loader.version,
        downloadableFiles: 0,
        includedFiles: includedPaths.length,
        clientOnlyFiles: 0,
        unresolvedFiles,
        content: summarizeContent(includedPaths),
        warnings,
        canInstall: Boolean(loader.coreType) && unresolvedFiles === 0,
      },
    };
  }

  private async downloadIndexedFile(file: ModrinthFile, destination: string): Promise<void> {
    const urls = file.downloads.filter(isSecureDownloadUrl);
    if (urls.length === 0) {
      throw this.error(IpcErrorCode.MODPACK_INSTALL_FAILED, `檔案 ${file.path} 沒有安全的下載來源`);
    }

    let lastError: unknown;
    for (const url of urls) {
      try {
        await downloadFile(url, destination, file.fileSize ?? 0);
        await verifyFileHash(destination, file.hashes);
        return;
      } catch (error) {
        lastError = error;
        await fs.rm(destination, { force: true }).catch(() => {});
      }
    }

    throw this.error(
      IpcErrorCode.MODPACK_INSTALL_FAILED,
      `下載 ${file.path} 失敗：${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  private progress(
    stage: ModpackInstallProgressEvent['stage'],
    completed: number,
    total: number,
    message: string
  ): ModpackInstallProgressEvent {
    return {
      stage,
      completed,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0,
      message,
    };
  }

  private error(code: Parameters<typeof createIpcError>[0], message: string): Error {
    return new Error(formatIpcError(createIpcError(code, message)));
  }
}

function detectModrinthLoader(dependencies: Record<string, string>): {
  coreType?: Extract<CoreType, 'fabric' | 'forge' | 'neoforge'>;
  version?: string;
  warning?: ModpackWarning;
} {
  if (dependencies['fabric-loader']) return { coreType: 'fabric', version: dependencies['fabric-loader'] };
  if (dependencies.forge) return { coreType: 'forge', version: dependencies.forge };
  if (dependencies.neoforge) return { coreType: 'neoforge', version: dependencies.neoforge };
  if (dependencies['quilt-loader']) return { version: dependencies['quilt-loader'], warning: { code: 'unsupportedLoader', loader: 'Quilt' } };
  return { warning: { code: 'missingLoader' } };
}

function detectCurseForgeLoader(loaders: Array<{ id: string; primary?: boolean }>): {
  coreType?: Extract<CoreType, 'fabric' | 'forge' | 'neoforge'>;
  version?: string;
  warning?: ModpackWarning;
} {
  const selected = loaders.find((loader) => loader.primary) ?? loaders[0];
  if (!selected) return { warning: { code: 'missingLoader' } };
  const separator = selected.id.indexOf('-');
  const name = (separator >= 0 ? selected.id.slice(0, separator) : selected.id).toLowerCase();
  const version = separator >= 0 ? selected.id.slice(separator + 1) : undefined;
  if (name === 'fabric') return { coreType: 'fabric', version };
  if (name === 'forge') return { coreType: 'forge', version };
  if (name === 'neoforge') return { coreType: 'neoforge', version };
  return { version, warning: { code: 'unsupportedLoader', loader: name } };
}

async function findPackRoot(stagingDir: string): Promise<string> {
  let candidates = [stagingDir];
  for (let depth = 0; depth <= PACK_ROOT_SEARCH_DEPTH; depth += 1) {
    for (const candidate of candidates) {
      if (await exists(path.join(candidate, 'modrinth.index.json')) || await exists(path.join(candidate, 'manifest.json'))) {
        return candidate;
      }
    }
    const next: string[] = [];
    for (const candidate of candidates) {
      const entries = await fs.readdir(candidate, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isDirectory()) next.push(path.join(candidate, entry.name));
      }
    }
    candidates = next;
  }
  return stagingDir;
}

async function listOverrideFiles(root: string, directories: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const directory of directories) {
    const source = path.join(root, directory);
    await walkRegularFiles(source, async (absolutePath) => {
      result.push(path.relative(source, absolutePath).replace(/\\/g, '/'));
    });
  }
  return result;
}

async function copyDirectorySafely(source: string, target: string, onFile?: () => void): Promise<number> {
  let copied = 0;
  await walkRegularFiles(source, async (absolutePath) => {
    const relativePath = path.relative(source, absolutePath);
    if (isReservedTargetPath(relativePath)) return;
    const destination = resolveSafeDestination(target, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(absolutePath, destination);
    copied += 1;
    onFile?.();
  });
  return copied;
}

async function walkRegularFiles(root: string, visitor: (absolutePath: string) => Promise<void>): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walkRegularFiles(absolutePath, visitor);
    } else if (entry.isFile()) {
      await visitor(absolutePath);
    }
  }
}

export function resolveSafeDestination(targetDir: string, relativePath: string): string {
  const normalizedRelative = normalizeRelativePath(relativePath);
  const targetRoot = path.resolve(targetDir);
  const destination = path.resolve(targetRoot, normalizedRelative);
  const rootPrefix = `${targetRoot}${path.sep}`.toLowerCase();
  if (destination.toLowerCase() !== targetRoot.toLowerCase() && !destination.toLowerCase().startsWith(rootPrefix)) {
    throw new Error(formatIpcError(createIpcError(
      IpcErrorCode.MODPACK_INVALID_ARCHIVE,
      `模組包包含不安全的路徑：${relativePath}`
    )));
  }
  return destination;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized) ||
    segments.some((segment) => segment === '..' || segment === '')
  ) {
    throw new Error(formatIpcError(createIpcError(
      IpcErrorCode.MODPACK_INVALID_ARCHIVE,
      `模組包包含不安全的路徑：${relativePath}`
    )));
  }
  return normalized;
}

function summarizeContent(paths: string[]): ModpackContentSummary {
  const summary: ModpackContentSummary = { mods: 0, configs: 0, scripts: 0, resourcePacks: 0, other: 0 };
  for (const filePath of paths) {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    if (normalized.startsWith('mods/')) summary.mods += 1;
    else if (normalized.startsWith('config/') || normalized.startsWith('defaultconfigs/')) summary.configs += 1;
    else if (normalized.startsWith('scripts/') || normalized.startsWith('kubejs/')) summary.scripts += 1;
    else if (normalized.startsWith('resourcepacks/')) summary.resourcePacks += 1;
    else summary.other += 1;
  }
  return summary;
}

function isReservedTargetPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  const segments = normalized.split('/');
  return segments[0] === '.lumix-backups' || (segments.length === 1 && RESERVED_ROOT_FILES.has(normalized));
}

async function verifyFileHash(filePath: string, hashes?: ModrinthFile['hashes']): Promise<void> {
  const algorithm = hashes?.sha512 ? 'sha512' : hashes?.sha1 ? 'sha1' : undefined;
  const expected = algorithm === 'sha512' ? hashes?.sha512 : hashes?.sha1;
  if (!algorithm || !expected) return;
  const content = await fs.readFile(filePath);
  const actual = createHash(algorithm).update(content).digest('hex');
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`HASH_MISMATCH: ${path.basename(filePath)} 檔案驗證失敗`);
  }
}

function isSecureDownloadUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(formatIpcError(createIpcError(
      IpcErrorCode.MODPACK_INVALID_ARCHIVE,
      `${path.basename(filePath)} 不是有效的 JSON`
    )));
  }
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true).catch(() => false);
}
