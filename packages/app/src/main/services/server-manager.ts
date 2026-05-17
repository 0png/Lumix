/**
 * ServerManager Service
 * 負責伺服器實例的 CRUD 操作與生命週期管理
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { FileManager, ServerMetadata } from './file-manager';
import { ImportRegistry, type ImportedServerRecord } from './import-registry';
import { ImportScanner } from './import-scanner';
import { ProcessManager, ProcessConfig } from './process-manager';
import { parseLogLevel, splitLogLines } from './log-parser';
import {
  calculateNextBackupRun,
  createBackupId,
  DEFAULT_BACKUP_SETTINGS,
  normalizeBackupSettings,
  withNextBackupRun,
} from '../../shared/backup-utils';
import type {
  ServerInstanceDto,
  ServerStatus,
  CreateServerRequest,
  DetectImportCandidateRequest,
  ImportCandidateDto,
  ImportServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  LogLevel,
  ServerProperties,
  PlayerActionRequest,
  PlayerDto,
  BackupInfoDto,
  BackupSettings,
  BackupTrigger,
  RestoreBackupRequest,
  UpdateBackupSettingsRequest,
} from '../../shared/ipc-types';
import { IpcErrorCode, formatIpcError, createIpcError } from '../../shared/ipc-types';

// ============================================================================
// Types
// ============================================================================

// 超時設定常數
const SERVER_STOP_TIMEOUT = 30000; // 30 秒
const SERVER_START_TIMEOUT = 300000; // 5 分鐘
const JAVA_VERIFY_TIMEOUT = 5000; // 5 秒
const BACKUP_DIR_NAME = '.lumix-backups';
const BACKUP_METADATA_FILE = '.lumix-backup.json';
const MAX_BACKUPS_PER_SERVER = 3;
const MAX_TIMER_DELAY = 2147483647;

export interface ServerManagerEvents {
  'status-changed': (event: ServerStatusEvent) => void;
  'log-entry': (event: ServerLogEvent) => void;
}

export interface ServerManagerConfig {
  fileManager: FileManager;
  importRegistry: ImportRegistry;
  importScanner: ImportScanner;
  processManager: ProcessManager;
  defaultJavaPath?: string;
}

// ============================================================================
// ServerManager Class
// ============================================================================

export class ServerManager extends EventEmitter {
  private fileManager: FileManager;
  private importRegistry: ImportRegistry;
  private importScanner: ImportScanner;
  private processManager: ProcessManager;
  private servers: Map<string, ServerInstanceDto> = new Map();
  private defaultJavaPath: string;
  private stopTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private serverReadyFlags: Set<string> = new Set(); // 追蹤已觸發 ready 事件的服務器
  private onlinePlayers: Map<string, Set<string>> = new Map();
  private pendingSilentListResponses: Map<string, number> = new Map();
  private backupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ServerManagerConfig) {
    super();
    this.fileManager = config.fileManager;
    this.importRegistry = config.importRegistry;
    this.importScanner = config.importScanner;
    this.processManager = config.processManager;
    this.defaultJavaPath = config.defaultJavaPath || 'java';
    this.setupProcessManagerListeners();
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  async getAllServers(): Promise<ServerInstanceDto[]> {
    const servers = await Promise.all(
      Array.from(this.servers.values()).map((server) => this.refreshServerDerivedState(server))
    );

    servers.forEach((server) => {
      this.servers.set(server.id, server);
    });

    return servers;
  }

  async getServerById(id: string): Promise<ServerInstanceDto | null> {
    const server = this.servers.get(id);
    if (!server) return null;

    const refreshed = await this.refreshServerDerivedState(server);
    this.servers.set(id, refreshed);
    return refreshed;
  }

  async detectImportCandidate(request: DetectImportCandidateRequest): Promise<ImportCandidateDto> {
    const candidate = await this.importScanner.scan(request.directory);
    const existingByDirectory = this.findServerByDirectory(candidate.directory);
    if (existingByDirectory) {
      candidate.warnings.unshift('此資料夾已經匯入到 Lumix。');
    }
    return candidate;
  }

  async importExistingServer(request: ImportServerRequest): Promise<ServerInstanceDto> {
    const candidate = await this.importScanner.scan(request.directory);
    const trimmedName = request.name.trim();
    const resolvedDirectory = path.resolve(request.directory);
    const resolvedJarPath = path.resolve(request.launchJarPath);

    if (!trimmedName) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_NAME,
        '伺服器名稱不能為空'
      )));
    }

    if (this.findServerByName(trimmedName)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_DUPLICATE_NAME,
        '伺服器名稱已存在'
      )));
    }

    if (this.findServerByDirectory(resolvedDirectory)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '此資料夾已經匯入過'
      )));
    }

    if (!request.mcVersion.trim()) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        'Minecraft 版本不能為空'
      )));
    }

    if (!candidate.jarCandidates.includes(resolvedJarPath)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '選擇的啟動 jar 不在匯入資料夾中'
      )));
    }

    const id = uuidv4();
    const metadata: ImportedServerRecord = {
      id,
      name: trimmedName,
      origin: 'imported',
      directory: resolvedDirectory,
      coreType: request.coreType,
      mcVersion: request.mcVersion.trim(),
      ramMin: request.ramMin ?? 1024,
      ramMax: request.ramMax ?? 2048,
      jvmArgs: request.jvmArgs ?? [],
      javaPath: request.javaPath,
      launchJarPath: resolvedJarPath,
      createdAt: new Date().toISOString(),
      eulaAccepted: request.eulaAccepted ?? candidate.eulaAccepted,
      backupSettings: { ...DEFAULT_BACKUP_SETTINGS },
    };

    await this.importRegistry.save(metadata);

    const server = await this.refreshServerDerivedState(this.createServerDtoFromImportedRecord(metadata));
    this.servers.set(id, server);
    return server;
  }

  async createServer(request: CreateServerRequest): Promise<ServerInstanceDto> {
    const trimmedName = request.name.trim();
    if (!trimmedName) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_NAME,
        '伺服器名稱不能為空'
      )));
    }

    if (this.findServerByName(trimmedName)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_DUPLICATE_NAME,
        '伺服器名稱已存在'
      )));
    }

    if (await this.fileManager.serverExists(trimmedName)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_DUPLICATE_NAME,
        '伺服器目錄已存在'
      )));
    }

    const id = uuidv4();
    const serverPath = await this.fileManager.createServerDirectory(trimmedName);

    try {
      const metadata = this.buildMetadata(id, trimmedName, request);
      await this.writeServerFiles(serverPath, metadata);

      const server: ServerInstanceDto = {
        ...metadata,
        javaPath: metadata.javaPath || this.defaultJavaPath,
        directory: serverPath,
        launchJarPath: metadata.launchJarPath,
        status: 'stopped',
        origin: 'managed',
        eulaAccepted: metadata.eulaAccepted,
      };

      const hydratedServer = await this.refreshServerDerivedState(server);
      this.servers.set(id, hydratedServer);
      return hydratedServer;
    } catch (error) {
      await this.fileManager.deleteServerDirectory(serverPath).catch(() => {});
      throw error;
    }
  }

  async updateServer(request: UpdateServerRequest): Promise<ServerInstanceDto> {
    const server = this.servers.get(request.id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    if (request.name !== undefined) {
      const trimmedName = request.name.trim();
      if (!trimmedName) {
        throw new Error(formatIpcError(createIpcError(
          IpcErrorCode.SERVER_INVALID_NAME,
          '伺服器名稱不能為空'
        )));
      }
      if (this.findServerByName(trimmedName, request.id)) {
        throw new Error(formatIpcError(createIpcError(
          IpcErrorCode.SERVER_DUPLICATE_NAME,
          '伺服器名稱已存在'
        )));
      }
    }

    const backupSettings = request.backupSettings
      ? withNextBackupRun(normalizeBackupSettings(request.backupSettings))
      : server.backupSettings;

    const updatedServer: ServerInstanceDto = {
      ...server,
      name: request.name?.trim() ?? server.name,
      javaPath: request.javaPath ?? server.javaPath,
      ramMin: request.ramMin ?? server.ramMin,
      ramMax: request.ramMax ?? server.ramMax,
      jvmArgs: request.jvmArgs ?? server.jvmArgs,
      launchJarPath: request.launchJarPath ?? server.launchJarPath,
      eulaAccepted: request.eulaAccepted ?? server.eulaAccepted,
      backupSettings,
      onboardingState: request.onboardingState ?? server.onboardingState,
    };

    await this.persistServerUpdate(updatedServer);
    const hydratedServer = await this.refreshServerDerivedState(updatedServer);
    this.servers.set(request.id, hydratedServer);
    this.scheduleBackup(request.id);
    return hydratedServer;
  }

  async deleteServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    if (server.status !== 'stopped') {
      // 等待伺服器真正停止後再刪除
      await this.stopServerAndWait(id);
    }

    if (server.origin === 'imported') {
      await this.importRegistry.delete(id);
    } else {
      await this.fileManager.deleteServerDirectory(server.directory);
    }
    this.servers.delete(id);
    this.clearBackupTimer(id);
  }

  /**
   * 停止伺服器並等待程序真正結束
   */
  private async stopServerAndWait(id: string, timeoutMs: number = SERVER_STOP_TIMEOUT): Promise<void> {
    return new Promise<void>((resolve) => {
      let cleanupCalled = false;

      const onExit = (serverId: string): void => {
        if (serverId === id) {
          cleanup();
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        // 超時後強制終止
        this.processManager.forceKill(id);
        // 給足夠時間讓 forceKill 生效（增加到 2 秒）
        setTimeout(() => {
          if (this.processManager.isRunning(id)) {
            // forceKill 失敗，記錄錯誤
            this.emitLogEntry(id, 'error', '無法強制終止伺服器程序');
          }
          resolve();
        }, 2000);
      }, timeoutMs);

      const cleanup = (): void => {
        if (cleanupCalled) return;
        cleanupCalled = true;
        clearTimeout(timeout);
        this.processManager.off('exit', onExit);
      };

      this.processManager.on('exit', onExit);

      // 發送停止指令
      this.updateServerStatus(id, 'stopping');
      const sent = this.processManager.writeStdin(id, 'stop');
      if (!sent) {
        this.processManager.kill(id);
      }
    });
  }

  // ==========================================================================
  // Lifecycle Operations
  // ==========================================================================

  async startServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    if (server.status === 'running' || server.status === 'starting') {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        '伺服器已在執行中'
      )));
    }

    const javaPath = server.javaPath || this.defaultJavaPath;

    let javaValid = await this.validateJava(javaPath);

    // 如果指定的 javaPath 無效，嘗試使用預設的 'java'
    let effectiveJavaPath = javaPath;
    if (!javaValid && javaPath !== this.defaultJavaPath) {
      javaValid = await this.validateJava(this.defaultJavaPath);
      if (javaValid) {
        effectiveJavaPath = this.defaultJavaPath;
      }
    }

    if (!javaValid) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.JAVA_NOT_FOUND,
        `找不到有效的 Java 安裝`,
        { path: javaPath }
      )));
    }

    const jarPath = this.resolveLaunchJarPath(server);
    
    // 檢查是否為新版 Forge
    let forgeArgsFile: string | undefined;
    const forgeConfigPath = path.join(server.directory, 'forge-config.json');
    try {
      const forgeConfigContent = await fs.readFile(forgeConfigPath, 'utf-8');
      const forgeConfig = JSON.parse(forgeConfigContent);
      if (forgeConfig.type === 'forge-new' && forgeConfig.argsFile) {
        forgeArgsFile = forgeConfig.argsFile;
      }
    } catch {
      // 不是新版 Forge，使用標準方式
    }

    // 如果不是新版 Forge，檢查 server.jar 是否存在
    if (!forgeArgsFile) {
      try {
        await fs.access(jarPath);
      } catch {
        throw new Error(formatIpcError(createIpcError(
          IpcErrorCode.SERVER_JAR_NOT_FOUND,
          '找不到可用的伺服器 jar 檔案',
          { path: jarPath }
        )));
      }
    }

    this.updateServerStatus(id, 'starting');

    // 清除舊的 stop timeout（避免誤殺新程序）
    const existingTimeout = this.stopTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.stopTimeouts.delete(id);
    }

    // 設置啟動超時（5 分鐘）
    const startTimeout = setTimeout(() => {
      if (server.status === 'starting') {
        this.emitLogEntry(id, 'warn', '伺服器啟動超時（5 分鐘），可能啟動失敗');
      }
    }, SERVER_START_TIMEOUT);

    try {
      const processConfig: ProcessConfig = {
        serverId: id,
        javaPath: effectiveJavaPath,
        jarPath,
        workingDir: server.directory,
        ramMin: server.ramMin,
        ramMax: server.ramMax,
        jvmArgs: server.jvmArgs,
        forgeArgsFile,
      };

      // Debug log
      this.emitLogEntry(id, 'info', `[DEBUG] Starting server with:`);
      this.emitLogEntry(id, 'info', `[DEBUG] Java: ${effectiveJavaPath}`);
      this.emitLogEntry(id, 'info', `[DEBUG] Working Dir: ${server.directory}`);
      this.emitLogEntry(id, 'info', `[DEBUG] JAR: ${jarPath}`);

      // Debug log
      this.emitLogEntry(id, 'info', `[DEBUG] Starting server with:`);
      this.emitLogEntry(id, 'info', `[DEBUG] Java: ${effectiveJavaPath}`);
      this.emitLogEntry(id, 'info', `[DEBUG] Working Dir: ${server.directory}`);
      this.emitLogEntry(id, 'info', `[DEBUG] JAR: ${jarPath}`);

      this.processManager.spawn(processConfig);
      await this.updateLastStartedAt(id);
      this.updateServerStatus(id, 'running');
      this.scheduleBackup(id);
    } catch (error) {
      clearTimeout(startTimeout);
      this.updateServerStatus(id, 'stopped');
      throw error;
    }
  }

  async stopServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    if (server.status === 'stopped') {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        '伺服器已停止'
      )));
    }

    // 清除舊的 timeout（避免多個 timeout 同時存在）
    const existingTimeout = this.stopTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.stopTimeouts.delete(id);
    }

    this.updateServerStatus(id, 'stopping');

    const sent = this.processManager.writeStdin(id, 'stop');
    if (!sent) {
      this.processManager.kill(id);
    }

    // 設置新的 timeout
    const timeout = setTimeout(() => {
      this.stopTimeouts.delete(id);
      if (this.processManager.isRunning(id)) {
        this.processManager.forceKill(id);
      }
    }, SERVER_STOP_TIMEOUT);
    this.stopTimeouts.set(id, timeout);
  }

  async sendCommand(id: string, command: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    if (server.status !== 'running') {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        '只能對執行中的伺服器發送指令'
      )));
    }

    const sent = this.processManager.writeStdin(id, command);
    if (!sent) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.PROCESS_COMMAND_FAILED,
        '無法發送指令'
      )));
    }

    this.emitLogEntry(id, 'info', `> ${command}`);
  }

  async getPlayers(id: string): Promise<PlayerDto[]> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    if (server.status === 'running') {
      this.sendSilentListCommand(id);
    }

    const [userCache, ops, bannedPlayers, whitelist] = await Promise.all([
      this.readPlayerFile<UserCacheEntry>(server.directory, 'usercache.json'),
      this.readPlayerFile<PlayerListEntry>(server.directory, 'ops.json'),
      this.readPlayerFile<PlayerListEntry>(server.directory, 'banned-players.json'),
      this.readPlayerFile<PlayerListEntry>(server.directory, 'whitelist.json'),
    ]);

    const onlineNames = this.onlinePlayers.get(id) ?? new Set<string>();
    const playersByName = new Map<string, PlayerDto>();
    const upsert = (name: string, data: Partial<PlayerDto> = {}): void => {
      const key = name.toLowerCase();
      const existing = playersByName.get(key);
      playersByName.set(key, {
        name,
        online: onlineNames.has(key),
        isOp: false,
        isBanned: false,
        isWhitelisted: false,
        ...existing,
        ...data,
      });
    };

    for (const entry of userCache) {
      if (entry.name) {
        upsert(entry.name, {
          uuid: normalizeUuid(entry.uuid),
          lastSeenAt: entry.expiresOn,
        });
      }
    }
    for (const entry of ops) if (entry.name) upsert(entry.name, { uuid: normalizeUuid(entry.uuid), isOp: true });
    for (const entry of bannedPlayers) if (entry.name) upsert(entry.name, { uuid: normalizeUuid(entry.uuid), isBanned: true });
    for (const entry of whitelist) if (entry.name) upsert(entry.name, { uuid: normalizeUuid(entry.uuid), isWhitelisted: true });
    for (const onlineName of onlineNames) {
      const cached = userCache.find((entry) => entry.name?.toLowerCase() === onlineName);
      upsert(cached?.name ?? onlineName, { online: true, uuid: normalizeUuid(cached?.uuid) });
    }

    return Array.from(playersByName.values()).sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async performPlayerAction(request: PlayerActionRequest): Promise<void> {
    const command = this.buildPlayerActionCommand(request);
    await this.sendCommand(request.serverId, command);
  }

  // ==========================================================================
  // Backup Operations
  // ==========================================================================

  async listBackups(id: string): Promise<BackupInfoDto[]> {
    const server = this.getExistingServer(id);
    const backupRoot = this.getBackupRoot(server.directory);

    try {
      await fs.access(backupRoot);
    } catch {
      return [];
    }

    const entries = await fs.readdir(backupRoot, { withFileTypes: true });
    const backups = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<BackupInfoDto | null> => {
        const backupPath = path.join(backupRoot, entry.name);
        try {
          const metadataPath = path.join(backupPath, BACKUP_METADATA_FILE);
          const raw = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(raw) as Omit<BackupInfoDto, 'sizeBytes'>;
          return {
            ...metadata,
            path: backupPath,
            sizeBytes: await this.getDirectorySize(backupPath),
          };
        } catch {
          return null;
        }
      }));

    return backups
      .filter((backup): backup is BackupInfoDto => backup !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createBackup(id: string, trigger: BackupTrigger = 'manual'): Promise<BackupInfoDto> {
    const server = this.getExistingServer(id);
    const createdAt = new Date().toISOString();
    const backupId = createBackupId(createdAt);
    const backupRoot = this.getBackupRoot(server.directory);
    const backupPath = path.join(backupRoot, backupId);

    await fs.mkdir(backupRoot, { recursive: true });
    await fs.mkdir(backupPath, { recursive: true });
    const shouldNotifyOps = trigger === 'scheduled' && server.backupSettings?.notifyOps !== false;

    const copyServer = async (): Promise<void> => {
      await this.copyServerDirectoryToBackup(server.directory, backupPath, server.backupSettings);
    };

    if (shouldNotifyOps) {
      await this.notifyOps(id, 'Lumix 正在建立伺服器備份...');
    }

    if (server.status === 'running') {
      this.processManager.writeStdin(id, 'save-off');
      this.processManager.writeStdin(id, 'save-all flush');
      await this.delay(2000);
      try {
        await copyServer();
      } finally {
        this.processManager.writeStdin(id, 'save-on');
      }
    } else {
      await copyServer();
    }

    const backup: BackupInfoDto = {
      id: backupId,
      serverId: id,
      name: `${server.name} ${createdAt.replace('T', ' ').slice(0, 19)}`,
      path: backupPath,
      createdAt,
      sizeBytes: await this.getDirectorySize(backupPath),
      trigger,
    };

    await fs.writeFile(
      path.join(backupPath, BACKUP_METADATA_FILE),
      JSON.stringify(backup, null, 2),
      'utf-8'
    );
    await this.pruneBackups(id);

    if (trigger === 'scheduled') {
      await this.markBackupRun(id, createdAt);
    }

    if (shouldNotifyOps) {
      await this.notifyOps(id, `Lumix 已完成伺服器備份: ${backup.name}`);
    }

    this.emitLogEntry(id, 'info', `已建立備份: ${backup.name}`);
    return backup;
  }

  async restoreBackup(request: RestoreBackupRequest): Promise<void> {
    const server = this.getExistingServer(request.serverId);
    if (server.status !== 'stopped') {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        '還原備份前請先停止伺服器'
      )));
    }

    const backups = await this.listBackups(request.serverId);
    const backup = backups.find((item) => item.id === request.backupId);
    if (!backup) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.FS_READ_ERROR,
        '找不到指定的備份'
      )));
    }

    const entries = await fs.readdir(server.directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.name === BACKUP_DIR_NAME) return;
      await fs.rm(path.join(server.directory, entry.name), { recursive: true, force: true });
    }));

    await fs.cp(backup.path, server.directory, {
      recursive: true,
      filter: (source) => path.basename(source) !== BACKUP_METADATA_FILE,
    });

    const restoredServer: ServerInstanceDto = {
      ...server,
      directory: server.directory,
      status: 'stopped',
    };
    this.servers.set(request.serverId, restoredServer);
    await this.persistServerUpdate(restoredServer);
    this.scheduleBackup(request.serverId);
    this.emitLogEntry(request.serverId, 'info', `已還原備份: ${backup.name}`);
  }

  async deleteBackup(serverId: string, backupId: string): Promise<void> {
    const server = this.getExistingServer(serverId);
    const backupPath = path.join(this.getBackupRoot(server.directory), path.basename(backupId));
    await fs.rm(backupPath, { recursive: true, force: true });
  }

  async updateBackupSettings(request: UpdateBackupSettingsRequest): Promise<ServerInstanceDto> {
    return this.updateServer({
      id: request.serverId,
      backupSettings: normalizeBackupSettings(request.settings),
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async loadServers(): Promise<void> {
    const metadataList = await this.fileManager.discoverServers();
    const importedServers = await this.importRegistry.list();

    for (const metadata of metadataList) {
      const serverPath = this.fileManager.getServerPath(metadata.name);
      const server = this.createServerDtoFromManagedMetadata(metadata, serverPath);
      this.servers.set(metadata.id, server);
      this.startBackupSchedule(metadata.id);
    }

    for (const record of importedServers) {
      const server = this.createServerDtoFromImportedRecord(record);
      this.servers.set(record.id, server);
      this.startBackupSchedule(record.id);
    }
  }

  async cleanup(): Promise<void> {
    // 清除所有 stop timeouts
    for (const timeout of this.stopTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.stopTimeouts.clear();
    for (const timeout of this.backupTimers.values()) {
      clearTimeout(timeout);
    }
    this.backupTimers.clear();
    this.processManager.killAll();
  }

  // ==========================================================================
  // Server Properties Operations
  // ==========================================================================

  async getServerProperties(id: string): Promise<ServerProperties> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }
    return this.fileManager.readServerProperties(server.directory);
  }

  async getServerPropertiesRaw(id: string): Promise<Record<string, string>> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }
    return this.fileManager.readServerPropertiesRaw(server.directory);
  }

  async updateServerProperties(
    id: string,
    properties: Partial<ServerProperties>
  ): Promise<ServerProperties> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }
    return this.fileManager.updateServerProperties(server.directory, properties);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupProcessManagerListeners(): void {
    this.processManager.on('stdout', (serverId: string, data: string) => {
      this.handleProcessOutput(serverId, data, 'info');
    });

    this.processManager.on('stderr', (serverId: string, data: string) => {
      this.handleProcessOutput(serverId, data, 'error');
    });

    this.processManager.on('exit', (serverId: string, code: number | null) => {
      this.handleProcessExit(serverId, code);
    });

    this.processManager.on('error', (serverId: string, error: Error) => {
      this.emitLogEntry(serverId, 'error', `程序錯誤: ${error.message}`);
      this.updateServerStatus(serverId, 'stopped');
    });
  }

  private handleProcessOutput(serverId: string, data: string, defaultLevel: LogLevel): void {
    const lines = splitLogLines(data);
    for (const line of lines) {
      const level = parseLogLevel(line) || defaultLevel;
      this.trackPlayersFromLog(serverId, line);
      if (this.shouldSuppressSilentListResponse(serverId, line)) {
        continue;
      }
      this.emitLogEntry(serverId, level, line);
      
      // 檢測服務器成功啟動
      if (!this.serverReadyFlags.has(serverId) && this.isServerReady(line)) {
        this.onServerReady(serverId);
      }
    }
  }

  /**
   * 檢測服務器是否已成功啟動
   */
  private isServerReady(line: string): boolean {
    const lower = line.toLowerCase();
    // 檢測常見的成功啟動標誌
    return (
      (lower.includes('done') && lower.includes('for help')) ||
      lower.includes('server started') ||
      lower.includes('server is running') ||
      (lower.includes('preparing start') && lower.includes('done')) ||
      (lower.includes('help') && lower.includes('type'))
    );
  }

  /**
   * 當服務器成功啟動時觸發
   */
  private onServerReady(serverId: string): void {
    // 標記為已觸發，避免重複觸發
    this.serverReadyFlags.add(serverId);
    
    // 發送事件通知前端顯示提示對話框
    this.emit('server-ready', { serverId });
  }

  private handleProcessExit(serverId: string, code: number | null): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    // 清除對應的 stop timeout，避免不必要的 forceKill
    const timeout = this.stopTimeouts.get(serverId);
    if (timeout) {
      clearTimeout(timeout);
      this.stopTimeouts.delete(serverId);
    }

    // 清除 ready 標誌，下次啟動時可以再次觸發
    this.serverReadyFlags.delete(serverId);
    this.onlinePlayers.delete(serverId);
    this.pendingSilentListResponses.delete(serverId);
    this.clearBackupTimer(serverId);

    const event: ServerStatusEvent = {
      serverId,
      status: 'stopped',
      exitCode: code ?? undefined,
    };

    server.status = 'stopped';
    this.servers.set(serverId, server);
    this.emit('status-changed', event);
    this.emitLogEntry(serverId, 'info', `伺服器已停止 (exit code: ${code ?? 'unknown'})`);
  }

  private updateServerStatus(id: string, status: ServerStatus): void {
    const server = this.servers.get(id);
    if (!server) return;

    server.status = status;
    this.servers.set(id, server);
    this.emit('status-changed', { serverId: id, status });
  }

  private emitLogEntry(serverId: string, level: LogLevel, message: string): void {
    this.emit('log-entry', {
      serverId,
      entry: { timestamp: new Date().toISOString(), level, message },
    });
  }

  private async validateJava(javaPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;

      const proc = spawn(javaPath, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        // 移除 windowsVerbatimArguments，讓 Node.js 正確處理帶空格的路徑
      });

      proc.stdout?.on('data', () => {});
      proc.stderr?.on('data', () => {});

      proc.on('error', () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });

      proc.on('close', (code: number | null) => {
        if (!resolved) {
          resolved = true;
          resolve(code === 0);
        }
      });

      // 設定超時，使用 SIGKILL 確保終止
      setTimeout(() => {
        if (!resolved) {
          proc.kill('SIGKILL');
          // 不在這裡 resolve，等待 close 事件處理
        }
      }, JAVA_VERIFY_TIMEOUT);
    });
  }

  private async refreshServerDerivedState(server: ServerInstanceDto): Promise<ServerInstanceDto> {
    let hasServerProperties = false;

    try {
      await fs.access(path.join(server.directory, 'server.properties'));
      hasServerProperties = true;
    } catch {
      hasServerProperties = false;
    }

    return {
      ...server,
      hasServerProperties,
    };
  }

  private findServerByName(name: string, excludeId?: string): ServerInstanceDto | undefined {
    return Array.from(this.servers.values()).find(
      (s) => s.name === name && s.id !== excludeId
    );
  }

  private findServerByDirectory(directory: string, excludeId?: string): ServerInstanceDto | undefined {
    const resolved = path.resolve(directory);
    return Array.from(this.servers.values()).find(
      (s) => path.resolve(s.directory) === resolved && s.id !== excludeId
    );
  }

  private resolveLaunchJarPath(server: ServerInstanceDto): string {
    if (!server.launchJarPath) {
      return path.join(server.directory, 'server.jar');
    }

    return path.isAbsolute(server.launchJarPath)
      ? server.launchJarPath
      : path.join(server.directory, server.launchJarPath);
  }

  private buildMetadata(id: string, name: string, request: CreateServerRequest): ServerMetadata {
    return {
      id,
      name,
      origin: 'managed',
      coreType: request.coreType,
      mcVersion: request.mcVersion,
      ramMin: request.ramMin ?? 1024,
      ramMax: request.ramMax ?? 2048,
      jvmArgs: request.jvmArgs ?? [],
      javaPath: request.javaPath,
      launchJarPath: 'server.jar',
      createdAt: new Date().toISOString(),
      eulaAccepted: true,
      backupSettings: { ...DEFAULT_BACKUP_SETTINGS },
      onboardingState: {
        completedSteps: [],
      },
    };
  }

  private async writeServerFiles(serverPath: string, metadata: ServerMetadata): Promise<void> {
    await this.fileManager.writeEula(serverPath);
    await this.fileManager.writeRunBat(serverPath, {
      javaPath: metadata.javaPath || this.defaultJavaPath,
      jarPath: metadata.launchJarPath,
      ramMin: metadata.ramMin,
      ramMax: metadata.ramMax,
      jvmArgs: metadata.jvmArgs,
    });
    await this.fileManager.writeServerJson(serverPath, metadata);
  }

  private async persistServerUpdate(server: ServerInstanceDto): Promise<void> {
    if (server.origin === 'imported') {
      await this.importRegistry.save(this.toImportedRecord(server));
      return;
    }

    const metadata = this.toManagedMetadata(server);
    await this.fileManager.writeServerJson(server.directory, metadata);
    await this.fileManager.writeRunBat(server.directory, {
      javaPath: server.javaPath,
      jarPath: server.launchJarPath,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
    });
  }

  private async updateLastStartedAt(id: string): Promise<void> {
    const server = this.servers.get(id)!;
    server.lastStartedAt = new Date().toISOString();
    this.servers.set(id, server);
    await this.persistServerUpdate(server);
  }

  private createServerDtoFromManagedMetadata(metadata: ServerMetadata, directory: string): ServerInstanceDto {
    return {
      id: metadata.id,
      name: metadata.name,
      origin: 'managed',
      coreType: metadata.coreType,
      mcVersion: metadata.mcVersion,
      javaPath: metadata.javaPath || this.defaultJavaPath,
      ramMin: metadata.ramMin,
      ramMax: metadata.ramMax,
      jvmArgs: metadata.jvmArgs,
      directory,
      launchJarPath: metadata.launchJarPath,
      status: 'stopped',
      createdAt: metadata.createdAt,
      lastStartedAt: metadata.lastStartedAt,
      eulaAccepted: metadata.eulaAccepted,
      backupSettings: normalizeBackupSettings(metadata.backupSettings),
      onboardingState: metadata.onboardingState,
    };
  }

  private createServerDtoFromImportedRecord(record: ImportedServerRecord): ServerInstanceDto {
    return {
      id: record.id,
      name: record.name,
      origin: 'imported',
      coreType: record.coreType,
      mcVersion: record.mcVersion,
      javaPath: record.javaPath || this.defaultJavaPath,
      ramMin: record.ramMin,
      ramMax: record.ramMax,
      jvmArgs: record.jvmArgs,
      directory: record.directory,
      launchJarPath: record.launchJarPath,
      status: 'stopped',
      createdAt: record.createdAt,
      lastStartedAt: record.lastStartedAt,
      eulaAccepted: record.eulaAccepted,
      backupSettings: normalizeBackupSettings(record.backupSettings),
      onboardingState: record.onboardingState,
    };
  }

  private toManagedMetadata(server: ServerInstanceDto): ServerMetadata {
    return {
      id: server.id,
      name: server.name,
      origin: 'managed',
      coreType: server.coreType,
      mcVersion: server.mcVersion,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
      javaPath: server.javaPath,
      launchJarPath: server.launchJarPath,
      createdAt: server.createdAt,
      lastStartedAt: server.lastStartedAt,
      eulaAccepted: server.eulaAccepted,
      backupSettings: server.backupSettings,
      onboardingState: server.onboardingState,
    };
  }

  private toImportedRecord(server: ServerInstanceDto): ImportedServerRecord {
    return {
      id: server.id,
      name: server.name,
      origin: 'imported',
      directory: server.directory,
      coreType: server.coreType,
      mcVersion: server.mcVersion,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
      javaPath: server.javaPath,
      launchJarPath: server.launchJarPath,
      createdAt: server.createdAt,
      lastStartedAt: server.lastStartedAt,
      eulaAccepted: server.eulaAccepted,
      backupSettings: server.backupSettings,
      onboardingState: server.onboardingState,
    };
  }

  private getExistingServer(id: string): ServerInstanceDto {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }
    return server;
  }

  private async markBackupRun(serverId: string, runAt: string): Promise<void> {
    const server = this.getExistingServer(serverId);
    const settings = normalizeBackupSettings({
      ...server.backupSettings,
      lastRunAt: runAt,
    });
    settings.nextRunAt = calculateNextBackupRun(settings).toISOString();
    const updatedServer = { ...server, backupSettings: settings };
    this.servers.set(serverId, updatedServer);
    await this.persistServerUpdate(updatedServer);
    this.scheduleBackup(serverId);
  }

  private startBackupSchedule(serverId: string): void {
    const server = this.servers.get(serverId);
    const settings = normalizeBackupSettings(server?.backupSettings);
    if (!server || !settings.enabled) return;
    if (settings.scheduleType === 'while-running' && server.status !== 'running') return;

    if (settings.nextRunAt && new Date(settings.nextRunAt).getTime() <= Date.now()) {
      this.createBackup(serverId, 'scheduled').catch((error) => {
        this.emitLogEntry(serverId, 'error', `錯過排程後補備份失敗: ${formatErrorMessage(error)}`);
        if (settings.notifyOps !== false) {
          this.notifyOps(serverId, `Lumix 錯過排程後補備份失敗: ${formatErrorMessage(error)}`).catch(() => {});
        }
        this.scheduleBackup(serverId);
      });
      return;
    }

    this.scheduleBackup(serverId);
  }

  private scheduleBackup(serverId: string): void {
    this.clearBackupTimer(serverId);
    const server = this.servers.get(serverId);
    const settings = normalizeBackupSettings(server?.backupSettings);
    if (!server || !settings.enabled) return;
    if (settings.scheduleType === 'while-running' && server.status !== 'running') return;

    const nextRun = calculateNextBackupRun(settings);
    settings.nextRunAt = nextRun.toISOString();
    server.backupSettings = settings;
    this.servers.set(serverId, server);

    const delayMs = Math.max(1000, nextRun.getTime() - Date.now());
    const timeout = setTimeout(() => {
      if (delayMs > MAX_TIMER_DELAY) {
        this.scheduleBackup(serverId);
        return;
      }

      this.createBackup(serverId, 'scheduled').catch((error) => {
        this.emitLogEntry(serverId, 'error', `自動備份失敗: ${formatErrorMessage(error)}`);
        if (settings.notifyOps !== false) {
          this.notifyOps(serverId, `Lumix 自動備份失敗: ${formatErrorMessage(error)}`).catch(() => {});
        }
        this.scheduleBackup(serverId);
      });
    }, Math.min(delayMs, MAX_TIMER_DELAY));
    this.backupTimers.set(serverId, timeout);
  }

  private clearBackupTimer(serverId: string): void {
    const timer = this.backupTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      this.backupTimers.delete(serverId);
    }
  }

  private getBackupRoot(serverDirectory: string): string {
    return path.join(serverDirectory, BACKUP_DIR_NAME);
  }

  private shouldIncludeInBackup(serverDirectory: string, source: string, settings?: BackupSettings): boolean {
    const relativePath = path.relative(serverDirectory, source);
    if (!relativePath) return true;
    const parts = relativePath.split(path.sep);
    if (parts.includes(BACKUP_DIR_NAME)) return false;
    if (path.basename(source) === BACKUP_METADATA_FILE) return false;
    if (!settings?.includeLogs && (parts.includes('logs') || source.endsWith('.log'))) return false;
    return true;
  }

  private async copyServerDirectoryToBackup(
    serverDirectory: string,
    backupPath: string,
    settings?: BackupSettings
  ): Promise<void> {
    const entries = await fs.readdir(serverDirectory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const source = path.join(serverDirectory, entry.name);
      if (!this.shouldIncludeInBackup(serverDirectory, source, settings)) return;

      const destination = path.join(backupPath, entry.name);
      if (entry.isDirectory()) {
        await fs.cp(source, destination, {
          recursive: true,
          filter: (currentSource) => this.shouldIncludeInBackup(serverDirectory, currentSource, settings),
        });
        return;
      }

      if (entry.isFile()) {
        await fs.copyFile(source, destination);
      }
    }));
  }

  private async notifyOps(serverId: string, message: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'running') return;

    const ops = await this.readPlayerFile<PlayerListEntry>(server.directory, 'ops.json');
    const opNames = ops
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name));

    for (const name of opNames) {
      const payload = JSON.stringify({ text: `[Lumix] ${message}`, color: 'gold' });
      this.processManager.writeStdin(serverId, `tellraw ${name} ${payload}`);
    }
  }

  private async pruneBackups(serverId: string): Promise<void> {
    const backups = await this.listBackups(serverId);
    const staleBackups = backups.slice(MAX_BACKUPS_PER_SERVER);
    await Promise.all(staleBackups.map((backup) => fs.rm(backup.path, { recursive: true, force: true })));
  }

  private async getDirectorySize(directory: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        total += await this.getDirectorySize(entryPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(entryPath);
        total += stat.size;
      }
    }));
    return total;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async readPlayerFile<T extends { name?: string; uuid?: string }>(
    directory: string,
    fileName: string
  ): Promise<T[]> {
    try {
      const content = await fs.readFile(path.join(directory, fileName), 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private sendSilentListCommand(serverId: string): void {
    const sent = this.processManager.writeStdin(serverId, 'list');
    if (!sent) return;

    const pending = this.pendingSilentListResponses.get(serverId) ?? 0;
    this.pendingSilentListResponses.set(serverId, pending + 1);
  }

  private shouldSuppressSilentListResponse(serverId: string, line: string): boolean {
    const pending = this.pendingSilentListResponses.get(serverId) ?? 0;
    if (pending <= 0 || !this.isPlayerListResponse(line)) {
      return false;
    }

    if (pending === 1) {
      this.pendingSilentListResponses.delete(serverId);
    } else {
      this.pendingSilentListResponses.set(serverId, pending - 1);
    }
    return true;
  }

  private buildPlayerActionCommand(request: PlayerActionRequest): string {
    if (!/^[A-Za-z0-9_]{1,16}$/.test(request.playerName)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '玩家名稱格式無效'
      )));
    }

    const commands: Record<PlayerActionRequest['action'], string> = {
      op: `op ${request.playerName}`,
      deop: `deop ${request.playerName}`,
      ban: `ban ${request.playerName}`,
      pardon: `pardon ${request.playerName}`,
      kick: `kick ${request.playerName}`,
      'whitelist-add': `whitelist add ${request.playerName}`,
      'whitelist-remove': `whitelist remove ${request.playerName}`,
    };
    return commands[request.action];
  }

  private trackPlayersFromLog(serverId: string, line: string): void {
    const joined = line.match(/:\s*([A-Za-z0-9_]{1,16}) joined the game\b/);
    if (joined?.[1]) {
      this.setPlayerOnline(serverId, joined[1], true);
      return;
    }

    const left = line.match(/:\s*([A-Za-z0-9_]{1,16}) left the game\b/);
    if (left?.[1]) {
      this.setPlayerOnline(serverId, left[1], false);
      return;
    }

    const list = this.matchPlayerListResponse(line);
    if (list?.[1] !== undefined) {
      const names = list[1]
        .split(',')
        .map((name) => name.trim())
        .filter((name) => /^[A-Za-z0-9_]{1,16}$/.test(name));
      this.onlinePlayers.set(serverId, new Set(names.map((name) => name.toLowerCase())));
    }
  }

  private isPlayerListResponse(line: string): boolean {
    return this.matchPlayerListResponse(line) !== null;
  }

  private matchPlayerListResponse(line: string): RegExpMatchArray | null {
    return line.match(/There are \d+ of a max of \d+ players online:\s*(.*)$/i);
  }

  private setPlayerOnline(serverId: string, playerName: string, online: boolean): void {
    const players = this.onlinePlayers.get(serverId) ?? new Set<string>();
    const key = playerName.toLowerCase();
    if (online) {
      players.add(key);
    } else {
      players.delete(key);
    }
    this.onlinePlayers.set(serverId, players);
  }
}

interface UserCacheEntry {
  name?: string;
  uuid?: string;
  expiresOn?: string;
}

interface PlayerListEntry {
  name?: string;
  uuid?: string;
}

function normalizeUuid(uuid?: string): string | undefined {
  if (!uuid) return undefined;
  const compact = uuid.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) return uuid;
  return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5').toLowerCase();
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
