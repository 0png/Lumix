/**
 * Workspace settings persistence.
 *
 * Settings are deliberately kept in a small, versioned JSON document so a
 * malformed field can be repaired without throwing away the rest of the
 * user's preferences.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  CloseBehavior,
  JavaInstallationDto,
  Language,
  SaveSettingsRequest,
  SettingsDto,
  Theme,
} from '../../shared/ipc-types';

export const SETTINGS_SCHEMA_VERSION = 1;
export const DEFAULT_RAM_MAX = 4096;
export const DEFAULT_RAM_MIN = DEFAULT_RAM_MAX / 2;
export const MIN_RAM_MB = 1024;
export const MAX_RAM_MB = 16384;
export const RAM_STEP_MB = 512;
export const MIN_BACKUP_RETENTION = 1;
export const MAX_BACKUP_RETENTION = 50;
export const DEFAULT_BACKUP_RETENTION = 3;

interface StoredSettings {
  schemaVersion: number;
  theme: Theme;
  language: Language;
  defaultRamMin: number;
  defaultRamMax: number;
  autoCheckUpdate: boolean;
  autoUpdate: boolean;
  launchAtLogin: boolean;
  startMinimized: boolean;
  restoreLastSession: boolean;
  closeBehavior: CloseBehavior;
  defaultServersPath: string;
  defaultRegularBackupRetention: number;
  defaultPreRestoreBackupRetention: number;
  javaInstallations: SettingsDto['javaInstallations'];
}

export class SettingsService {
  private readonly settingsPath: string;
  private readonly defaultServersPath: string;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.defaultServersPath = path.join(userDataPath, 'servers');
  }

  getPath(): string {
    return this.settingsPath;
  }

  getDefaultServersPath(): string {
    return this.defaultServersPath;
  }

  async get(): Promise<SettingsDto> {
    return this.enqueue(() => this.readAndNormalize());
  }

  async save(request: SaveSettingsRequest): Promise<SettingsDto> {
    return this.enqueue(async () => {
      const current = await this.readAndNormalize();

      if (request.defaultServersPath !== undefined) {
        await this.validateServersPath(request.defaultServersPath);
      }

      const next = this.normalize({
        ...current,
        ...request,
      });

      await this.writeAtomic(this.toStored(next));
      return next;
    });
  }

  private async readAndNormalize(): Promise<SettingsDto> {
    let raw: unknown;

    try {
      raw = JSON.parse(await fs.readFile(this.settingsPath, 'utf-8')) as unknown;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[SettingsService] Unable to read settings, repairing: ${formatError(error)}`);
      }
      const repaired = this.normalize({});
      await this.ensureDefaultServersPath();
      await this.writeAtomic(this.toStored(repaired)).catch((writeError) => {
        console.warn(`[SettingsService] Unable to write repaired settings: ${formatError(writeError)}`);
      });
      return repaired;
    }

    const normalized = this.normalize(raw);
    await this.ensureDefaultServersPath();
    // Persist normalization as well, so legacy, partial and out-of-range
    // values are repaired once and remain stable after a restart.
    await this.writeAtomic(this.toStored(normalized)).catch((writeError) => {
      console.warn(`[SettingsService] Unable to persist normalized settings: ${formatError(writeError)}`);
    });
    return normalized;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(operation, operation);
    this.operationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async ensureDefaultServersPath(): Promise<void> {
    try {
      await fs.mkdir(this.defaultServersPath, { recursive: true });
    } catch (error) {
      console.warn(`[SettingsService] Unable to create default servers directory: ${formatError(error)}`);
    }
  }

  async validateServersPath(candidate: string): Promise<string> {
    if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) {
      throw new Error('VALIDATION_ERROR: 伺服器根目錄必須是絕對路徑');
    }

    const resolved = path.resolve(candidate);
    let stat;
    try {
      stat = await fs.stat(resolved);
    } catch (error) {
      if (resolved === path.resolve(this.defaultServersPath)
        && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          await fs.mkdir(resolved, { recursive: true });
          stat = await fs.stat(resolved);
        } catch (createError) {
          throw new Error(`FS_PERMISSION_DENIED: 無法建立伺服器根目錄：${formatError(createError)}`);
        }
      } else {
        throw new Error(`FS_PERMISSION_DENIED: 無法存取伺服器根目錄：${formatError(error)}`);
      }
    }

    if (!stat.isDirectory()) {
      throw new Error('VALIDATION_ERROR: 伺服器根目錄必須是資料夾');
    }

    const probe = path.join(resolved, `.lumix-settings-write-test-${process.pid}-${Date.now()}`);
    try {
      await fs.mkdir(probe);
      await fs.rm(probe, { recursive: true, force: true });
    } catch (error) {
      await fs.rm(probe, { recursive: true, force: true }).catch(() => undefined);
      throw new Error(`FS_PERMISSION_DENIED: 伺服器根目錄不可寫入：${formatError(error)}`);
    }

    return resolved;
  }

  normalize(raw: unknown): SettingsDto {
    const source = isRecord(raw) ? raw : {};
    const max = normalizeRam(source.defaultRamMax, DEFAULT_RAM_MAX);
    const defaultServersPath = normalizeServersPath(source.defaultServersPath, this.defaultServersPath);

    return {
      theme: normalizeTheme(source.theme),
      language: normalizeLanguage(source.language),
      // Xms is intentionally derived from Xmx. It cannot drift after a
      // partial/corrupt write or after loading a legacy settings file.
      defaultRamMax: max,
      defaultRamMin: max / 2,
      autoCheckUpdate: normalizeBoolean(source.autoCheckUpdate, true),
      autoUpdate: normalizeBoolean(source.autoUpdate, true),
      launchAtLogin: normalizeBoolean(source.launchAtLogin, false),
      startMinimized: normalizeBoolean(source.startMinimized, true),
      restoreLastSession: normalizeBoolean(source.restoreLastSession, true),
      closeBehavior: normalizeCloseBehavior(source.closeBehavior),
      defaultServersPath,
      defaultRegularBackupRetention: normalizeRetention(
        source.defaultRegularBackupRetention,
        DEFAULT_BACKUP_RETENTION
      ),
      defaultPreRestoreBackupRetention: normalizeRetention(
        source.defaultPreRestoreRetention ?? source.defaultPreRestoreBackupRetention,
        DEFAULT_BACKUP_RETENTION
      ),
      javaInstallations: normalizeJavaInstallations(source.javaInstallations),
    };
  }

  private toStored(settings: SettingsDto): StoredSettings {
    return {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      theme: settings.theme,
      language: settings.language,
      defaultRamMax: settings.defaultRamMax,
      autoCheckUpdate: settings.autoCheckUpdate !== false,
      autoUpdate: settings.autoUpdate !== false,
      launchAtLogin: settings.launchAtLogin,
      startMinimized: settings.startMinimized,
      restoreLastSession: settings.restoreLastSession,
      closeBehavior: settings.closeBehavior,
      defaultServersPath: settings.defaultServersPath,
      defaultRegularBackupRetention: settings.defaultRegularBackupRetention,
      defaultPreRestoreBackupRetention: settings.defaultPreRestoreBackupRetention,
      javaInstallations: settings.javaInstallations,
      defaultRamMin: settings.defaultRamMax / 2,
    };
  }

  private async writeAtomic(settings: StoredSettings): Promise<void> {
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    const temporaryPath = `${this.settingsPath}.${process.pid}.${Date.now()}.tmp`;
    const backupPath = `${this.settingsPath}.bak`;
    const content = `${JSON.stringify(settings, null, 2)}\n`;

    try {
      await fs.writeFile(temporaryPath, content, 'utf-8');

      let movedExisting = false;
      try {
        await fs.rm(backupPath, { force: true });
        await fs.rename(this.settingsPath, backupPath);
        movedExisting = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }

      try {
        await fs.rename(temporaryPath, this.settingsPath);
      } catch (error) {
        if (movedExisting) {
          await fs.rename(backupPath, this.settingsPath).catch(() => undefined);
        }
        throw error;
      }

      if (movedExisting) {
        await fs.rm(backupPath, { force: true });
      }
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTheme(value: unknown): Theme {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function normalizeLanguage(value: unknown): Language {
  return value === 'en' || value === 'zh-TW' ? value : 'zh-TW';
}

function normalizeCloseBehavior(value: unknown): CloseBehavior {
  return value === 'quit' ? 'quit' : 'minimize-to-tray';
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeRam(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const snapped = Math.round(numeric / RAM_STEP_MB) * RAM_STEP_MB;
  return Math.min(MAX_RAM_MB, Math.max(MIN_RAM_MB, snapped));
}

function normalizeRetention(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(MAX_BACKUP_RETENTION, Math.max(MIN_BACKUP_RETENTION, Math.round(numeric)));
}

function normalizeServersPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim() || !path.isAbsolute(value)) return fallback;
  return path.resolve(value);
}

function normalizeJavaInstallations(value: unknown): JavaInstallationDto[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.path !== 'string' || !candidate.path.trim()) {
      return [];
    }

    const majorVersion = typeof candidate.majorVersion === 'number'
      ? candidate.majorVersion
      : Number(candidate.majorVersion);
    if (!Number.isInteger(majorVersion) || majorVersion < 1 || majorVersion > 100) return [];

    const javaPath = path.normalize(candidate.path.trim());
    const dedupeKey = process.platform === 'win32' ? javaPath.toLowerCase() : javaPath;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    const installation: JavaInstallationDto = {
      path: javaPath,
      version: typeof candidate.version === 'string' && candidate.version.trim()
        ? candidate.version.trim()
        : 'unknown',
      majorVersion,
    };
    if (typeof candidate.vendor === 'string' && candidate.vendor.trim()) {
      installation.vendor = candidate.vendor.trim();
    }
    if (typeof candidate.isValid === 'boolean') {
      installation.isValid = candidate.isValid;
    }
    return [installation];
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
