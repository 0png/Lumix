import { promises as fs } from 'fs';
import path from 'path';
import type { CoreType, ImportCandidateDto } from '../../shared/ipc-types';

const WORLD_DIR_CANDIDATES = ['world', 'world_nether', 'world_the_end'];

export class ImportScanner {
  async scan(directory: string): Promise<ImportCandidateDto> {
    const resolvedDirectory = path.resolve(directory);
    const stat = await this.getDirectoryStat(resolvedDirectory);
    if (!stat?.isDirectory()) {
      throw new Error('VALIDATION_ERROR: 選取的路徑不是資料夾');
    }

    const entries = await fs.readdir(resolvedDirectory, { withFileTypes: true });
    const entryNames = new Set(entries.map((entry) => entry.name.toLowerCase()));
    const filePaths = new Map(entries.map((entry) => [entry.name.toLowerCase(), path.join(resolvedDirectory, entry.name)]));

    const jarCandidates = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jar'))
      .map((entry) => path.join(resolvedDirectory, entry.name))
      .sort((a, b) => this.rankJarCandidate(b) - this.rankJarCandidate(a) || a.localeCompare(b));

    const serverJarPath = jarCandidates[0];
    const eulaAccepted = await this.readEulaAccepted(filePaths.get('eula.txt'));
    const detectedCoreType = this.detectCoreType(jarCandidates, entryNames);
    const detectedMcVersion = this.detectMcVersion(jarCandidates);
    const hasWorldData = entries.some((entry) => entry.isDirectory() && WORLD_DIR_CANDIDATES.includes(entry.name.toLowerCase()));
    const hasSpigotJarCandidate = jarCandidates.some((jarPath) => path.basename(jarPath).toLowerCase().includes('spigot'));

    const warnings: string[] = [];
    if (!serverJarPath) warnings.push('找不到可直接啟動的 server jar。');
    if (!detectedCoreType) warnings.push('無法可靠判斷伺服器核心，匯入前請手動確認。');
    if (!detectedMcVersion) warnings.push('無法可靠判斷 Minecraft 版本，匯入前請手動確認。');
    if (hasSpigotJarCandidate) warnings.push('目前匯入流程不提供 Spigot core，請改選其他已支援的核心類型。');
    if (!eulaAccepted) warnings.push('尚未接受 EULA，首次啟動前請確認。');
    if (!entryNames.has('server.properties')) warnings.push('找不到 server.properties，部分設定資訊可能不完整。');

    return {
      directory: resolvedDirectory,
      suggestedName: path.basename(resolvedDirectory),
      detectedCoreType,
      detectedMcVersion,
      serverJarPath,
      jarCandidates,
      hasEula: entryNames.has('eula.txt'),
      eulaAccepted,
      hasServerProperties: entryNames.has('server.properties'),
      hasWorldData,
      hasModsFolder: entryNames.has('mods'),
      hasPluginsFolder: entryNames.has('plugins'),
      hasLibrariesFolder: entryNames.has('libraries'),
      hasUserCache: entryNames.has('usercache.json'),
      hasOpsFile: entryNames.has('ops.json'),
      hasWhitelistFile: entryNames.has('whitelist.json'),
      warnings,
    };
  }

  private async getDirectoryStat(directory: string): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
    try {
      return await fs.stat(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('FS_READ_ERROR: 找不到指定資料夾');
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error('FS_PERMISSION_DENIED: 無法讀取指定資料夾');
      }
      throw error;
    }
  }

  private async readEulaAccepted(eulaPath?: string): Promise<boolean> {
    if (!eulaPath) return false;
    try {
      const content = await fs.readFile(eulaPath, 'utf-8');
      return /^eula\s*=\s*true$/im.test(content);
    } catch {
      return false;
    }
  }

  private detectCoreType(jarCandidates: string[], entryNames: Set<string>): CoreType | undefined {
    for (const jarPath of jarCandidates) {
      const lower = path.basename(jarPath).toLowerCase();
      if (lower.includes('paper')) return 'paper';
      if (lower.includes('fabric')) return 'fabric';
      if (lower.includes('forge')) return 'forge';
      if (lower === 'server.jar' || lower.startsWith('minecraft_server')) return 'vanilla';
    }

    if (entryNames.has('plugins')) return 'paper';
    if (entryNames.has('mods')) return 'fabric';
    return undefined;
  }

  private detectMcVersion(jarCandidates: string[]): string | undefined {
    for (const jarPath of jarCandidates) {
      const match = path.basename(jarPath).match(/(?:^|[^0-9])((?:1\.\d+(?:\.\d+)?)|(?:\d+\.\d+(?:\.\d+)?))(?:[^0-9]|$)/);
      if (match?.[1]) {
        return match[1];
      }
    }
    return undefined;
  }

  private rankJarCandidate(jarPath: string): number {
    const name = path.basename(jarPath).toLowerCase();
    if (name === 'fabric-server-launch.jar') return 100;
    if (name === 'server.jar') return 90;
    if (name.includes('paper')) return 80;
    if (name.includes('spigot')) return 70;
    if (name.includes('fabric')) return 60;
    if (name.includes('forge')) return 50;
    if (name.startsWith('minecraft_server')) return 40;
    return 10;
  }
}
