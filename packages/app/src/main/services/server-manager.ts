/**
 * ServerManager Service
 * 負責伺服器實例的 CRUD 操作與生命週期管理
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { promises as fs } from 'fs';
import { FileManager, ServerMetadata } from './file-manager';
import { ManagedServerRegistry } from './managed-server-registry';
import { SettingsService, DEFAULT_BACKUP_RETENTION, DEFAULT_RAM_MAX, DEFAULT_RAM_MIN, MAX_RAM_MB, MIN_RAM_MB, RAM_STEP_MB } from './settings-service';
import { JavaDetector } from './java-detector';
import { ConnectionDiagnosticsService } from './connection-diagnostics';
import { ImportRegistry, type ImportedServerRecord } from './import-registry';
import { ImportScanner } from './import-scanner';
import { ProcessManager, ProcessConfig } from './process-manager';
import { parseLogLevel, splitLogLines } from './log-parser';
import {
  findLumixManagedJvmArgument,
  isLumixManagedJvmArgument,
  normalizeJvmArguments,
} from '../../shared/jvm-args';
import {
  calculateNextBackupRun,
  createBackupId,
  DEFAULT_BACKUP_SETTINGS,
  normalizeBackupSettings,
  withNextBackupRun,
} from '../../shared/backup-utils';
import type {
  BackupFailureCode,
  BackupKind,
  ServerInstanceDto,
  ServerStatus,
  CreateServerRequest,
  DetectImportCandidateRequest,
  ImportCandidateDto,
  ImportServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  ServerPerformanceSample,
  LogLevel,
  ServerProperties,
  ConnectionInfoDto,
  PlayerActionRequest,
  PlayerDto,
  BackupInfoDto,
  BackupOperationContext,
  BackupOperationFailure,
  BackupPreflightResult,
  BackupSettings,
  BackupTrigger,
  GetRestorePreflightRequest,
  RestoreBackupRequest,
  RestoreBackupResult,
  UpdateBackupSettingsRequest,
  IpcError,
  AutoRestartSettings,
  ServerAutoRestartEvent,
} from '../../shared/ipc-types';
import { IpcErrorCode, formatIpcError, createIpcError } from '../../shared/ipc-types';

// ============================================================================
// Types
// ============================================================================

// 超時設定常數
const SERVER_STOP_TIMEOUT = 30000; // 30 秒
const SERVER_START_TIMEOUT = 300000; // 5 分鐘
const BACKUP_DIR_NAME = '.lumix-backups';
const BACKUP_METADATA_FILE = '.lumix-backup.json';
const MAX_TIMER_DELAY = 2147483647;
const AUTO_RESTART_DELAYS = [10000, 30000, 60000];
const AUTO_RESTART_STABLE_MS = 5 * 60 * 1000;
const RESTORE_STAGING_PREFIX = '.lumix-restore-staging-';
const RESTORE_ROLLBACK_PREFIX = '.lumix-restore-rollback-';
const BACKUP_EXCLUDED_LOCK_FILES = new Set(['session.lock']);
const RESTORE_FILE_NAMES = new Set([
  'server.properties',
  'ops.json',
  'whitelist.json',
  'banned-players.json',
  'banned-ips.json',
]);
const RESTORE_DIRECTORY_NAMES = new Set(['mods', 'plugins']);

class ServerManagerIpcError extends Error {
  constructor(public readonly ipcError: IpcError) {
    super(formatIpcError(ipcError));
    this.name = 'ServerManagerIpcError';
  }
}

export interface ServerManagerEvents {
  'status-changed': (event: ServerStatusEvent) => void;
  'log-entry': (event: ServerLogEvent) => void;
  'performance-sample': (event: ServerPerformanceSample) => void;
  'server-ready': (event: { serverId: string }) => void;
  'auto-restart': (event: ServerAutoRestartEvent) => void;
}

export interface ServerManagerConfig {
  fileManager: FileManager;
  importRegistry: ImportRegistry;
  importScanner: ImportScanner;
  processManager: ProcessManager;
  defaultJavaPath?: string;
  settingsService?: SettingsService;
  managedServerRegistry?: ManagedServerRegistry;
  javaDetector?: JavaDetector;
}

// ============================================================================
// ServerManager Class
// ============================================================================

export class ServerManager extends EventEmitter {
  private fileManager: FileManager;
  private importRegistry: ImportRegistry;
  private importScanner: ImportScanner;
  private processManager: ProcessManager;
  private connectionDiagnostics: ConnectionDiagnosticsService;
  private servers: Map<string, ServerInstanceDto> = new Map();
  private defaultJavaPath: string;
  private settingsService?: SettingsService;
  private managedServerRegistry?: ManagedServerRegistry;
  private javaDetector: JavaDetector;
  private workspaceSettings: import('../../shared/ipc-types').SettingsDto;
  private shuttingDown = false;
  private stopTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private serverReadyFlags: Set<string> = new Set(); // 追蹤已觸發 ready 事件的服務器
  private onlinePlayers: Map<string, Set<string>> = new Map();
  private pendingSilentListResponses: Map<string, number> = new Map();
  private backupTimers: Map<string, NodeJS.Timeout> = new Map();
  private restartAttempts: Map<string, number> = new Map();
  private restartTimers: Map<string, NodeJS.Timeout> = new Map();
  private restartStableTimers: Map<string, NodeJS.Timeout> = new Map();
  private startGenerations: Map<string, number> = new Map();
  private startOperations: Map<string, Promise<void>> = new Map();

  constructor(config: ServerManagerConfig) {
    super();
    this.fileManager = config.fileManager;
    this.importRegistry = config.importRegistry;
    this.importScanner = config.importScanner;
    this.processManager = config.processManager;
    this.connectionDiagnostics = new ConnectionDiagnosticsService();
    this.defaultJavaPath = config.defaultJavaPath || 'java';
    this.settingsService = config.settingsService;
    this.managedServerRegistry = config.managedServerRegistry;
    this.javaDetector = config.javaDetector ?? new JavaDetector();
    this.workspaceSettings = createFallbackSettings(this.fileManager.getServersPath());
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

  hasRunningServers(): boolean {
    return Array.from(this.servers.values()).some(
      (server) => server.status !== 'stopped' || this.processManager.isRunning(server.id)
    );
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
    await this.refreshWorkspaceSettings();
    const candidate = await this.importScanner.scan(request.directory);
    const trimmedName = request.name.trim();
    const resolvedDirectory = path.resolve(request.directory);
    const resolvedJarPath = request.launchJarPath ? path.resolve(request.launchJarPath) : undefined;
    const resolvedArgsFile = request.launchArgsFile ? path.resolve(request.launchArgsFile) : undefined;
    const resolvedUserJvmArgsFile = request.userJvmArgsFile ? path.resolve(request.userJvmArgsFile) : undefined;

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

    if (!resolvedJarPath && !resolvedArgsFile) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '必須選擇啟動 jar 或 Loader args file'
      )));
    }

    if (resolvedJarPath && !candidate.jarCandidates.includes(resolvedJarPath)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '選擇的啟動 jar 不在匯入資料夾中'
      )));
    }

    if (resolvedArgsFile && candidate.launchArgsFile !== resolvedArgsFile) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '選擇的 Loader args file 不在匯入資料夾中'
      )));
    }

    if (resolvedUserJvmArgsFile && candidate.userJvmArgsFile !== resolvedUserJvmArgsFile) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        '選擇的 JVM args file 不在匯入資料夾中'
      )));
    }

    const id = uuidv4();
    const ramMax = normalizeMemory(request.ramMax ?? this.workspaceSettings.defaultRamMax);
    const metadata: ImportedServerRecord = {
      id,
      name: trimmedName,
      origin: 'imported',
      directory: resolvedDirectory,
      coreType: request.coreType,
      mcVersion: request.mcVersion.trim(),
      ramMin: Math.floor(ramMax / 2),
      ramMax,
      jvmArgs: this.normalizeJvmArgs(request.jvmArgs),
      javaPath: request.javaPath,
      javaSelectionMode: request.javaSelectionMode ?? (request.javaPath ? 'custom' : 'auto'),
      launchJarPath: resolvedJarPath,
      launchArgsFile: resolvedArgsFile,
      userJvmArgsFile: resolvedUserJvmArgsFile,
      createdAt: new Date().toISOString(),
      eulaAccepted: request.eulaAccepted ?? candidate.eulaAccepted,
      backupSettings: this.createDefaultBackupSettings(),
      autoRestart: normalizeAutoRestart(request.autoRestart),
    };

    if (metadata.javaSelectionMode === 'custom') {
      await this.assertCompatibleJava(metadata.javaPath, metadata.mcVersion);
    }

    await this.importRegistry.save(metadata);

    const server = await this.refreshServerDerivedState(this.createServerDtoFromImportedRecord(metadata));
    this.servers.set(id, server);
    return server;
  }

  async createServer(request: CreateServerRequest): Promise<ServerInstanceDto> {
    await this.refreshWorkspaceSettings();
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

    if (await this.fileManager.serverExists(trimmedName, this.workspaceSettings.defaultServersPath)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_DUPLICATE_NAME,
        '伺服器目錄已存在'
      )));
    }

    const id = uuidv4();
    const serverPath = await this.fileManager.createServerDirectory(
      trimmedName,
      this.workspaceSettings.defaultServersPath
    );

    try {
      const metadata = this.buildMetadata(id, trimmedName, request);
      if (metadata.javaSelectionMode === 'custom') {
        await this.assertCompatibleJava(metadata.javaPath, metadata.mcVersion);
      }
      await this.writeServerFiles(serverPath, metadata);

      const server: ServerInstanceDto = {
        ...metadata,
        javaPath: metadata.javaPath || this.defaultJavaPath,
        javaSelectionMode: metadata.javaSelectionMode ?? 'auto',
        directory: serverPath,
        launchJarPath: metadata.launchJarPath,
        status: 'stopped',
        origin: 'managed',
        eulaAccepted: metadata.eulaAccepted,
      };

      const hydratedServer = await this.refreshServerDerivedState(server);
      this.servers.set(id, hydratedServer);
      await this.managedServerRegistry?.save({ id, directory: serverPath });
      return hydratedServer;
    } catch (error) {
      this.servers.delete(id);
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

    const runtimeChanged = request.javaPath !== undefined
      || request.javaSelectionMode !== undefined
      || request.jvmArgs !== undefined;
    if (runtimeChanged && server.status !== 'stopped') {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        '伺服器執行中時不能修改執行環境設定'
      )));
    }

    const javaSelectionMode = request.javaSelectionMode ?? server.javaSelectionMode;
    const javaPath = request.javaPath ?? server.javaPath;
    if (javaSelectionMode === 'custom') {
      if (!javaPath) {
        throw new Error(formatIpcError(createIpcError(
          IpcErrorCode.JAVA_NOT_FOUND,
          '自訂 Java 模式需要指定 Java 執行檔'
        )));
      }
      await this.assertCompatibleJava(javaPath, server.mcVersion);
    }

    const jvmArgs = request.jvmArgs !== undefined
      ? this.normalizeJvmArgs(request.jvmArgs)
      : server.jvmArgs;

    const backupSettings = request.backupSettings
      ? withNextBackupRun(normalizeBackupSettings(request.backupSettings))
      : server.backupSettings;

    const ramMax = normalizeMemory(request.ramMax ?? server.ramMax);
    const updatedServer: ServerInstanceDto = {
      ...server,
      name: request.name?.trim() ?? server.name,
      javaPath,
      javaSelectionMode,
      ramMin: Math.floor(ramMax / 2),
      ramMax,
      jvmArgs,
      launchJarPath: request.launchJarPath ?? server.launchJarPath,
      launchArgsFile: request.launchArgsFile ?? server.launchArgsFile,
      userJvmArgsFile: request.userJvmArgsFile ?? server.userJvmArgsFile,
      eulaAccepted: request.eulaAccepted ?? server.eulaAccepted,
      backupSettings,
      autoRestart: request.autoRestart
        ? normalizeAutoRestart(request.autoRestart)
        : normalizeAutoRestart(server.autoRestart),
      onboardingState: request.onboardingState ?? server.onboardingState,
    };

    if (updatedServer.autoRestart?.enabled === false) {
      this.clearAutoRestart(request.id, true);
    }

    if (backupSettings) {
      await this.pruneBackups(request.id, 'regular', backupSettings);
      await this.pruneBackups(request.id, 'pre-restore', backupSettings);
    }

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

    this.clearAutoRestart(id, true);

    if (server.status !== 'stopped' || this.processManager.isRunning(id)) {
      // 等待伺服器真正停止後再刪除
      await this.stopServerAndWait(id);
    }

    if (server.origin === 'imported') {
      await this.importRegistry.delete(id);
    } else {
      await this.fileManager.deleteServerDirectory(server.directory);
      await this.managedServerRegistry?.delete(id);
    }
    this.servers.delete(id);
    this.clearBackupTimer(id);
  }

  /**
   * 停止伺服器並等待程序真正結束
   */
  private async stopServerAndWait(id: string, timeoutMs: number = SERVER_STOP_TIMEOUT): Promise<void> {
    const pendingStart = this.startOperations.get(id);
    this.invalidateStart(id);

    if (!this.processManager.isRunning(id)) {
      if (pendingStart) {
        let waitTimer: NodeJS.Timeout | undefined;
        await Promise.race([
          pendingStart.catch(() => undefined),
          new Promise<void>((resolve) => {
            waitTimer = setTimeout(resolve, timeoutMs);
          }),
        ]);
        if (waitTimer) clearTimeout(waitTimer);
      }
      this.updateServerStatus(id, 'stopped');
      return;
    }

    await new Promise<void>((resolve) => {
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
        // forceKill 已送出後立即完成關閉流程；程序的 exit 事件仍會
        // 在背景清理狀態，避免安全退出額外超過 30 秒。
        resolve();
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
    this.clearAutoRestart(id, true);
    this.restartAttempts.delete(id);
    await this.startServerInternal(id, false);
  }

  private async startServerInternal(id: string, fromAutoRestart: boolean): Promise<void> {
    if (this.shuttingDown) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        'Lumix 正在關閉，已取消伺服器啟動'
      )));
    }

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

    const generation = this.beginStart(id);
    this.updateServerStatus(id, 'starting');

    const operation = this.runServerStart(id, server, generation, fromAutoRestart);
    this.startOperations.set(id, operation);
    try {
      await operation;
    } finally {
      if (this.startOperations.get(id) === operation) {
        this.startOperations.delete(id);
      }
    }
  }

  private async runServerStart(
    id: string,
    server: ServerInstanceDto,
    generation: number,
    fromAutoRestart: boolean
  ): Promise<void> {
    let processSpawned = false;
    let startTimeout: NodeJS.Timeout | undefined;

    try {
      const effectiveJavaPath = await this.resolveJavaPath(server);
      if (!this.canContinueStart(id, generation, fromAutoRestart)) return;

      if (server.javaPath !== effectiveJavaPath) {
        server.javaPath = effectiveJavaPath;
        this.servers.set(id, server);
        await this.persistServerUpdate(server);
        if (!this.canContinueStart(id, generation, fromAutoRestart)) return;
      }

      const jarPath = this.resolveLaunchJarPath(server);
      const loaderLaunch = await this.resolveLoaderLaunch(server);
      if (!this.canContinueStart(id, generation, fromAutoRestart)) return;

      // args-file Loader 不需要根目錄 server.jar。
      if (!loaderLaunch) {
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
      if (!this.canContinueStart(id, generation, fromAutoRestart)) return;

      // 清除舊的 stop timeout（避免誤殺新程序）
      const existingTimeout = this.stopTimeouts.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.stopTimeouts.delete(id);
      }

      // 設置啟動超時（5 分鐘）
      startTimeout = setTimeout(() => {
        if (this.servers.get(id)?.status === 'starting') {
          this.emitLogEntry(id, 'warn', '伺服器啟動超時（5 分鐘），可能啟動失敗');
        }
      }, SERVER_START_TIMEOUT);

      const processConfig: ProcessConfig = {
        serverId: id,
        javaPath: effectiveJavaPath,
        jarPath,
        workingDir: server.directory,
        ramMin: server.ramMin,
        ramMax: server.ramMax,
        jvmArgs: server.jvmArgs,
        loaderArgsFile: loaderLaunch?.argsFile,
        userJvmArgsFile: loaderLaunch?.userJvmArgsFile,
      };

      // Debug log
      this.emitLogEntry(id, 'info', `[DEBUG] Starting server with:`);
      this.emitLogEntry(id, 'info', `[DEBUG] Java: ${effectiveJavaPath}`);
      this.emitLogEntry(id, 'info', `[DEBUG] Working Dir: ${server.directory}`);
      this.emitLogEntry(id, 'info', `[DEBUG] JAR: ${jarPath}`);

      this.processManager.spawn(processConfig);
      processSpawned = true;
      await this.updateLastStartedAt(id);
      // A very short-lived process can emit exit/error while the metadata is
      // being persisted. Do not resurrect it as `running` after that event.
      if (!this.canContinueStart(id, generation, fromAutoRestart)) {
        const current = this.servers.get(id);
        if (current?.status === 'starting') {
          if (this.processManager.isRunning(id)) {
            this.updateServerStatus(id, 'running');
            this.scheduleBackup(id);
          } else {
            this.updateServerStatus(id, 'stopped');
          }
        }
        return;
      }
      this.updateServerStatus(id, 'running');
      this.scheduleBackup(id);
    } catch (error) {
      if (!this.canContinueStart(id, generation, fromAutoRestart)) {
        const current = this.servers.get(id);
        if (current?.status === 'starting') {
          if (processSpawned && this.processManager.isRunning(id)) {
            this.updateServerStatus(id, 'running');
            this.scheduleBackup(id);
          } else {
            this.updateServerStatus(id, 'stopped');
          }
        }
        return;
      }

      if (processSpawned && this.processManager.isRunning(id)) {
        this.processManager.kill(id);
      }
      this.updateServerStatus(id, 'stopped');
      throw error;
    } finally {
      if (startTimeout) clearTimeout(startTimeout);
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

    if (server.status === 'stopped' && !this.processManager.isRunning(id)) {
      this.clearAutoRestart(id, true);
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_INVALID_STATE,
        '伺服器已停止'
      )));
    }

    if (server.status === 'starting' && !this.processManager.isRunning(id)) {
      this.clearAutoRestart(id, true);
      this.updateServerStatus(id, 'stopped');
      return;
    }

    // 清除舊的 timeout（避免多個 timeout 同時存在）
    const existingTimeout = this.stopTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.stopTimeouts.delete(id);
    }

    this.clearAutoRestart(id, true);
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

    const normalizedCommand = command.trim().replace(/^\//, '').toLowerCase();
    if (normalizedCommand === 'stop') {
      this.clearAutoRestart(id, true);
      this.updateServerStatus(id, 'stopping');
    }

    this.emitLogEntry(id, 'info', `> ${command}`);
  }

  getPerformanceHistory(id: string): ServerPerformanceSample[] {
    if (!this.servers.has(id)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    return this.processManager.getPerformanceHistory(id);
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
          const metadata = JSON.parse(raw) as Omit<BackupInfoDto, 'sizeBytes'> & { kind?: BackupKind };
          return {
            ...metadata,
            kind: metadata.kind ?? 'regular',
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

  async createBackup(
    id: string,
    trigger: BackupTrigger = 'manual',
    kind: BackupKind = 'regular'
  ): Promise<BackupInfoDto> {
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
      } catch (error) {
        throw this.createBackupOperationError(
          this.mapBackupOperationFailure(error, 'backup', '建立備份時發生錯誤', backupPath)
        );
      } finally {
        this.processManager.writeStdin(id, 'save-on');
      }
    } else {
      try {
        await copyServer();
      } catch (error) {
        throw this.createBackupOperationError(
          this.mapBackupOperationFailure(error, 'backup', '建立備份時發生錯誤', backupPath)
        );
      }
    }

    const backup: BackupInfoDto = {
      id: backupId,
      serverId: id,
      name: `${server.name} ${createdAt.replace('T', ' ').slice(0, 19)}`,
      path: backupPath,
      createdAt,
      sizeBytes: await this.getDirectorySize(backupPath),
      trigger,
      kind,
      sourceServerState: server.status === 'running' ? 'running' : 'stopped',
    };

    await fs.writeFile(
      path.join(backupPath, BACKUP_METADATA_FILE),
      JSON.stringify(backup, null, 2),
      'utf-8'
    );
    await this.pruneBackups(id, kind);

    if (trigger === 'scheduled') {
      await this.markBackupRun(id, createdAt);
    }

    if (shouldNotifyOps) {
      await this.notifyOps(id, `Lumix 已完成伺服器備份: ${backup.name}`);
    }

    this.emitLogEntry(id, 'info', `已建立備份: ${backup.name}`);
    return backup;
  }

  async getRestoreBackupPreflight(request: GetRestorePreflightRequest): Promise<BackupPreflightResult> {
    const server = this.getExistingServer(request.serverId);
    const backup = await this.getBackupById(request.serverId, request.backupId);
    const warnings: string[] = [];
    const blockingIssues: BackupOperationFailure[] = [];

    if (server.status !== 'stopped') {
      blockingIssues.push(this.createBackupFailure(
        'SERVER_MUST_BE_STOPPED',
        '還原備份前請先停止伺服器。',
        'preflight',
        server.directory,
        undefined,
        '先停止伺服器，再重新開啟還原流程。'
      ));
    }

    const requiredEntries = await this.readBackupRestorableEntries(backup.path);
    const hasWorldData = requiredEntries.some((entry) => entry.name.startsWith('world'));
    const hasServerProperties = requiredEntries.some((entry) => entry.name === 'server.properties');
    if (!hasWorldData && !hasServerProperties) {
      blockingIssues.push(this.createBackupFailure(
        'CORRUPTED_BACKUP',
        '這份備份缺少世界資料與 server.properties，無法安全還原。',
        'preflight',
        backup.path,
        ['需要至少包含 world 資料夾或 server.properties。'],
        '改用另一份備份，或先檢查備份資料夾內容是否完整。'
      ));
    }

    const estimatedRestoreBytes = await this.getDirectorySize(backup.path);
    const freeSpaceBytes = await this.getFreeSpaceBytes(server.directory);
    if (freeSpaceBytes !== undefined && freeSpaceBytes < estimatedRestoreBytes) {
      blockingIssues.push(this.createBackupFailure(
        'INSUFFICIENT_DISK_SPACE',
        '磁碟可用空間不足，無法完成還原。',
        'preflight',
        server.directory,
        [
          `需要約 ${estimatedRestoreBytes} bytes`,
          `可用空間約 ${freeSpaceBytes} bytes`,
        ],
        '請先釋出磁碟空間，或移除不需要的檔案後再試一次。'
      ));
    }

    try {
      await fs.readdir(server.directory, { withFileTypes: true });
      await this.assertDirectoryWritable(server.directory);
    } catch (error) {
      blockingIssues.push(this.mapBackupOperationFailure(
        error,
        'preflight',
        '目前無法寫入伺服器資料夾，不能執行還原。',
        server.directory
      ));
    }

    if (!requiredEntries.some((entry) => entry.name === 'mods')) {
      warnings.push('這份備份不包含 mods 資料夾。');
    }

    if (!requiredEntries.some((entry) => entry.name === 'plugins')) {
      warnings.push('這份備份不包含 plugins 資料夾。');
    }

    const logsPath = path.join(backup.path, 'logs');
    const hasLogs = await fs.stat(logsPath).then(() => true).catch(() => false);
    if (!hasLogs) {
      warnings.push('這份備份不包含 logs。');
    }

    if (backup.sourceServerState === 'running') {
      warnings.push('這份備份建立時伺服器仍在運行中。');
    }

    return {
      canRun: blockingIssues.length === 0,
      requiresServerStop: server.status !== 'stopped',
      estimatedRestoreBytes,
      freeSpaceBytes,
      warnings,
      blockingIssues,
    };
  }

  async restoreBackup(request: RestoreBackupRequest): Promise<RestoreBackupResult> {
    const server = this.getExistingServer(request.serverId);
    const backup = await this.getBackupById(request.serverId, request.backupId);
    const preflight = await this.getRestoreBackupPreflight({
      serverId: request.serverId,
      backupId: request.backupId,
    });

    if (!preflight.canRun) {
      throw this.createBackupOperationError(
        preflight.blockingIssues[0] ?? this.createBackupFailure(
          'RESTORE_VALIDATION_FAILED',
          '還原前檢查失敗。',
          'restore',
          server.directory,
          preflight.warnings,
          '先處理上方問題，再重新嘗試還原。'
        ),
        IpcErrorCode.VALIDATION_ERROR
      );
    }

    let preRestoreBackupId: string | undefined;
    if (request.createPreRestoreBackup !== false) {
      try {
        const preRestoreBackup = await this.createBackup(request.serverId, 'manual', 'pre-restore');
        preRestoreBackupId = preRestoreBackup.id;
      } catch (error) {
        throw this.createBackupOperationError(
          this.mapBackupOperationFailure(
            error,
            'pre-restore-backup',
            '建立還原前備份失敗，已取消還原。',
            server.directory,
            'PRE_RESTORE_BACKUP_FAILED'
          ),
          IpcErrorCode.FS_WRITE_ERROR
        );
      }
    }

    const workspaceRoot = path.dirname(server.directory);
    const nonce = `${request.serverId}-${Date.now()}`;
    const stagingDir = path.join(workspaceRoot, `${RESTORE_STAGING_PREFIX}${nonce}`);
    const rollbackDir = path.join(workspaceRoot, `${RESTORE_ROLLBACK_PREFIX}${nonce}`);
    let stagedEntryNames: string[] = [];
    let preserveRollbackDir = false;

    try {
      await fs.mkdir(stagingDir, { recursive: true });
      await fs.mkdir(rollbackDir, { recursive: true });
      stagedEntryNames = await this.copyBackupContentsToRestoreStaging(backup.path, stagingDir);

      for (const name of stagedEntryNames) {
        const existingTarget = path.join(server.directory, name);
        if (await this.pathExists(existingTarget)) {
          await fs.rename(existingTarget, path.join(rollbackDir, name));
        }
      }

      for (const name of stagedEntryNames) {
        const source = path.join(stagingDir, name);
        const destination = path.join(server.directory, name);
        const stat = await fs.lstat(source);
        if (stat.isDirectory()) {
          await fs.cp(source, destination, { recursive: true });
        } else {
          await fs.copyFile(source, destination);
        }
      }
    } catch (error) {
      const rollbackFailure = await this.rollbackRestoreChanges(server.directory, rollbackDir, stagedEntryNames);
      const failure = this.mapBackupOperationFailure(
        error,
        'restore',
        '還原備份時發生錯誤。',
        backup.path
      );
      if (rollbackFailure) {
        preserveRollbackDir = true;
        failure.details = [
          ...(failure.details ?? []),
          `回復暫存資料夾保留於 ${rollbackDir}`,
        ];
        failure.suggestedAction = '還原途中失敗，且自動回復未完全成功。請先檢查 rollback 資料夾內容。';
      }
      throw this.createBackupOperationError(failure);
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
      if (!preserveRollbackDir) {
        await fs.rm(rollbackDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    const restoredServer: ServerInstanceDto = {
      ...server,
      directory: server.directory,
      status: 'stopped',
    };
    this.servers.set(request.serverId, restoredServer);
    await this.persistServerUpdate(restoredServer);
    this.scheduleBackup(request.serverId);
    this.emitLogEntry(request.serverId, 'info', `已還原備份: ${backup.name}`);
    return {
      restoredBackupId: backup.id,
      preRestoreBackupId,
      warnings: preflight.warnings,
    };
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
  // ===========================================================================

  async loadServers(): Promise<void> {
    await this.refreshWorkspaceSettings();

    const loadedIds = new Set<string>();
    const managedLocations = await this.managedServerRegistry?.list() ?? [];
    const importedServers = await this.importRegistry.list();

    for (const location of managedLocations) {
      try {
        const metadata = await this.fileManager.readServerJson(location.directory);
        const server = this.createServerDtoFromManagedMetadata(metadata, location.directory);
        this.servers.set(metadata.id, server);
        loadedIds.add(metadata.id);
        await this.persistMigratedManagedMetadata(metadata, server);
        this.startBackupSchedule(metadata.id);
      } catch {
        // Registry entries can outlive a manually removed server directory.
        console.warn(`無法載入受管理伺服器: ${location.directory}`);
      }
    }

    // First upgrade: discover the legacy userData/servers root and register
    // every server without moving its directory.
    const legacyEntries = await this.fileManager.discoverServerEntries([
      this.fileManager.getServersPath(),
    ]);
    for (const entry of legacyEntries) {
      const metadata = entry.metadata;
      if (loadedIds.has(metadata.id)) continue;
      const server = this.createServerDtoFromManagedMetadata(metadata, entry.directory);
      this.servers.set(metadata.id, server);
      loadedIds.add(metadata.id);
      await this.managedServerRegistry?.save({ id: metadata.id, directory: entry.directory });
      await this.persistMigratedManagedMetadata(metadata, server);
      this.startBackupSchedule(metadata.id);
    }

    for (const record of importedServers) {
      const server = this.createServerDtoFromImportedRecord(record);
      this.servers.set(record.id, server);
      await this.persistMigratedImportedRecord(record, server);
      this.startBackupSchedule(record.id);
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const id of this.servers.keys()) {
      this.clearAutoRestart(id, true);
    }

    const runningIds = Array.from(this.servers.values())
      .filter((server) => server.status !== 'stopped' || this.processManager.isRunning(server.id))
      .map((server) => server.id);

    await Promise.all(runningIds.map((id) => this.stopServerAndWait(id, SERVER_STOP_TIMEOUT)));
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    for (const id of this.startGenerations.keys()) {
      this.invalidateStart(id);
    }
    // 清除所有 stop timeouts
    for (const timeout of this.stopTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.stopTimeouts.clear();
    for (const timeout of this.backupTimers.values()) {
      clearTimeout(timeout);
    }
    this.backupTimers.clear();
    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    this.restartTimers.clear();
    for (const timer of this.restartStableTimers.values()) {
      clearTimeout(timer);
    }
    this.restartStableTimers.clear();
    this.startGenerations.clear();
    this.processManager.killAll();
  }

  private async persistMigratedManagedMetadata(
    metadata: ServerMetadata,
    server: ServerInstanceDto
  ): Promise<void> {
    const needsMigration = metadata.javaSelectionMode === undefined
      || metadata.autoRestart === undefined
      || metadata.ramMin !== server.ramMin
      || metadata.ramMax !== server.ramMax
      || JSON.stringify(metadata.jvmArgs ?? []) !== JSON.stringify(server.jvmArgs)
      || metadata.backupSettings?.regularRetention === undefined
      || metadata.backupSettings?.preRestoreRetention === undefined;
    if (!needsMigration) {
      await this.managedServerRegistry?.save({ id: server.id, directory: server.directory });
      return;
    }

    await this.fileManager.writeServerJson(server.directory, this.toManagedMetadata(server));
    await this.managedServerRegistry?.save({ id: server.id, directory: server.directory });
  }

  private async persistMigratedImportedRecord(
    record: ImportedServerRecord,
    server: ServerInstanceDto
  ): Promise<void> {
    const needsMigration = record.javaSelectionMode === undefined
      || record.autoRestart === undefined
      || record.ramMin !== server.ramMin
      || record.ramMax !== server.ramMax
      || JSON.stringify(record.jvmArgs ?? []) !== JSON.stringify(server.jvmArgs)
      || record.backupSettings?.regularRetention === undefined
      || record.backupSettings?.preRestoreRetention === undefined;
    if (needsMigration) {
      await this.importRegistry.save(this.toImportedRecord(server));
    }
  }

  private async refreshWorkspaceSettings(): Promise<void> {
    if (this.settingsService) {
      this.workspaceSettings = await this.settingsService.get();
    }
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

  async getConnectionInfo(id: string): Promise<ConnectionInfoDto> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.SERVER_NOT_FOUND,
        '找不到指定的伺服器'
      )));
    }

    const refreshed = await this.refreshServerDerivedState(server);
    this.servers.set(id, refreshed);

    const rawProperties = refreshed.hasServerProperties
      ? await this.fileManager.readServerPropertiesRaw(refreshed.directory)
      : {};

    return this.connectionDiagnostics.getConnectionInfo({
      serverId: refreshed.id,
      status: refreshed.status,
      hasServerProperties: refreshed.hasServerProperties === true,
      serverPortRaw: rawProperties['server-port'],
      serverIpRaw: rawProperties['server-ip'],
    });
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

    this.processManager.on('performance-sample', (sample: ServerPerformanceSample) => {
      this.emit('performance-sample', sample);
    });

    this.processManager.on('exit', (serverId: string, code: number | null) => {
      this.handleProcessExit(serverId, code);
    });

    this.processManager.on('error', (serverId: string, error: Error) => {
      const server = this.servers.get(serverId);
      if (!server || server.status === 'stopped') return;

      // A failed spawn can emit only `error` without an `exit` event. Treat it
      // as the same unexpected termination so automatic restart also covers
      // missing or non-executable Java paths.
      if (!this.shuttingDown && server.status !== 'stopping') {
        this.handleProcessExit(serverId, null);
        return;
      }

      this.emitLogEntry(serverId, 'error', `程序錯誤: ${error.message}`);
      if (server.status !== 'stopping') this.updateServerStatus(serverId, 'stopped');
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

    const existingStableTimer = this.restartStableTimers.get(serverId);
    if (existingStableTimer) clearTimeout(existingStableTimer);
    const stableTimer = setTimeout(() => {
      this.restartStableTimers.delete(serverId);
      if (this.servers.get(serverId)?.status === 'running') {
        this.restartAttempts.delete(serverId);
        this.emitLogEntry(serverId, 'info', '伺服器已穩定執行 5 分鐘，已重置自動重啟次數。');
      }
    }, AUTO_RESTART_STABLE_MS);
    this.restartStableTimers.set(serverId, stableTimer);
    
    // 發送事件通知前端顯示提示對話框
    this.emit('server-ready', { serverId });
  }

  private handleProcessExit(serverId: string, code: number | null): void {
    const server = this.servers.get(serverId);
    if (!server) return;
    if (server.status === 'stopped' && !this.processManager.isRunning(serverId)) return;

    const unexpected = !this.shuttingDown && server.status !== 'stopping';

    // 清除對應的 stop timeout，避免不必要的 forceKill
    const timeout = this.stopTimeouts.get(serverId);
    if (timeout) {
      clearTimeout(timeout);
      this.stopTimeouts.delete(serverId);
    }

    // 清除 ready 標誌，下次啟動時可以再次觸發
    this.serverReadyFlags.delete(serverId);
    this.clearStableRestartTimer(serverId);
    this.onlinePlayers.delete(serverId);
    this.pendingSilentListResponses.delete(serverId);
    this.clearBackupTimer(serverId);

    const event: ServerStatusEvent = {
      serverId,
      status: 'stopped',
      exitCode: code ?? undefined,
      unexpected,
      serverName: server.name,
      latestLogPath: path.join(server.directory, 'logs', 'latest.log'),
      serverDirectory: server.directory,
    };

    server.status = 'stopped';
    this.servers.set(serverId, server);
    this.emit('status-changed', event);
    this.emitLogEntry(
      serverId,
      unexpected ? 'error' : 'info',
      unexpected
        ? `伺服器非預期退出 (exit code: ${code ?? 'unknown'})，請檢查 logs/latest.log`
        : `伺服器已停止 (exit code: ${code ?? 'unknown'})`
    );

    if (unexpected) {
      this.scheduleAutoRestart(serverId);
    }
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

  private async resolveJavaPath(server: ServerInstanceDto): Promise<string> {
    if (server.javaSelectionMode === 'custom') {
      return this.assertCompatibleJava(server.javaPath, server.mcVersion);
    }

    const installations = await this.javaDetector.detectAll();
    const selected = await this.javaDetector.selectForMinecraft(installations, server.mcVersion);
    if (selected) return selected.path;

    // Keep the last successful path useful when a scan is temporarily unable
    // to enumerate the installation directory.
    if (server.javaPath) {
      try {
        return await this.assertCompatibleJava(server.javaPath, server.mcVersion);
      } catch {
        // Continue to the PATH fallback below.
      }
    }

    return this.assertCompatibleJava(this.defaultJavaPath, server.mcVersion);
  }

  private async assertCompatibleJava(javaPath: string | undefined, mcVersion: string): Promise<string> {
    if (!javaPath?.trim()) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.JAVA_NOT_FOUND,
        '找不到有效的 Java 安裝'
      )));
    }

    const result = await this.javaDetector.validateForMinecraft(javaPath, mcVersion);
    if (!result.compatible || !result.installation.isValid) {
      throw new Error(formatIpcError(createIpcError(
        result.installation.isValid ? IpcErrorCode.JAVA_INVALID_VERSION : IpcErrorCode.JAVA_NOT_FOUND,
        result.reason,
        { path: javaPath, requiredMajor: result.requiredMajor }
      )));
    }
    return result.installation.path;
  }

  private normalizeJvmArgs(args?: string[], rejectControlled = true): string[] {
    const normalized = normalizeJvmArguments(args);
    const controlled = findLumixManagedJvmArgument(normalized);
    if (controlled && rejectControlled) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        `JVM 參數由 Lumix 管理，不能使用：${controlled}`
      )));
    }
    return rejectControlled
      ? normalized
      : normalized.filter((arg) => !isLumixManagedJvmArgument(arg));
  }

  private scheduleAutoRestart(serverId: string): void {
    const server = this.servers.get(serverId);
    const settings = normalizeAutoRestart(server?.autoRestart);
    if (!server || !settings.enabled || this.shuttingDown) return;

    const attempt = (this.restartAttempts.get(serverId) ?? 0) + 1;
    if (attempt > settings.maxAttempts) {
      this.emitAutoRestartEvent(server, 'exhausted', attempt - 1, settings.maxAttempts);
      this.emitLogEntry(
        serverId,
        'error',
        `自動重啟已達上限（${settings.maxAttempts} 次），伺服器維持停止；請檢查 logs/latest.log。`
      );
      return;
    }

    this.restartAttempts.set(serverId, attempt);
    const oldTimer = this.restartTimers.get(serverId);
    if (oldTimer) clearTimeout(oldTimer);
    const delayMs = AUTO_RESTART_DELAYS[Math.min(attempt - 1, AUTO_RESTART_DELAYS.length - 1)]!;
    const nextRestartAt = new Date(Date.now() + delayMs).toISOString();
    this.emitAutoRestartEvent(server, 'scheduled', attempt, settings.maxAttempts, delayMs, nextRestartAt);
    this.emitLogEntry(serverId, 'warn', `伺服器將於 ${Math.ceil(delayMs / 1000)} 秒後自動重啟（第 ${attempt}/${settings.maxAttempts} 次）。`);

    const timer = setTimeout(() => {
      this.restartTimers.delete(serverId);
      const current = this.servers.get(serverId);
      if (!current || this.shuttingDown || !normalizeAutoRestart(current.autoRestart).enabled) return;

      this.startServerInternal(serverId, true).catch((error) => {
        const current = this.servers.get(serverId);
        if (
          !current
          || this.shuttingDown
          || current.status === 'running'
          || current.status === 'starting'
          || !normalizeAutoRestart(current.autoRestart).enabled
        ) {
          return;
        }
        this.emitLogEntry(serverId, 'error', `自動重啟啟動失敗：${formatErrorMessage(error)}`);
        this.scheduleAutoRestart(serverId);
      });
    }, Math.min(delayMs, MAX_TIMER_DELAY));
    this.restartTimers.set(serverId, timer);
  }

  cancelAutoRestart(id: string): void {
    const server = this.getExistingServer(id);
    const hadPending = this.restartTimers.has(id);
    const attempt = this.restartAttempts.get(id);
    const maxAttempts = normalizeAutoRestart(server.autoRestart).maxAttempts;
    this.clearAutoRestart(id, false);
    if (hadPending) {
      this.emitAutoRestartEvent(server, 'cancelled', attempt, maxAttempts);
      this.emitLogEntry(id, 'info', '已取消本次自動重啟；之後仍可依設定重新觸發。');
    }
  }

  private clearAutoRestart(id: string, emitCancelled: boolean): void {
    this.invalidateStart(id);
    const server = this.servers.get(id);
    const timer = this.restartTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(id);
      if (emitCancelled && server) {
        const settings = normalizeAutoRestart(server.autoRestart);
        this.emitAutoRestartEvent(server, 'cancelled', this.restartAttempts.get(id), settings.maxAttempts);
      }
    }
    this.clearStableRestartTimer(id);
    this.restartAttempts.delete(id);
  }

  private beginStart(id: string): number {
    const generation = (this.startGenerations.get(id) ?? 0) + 1;
    this.startGenerations.set(id, generation);
    return generation;
  }

  private invalidateStart(id: string): void {
    this.startGenerations.set(id, (this.startGenerations.get(id) ?? 0) + 1);
  }

  private canContinueStart(id: string, generation: number, fromAutoRestart: boolean): boolean {
    if (this.shuttingDown || this.startGenerations.get(id) !== generation) return false;
    const server = this.servers.get(id);
    if (!server || server.status !== 'starting') return false;
    return !fromAutoRestart || normalizeAutoRestart(server.autoRestart).enabled;
  }

  private clearStableRestartTimer(id: string): void {
    const timer = this.restartStableTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.restartStableTimers.delete(id);
    }
  }

  private emitAutoRestartEvent(
    server: ServerInstanceDto,
    type: ServerAutoRestartEvent['type'],
    attempt: number | undefined,
    maxAttempts: number,
    delayMs?: number,
    nextRestartAt?: string
  ): void {
    this.emit('auto-restart', {
      serverId: server.id,
      type,
      attempt,
      maxAttempts,
      delayMs,
      nextRestartAt,
      serverName: server.name,
      latestLogPath: path.join(server.directory, 'logs', 'latest.log'),
      serverDirectory: server.directory,
    } satisfies ServerAutoRestartEvent);
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

  private async resolveLoaderLaunch(
    server: ServerInstanceDto
  ): Promise<{ argsFile: string; userJvmArgsFile?: string } | undefined> {
    if (server.launchArgsFile) {
      return this.validateLoaderLaunchPaths(
        server.directory,
        server.launchArgsFile,
        server.userJvmArgsFile
      );
    }

    const loaderConfig = await this.readJsonIfExists(path.join(server.directory, 'loader-config.json'));
    if (loaderConfig?.type === 'args-file' && typeof loaderConfig.argsFile === 'string') {
      return this.validateLoaderLaunchPaths(
        server.directory,
        loaderConfig.argsFile,
        typeof loaderConfig.userJvmArgsFile === 'string' ? loaderConfig.userJvmArgsFile : undefined
      );
    }

    const legacyForgeConfig = await this.readJsonIfExists(path.join(server.directory, 'forge-config.json'));
    if (legacyForgeConfig?.type === 'forge-new' && typeof legacyForgeConfig.argsFile === 'string') {
      return this.validateLoaderLaunchPaths(
        server.directory,
        legacyForgeConfig.argsFile,
        typeof legacyForgeConfig.userJvmArgsFile === 'string'
          ? legacyForgeConfig.userJvmArgsFile
          : 'user_jvm_args.txt'
      );
    }

    return undefined;
  }

  private async validateLoaderLaunchPaths(
    serverDirectory: string,
    argsFile: string,
    userJvmArgsFile?: string
  ): Promise<{ argsFile: string; userJvmArgsFile?: string }> {
    const safeArgsFile = this.resolveContainedServerPath(serverDirectory, argsFile);
    await this.assertLoaderFile(safeArgsFile);

    let safeUserJvmArgsFile: string | undefined;
    if (userJvmArgsFile) {
      safeUserJvmArgsFile = this.resolveContainedServerPath(serverDirectory, userJvmArgsFile);
      await this.assertLoaderFile(safeUserJvmArgsFile);
    }

    return {
      argsFile: path.relative(serverDirectory, safeArgsFile),
      userJvmArgsFile: safeUserJvmArgsFile
        ? path.relative(serverDirectory, safeUserJvmArgsFile)
        : undefined,
    };
  }

  private async assertLoaderFile(filePath: string): Promise<void> {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        'Loader 啟動路徑不是檔案',
        { path: filePath }
      )));
    }
  }

  private resolveContainedServerPath(serverDirectory: string, candidate: string): string {
    const resolvedDirectory = path.resolve(serverDirectory);
    const resolvedCandidate = path.isAbsolute(candidate)
      ? path.resolve(candidate)
      : path.resolve(resolvedDirectory, candidate);
    const relative = path.relative(resolvedDirectory, resolvedCandidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.VALIDATION_ERROR,
        'Loader 啟動檔案不在伺服器目錄內',
        { path: candidate }
      )));
    }
    return resolvedCandidate;
  }

  private async readJsonIfExists(filePath: string): Promise<Record<string, unknown> | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      if (error instanceof SyntaxError) return undefined;
      throw error;
    }
  }

  private buildMetadata(id: string, name: string, request: CreateServerRequest): ServerMetadata {
    const ramMax = normalizeMemory(request.ramMax ?? this.workspaceSettings.defaultRamMax);
    const jvmArgs = this.normalizeJvmArgs(request.jvmArgs);

    return {
      id,
      name,
      origin: 'managed',
      coreType: request.coreType,
      mcVersion: request.mcVersion,
      ramMin: Math.floor(ramMax / 2),
      ramMax,
      jvmArgs,
      javaPath: request.javaPath,
      javaSelectionMode: request.javaSelectionMode ?? (request.javaPath ? 'custom' : 'auto'),
      launchJarPath: 'server.jar',
      createdAt: new Date().toISOString(),
      eulaAccepted: true,
      backupSettings: this.createDefaultBackupSettings(),
      autoRestart: normalizeAutoRestart(),
      onboardingState: {
        completedSteps: [],
      },
    };
  }

  private async writeServerFiles(serverPath: string, metadata: ServerMetadata): Promise<void> {
    await this.fileManager.writeEula(serverPath);
    if (metadata.coreType !== 'forge' && metadata.coreType !== 'neoforge') {
      await this.fileManager.writeRunBat(serverPath, {
        javaPath: metadata.javaPath || this.defaultJavaPath,
        jarPath: metadata.launchJarPath,
        ramMin: metadata.ramMin,
        ramMax: metadata.ramMax,
        jvmArgs: metadata.jvmArgs,
      });
    }
    await this.fileManager.writeServerJson(serverPath, metadata);
  }

  private createDefaultBackupSettings(): BackupSettings {
    return normalizeBackupSettings({
      ...DEFAULT_BACKUP_SETTINGS,
      regularRetention: this.workspaceSettings.defaultRegularBackupRetention ?? DEFAULT_BACKUP_RETENTION,
      preRestoreRetention: this.workspaceSettings.defaultPreRestoreBackupRetention ?? DEFAULT_BACKUP_RETENTION,
    });
  }

  private async persistServerUpdate(server: ServerInstanceDto): Promise<void> {
    if (server.origin === 'imported') {
      await this.importRegistry.save(this.toImportedRecord(server));
      return;
    }

    const metadata = this.toManagedMetadata(server);
    await this.fileManager.writeServerJson(server.directory, metadata);
    const loaderLaunch = await this.resolveLoaderLaunch(server);
    await this.fileManager.writeRunBat(server.directory, {
      javaPath: server.javaPath,
      jarPath: server.launchJarPath,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
      loaderArgsFile: loaderLaunch?.argsFile,
      userJvmArgsFile: loaderLaunch?.userJvmArgsFile,
    });
  }

  private async updateLastStartedAt(id: string): Promise<void> {
    const server = this.servers.get(id)!;
    server.lastStartedAt = new Date().toISOString();
    this.servers.set(id, server);
    await this.persistServerUpdate(server);
  }

  private createServerDtoFromManagedMetadata(metadata: ServerMetadata, directory: string): ServerInstanceDto {
    const javaSelectionMode = metadata.javaSelectionMode ?? (metadata.javaPath ? 'custom' : 'auto');
    const ramMax = normalizeMemory(metadata.ramMax ?? this.workspaceSettings.defaultRamMax);
    const ramMin = Math.floor(ramMax / 2);
    return {
      id: metadata.id,
      name: metadata.name,
      origin: 'managed',
      coreType: metadata.coreType,
      mcVersion: metadata.mcVersion,
      javaPath: metadata.javaPath || this.defaultJavaPath,
      javaSelectionMode,
      ramMin,
      ramMax,
      jvmArgs: this.normalizeJvmArgs(metadata.jvmArgs, false),
      directory,
      launchJarPath: metadata.launchJarPath,
      launchArgsFile: metadata.launchArgsFile,
      userJvmArgsFile: metadata.userJvmArgsFile,
      status: 'stopped',
      createdAt: metadata.createdAt,
      lastStartedAt: metadata.lastStartedAt,
      eulaAccepted: metadata.eulaAccepted,
      backupSettings: normalizeBackupSettings(metadata.backupSettings),
      autoRestart: normalizeAutoRestart(metadata.autoRestart),
      onboardingState: metadata.onboardingState,
    };
  }

  private createServerDtoFromImportedRecord(record: ImportedServerRecord): ServerInstanceDto {
    const javaSelectionMode = record.javaSelectionMode ?? (record.javaPath ? 'custom' : 'auto');
    const ramMax = normalizeMemory(record.ramMax ?? this.workspaceSettings.defaultRamMax);
    const ramMin = Math.floor(ramMax / 2);
    return {
      id: record.id,
      name: record.name,
      origin: 'imported',
      coreType: record.coreType,
      mcVersion: record.mcVersion,
      javaPath: record.javaPath || this.defaultJavaPath,
      javaSelectionMode,
      ramMin,
      ramMax,
      jvmArgs: this.normalizeJvmArgs(record.jvmArgs, false),
      directory: record.directory,
      launchJarPath: record.launchJarPath,
      launchArgsFile: record.launchArgsFile,
      userJvmArgsFile: record.userJvmArgsFile,
      status: 'stopped',
      createdAt: record.createdAt,
      lastStartedAt: record.lastStartedAt,
      eulaAccepted: record.eulaAccepted,
      backupSettings: normalizeBackupSettings(record.backupSettings),
      autoRestart: normalizeAutoRestart(record.autoRestart),
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
      javaSelectionMode: server.javaSelectionMode,
      launchJarPath: server.launchJarPath,
      launchArgsFile: server.launchArgsFile,
      userJvmArgsFile: server.userJvmArgsFile,
      createdAt: server.createdAt,
      lastStartedAt: server.lastStartedAt,
      eulaAccepted: server.eulaAccepted,
      backupSettings: server.backupSettings,
      autoRestart: server.autoRestart,
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
      javaSelectionMode: server.javaSelectionMode,
      launchJarPath: server.launchJarPath,
      launchArgsFile: server.launchArgsFile,
      userJvmArgsFile: server.userJvmArgsFile,
      createdAt: server.createdAt,
      lastStartedAt: server.lastStartedAt,
      eulaAccepted: server.eulaAccepted,
      backupSettings: server.backupSettings,
      autoRestart: server.autoRestart,
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

  private createBackupOperationError(
    failure: BackupOperationFailure,
    ipcCode: typeof IpcErrorCode[keyof typeof IpcErrorCode] = IpcErrorCode.FS_WRITE_ERROR
  ): ServerManagerIpcError {
    return new ServerManagerIpcError(
      createIpcError(ipcCode, failure.message, { backupFailure: failure })
    );
  }

  private createBackupFailure(
    code: BackupFailureCode,
    message: string,
    context: BackupOperationContext,
    failurePath?: string,
    details?: string[],
    suggestedAction?: string
  ): BackupOperationFailure {
    return {
      code,
      message,
      context,
      path: failurePath,
      details,
      suggestedAction,
    };
  }

  private mapBackupOperationFailure(
    error: unknown,
    context: BackupOperationContext,
    fallbackMessage: string,
    failurePath?: string,
    overrideCode?: BackupFailureCode
  ): BackupOperationFailure {
    if (
      error &&
      typeof error === 'object' &&
      'ipcError' in error &&
      (error as { ipcError?: IpcError }).ipcError?.details?.backupFailure
    ) {
      return (error as { ipcError: IpcError }).ipcError.details?.backupFailure as BackupOperationFailure;
    }

    const nodeError = error as NodeJS.ErrnoException | undefined;
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;
    const message = rawMessage.includes(': ') ? rawMessage.split(': ').slice(1).join(': ') : rawMessage;

    let code: BackupFailureCode = overrideCode ?? 'UNKNOWN';
    let suggestedAction = '請再試一次，若問題持續發生，請檢查備份資料夾與伺服器資料夾權限。';

    if (!overrideCode) {
      if (nodeError?.code === 'ENOENT') {
        code = 'MISSING_SOURCE_PATH';
        suggestedAction = '請確認備份資料夾或伺服器資料夾仍然存在。';
      } else if (nodeError?.code === 'EACCES' || nodeError?.code === 'EPERM') {
        code = 'PERMISSION_DENIED';
        suggestedAction = '請確認 Lumix 對相關資料夾有讀寫權限，或以較高權限重新執行。';
      } else if (/busy|lock|locked|used by another process|resource busy/i.test(rawMessage)) {
        code = 'FILE_LOCKED';
        suggestedAction = '請先關閉占用檔案的程式或確認伺服器程序已完全停止。';
      }
    }

    return this.createBackupFailure(
      code,
      message || fallbackMessage,
      context,
      failurePath,
      undefined,
      suggestedAction
    );
  }

  private shouldIncludeInBackup(serverDirectory: string, source: string, settings?: BackupSettings): boolean {
    const relativePath = path.relative(serverDirectory, source);
    if (!relativePath) return true;
    const parts = relativePath.split(path.sep);
    if (parts.includes(BACKUP_DIR_NAME)) return false;
    if (parts.some((part) => part.startsWith(RESTORE_STAGING_PREFIX) || part.startsWith(RESTORE_ROLLBACK_PREFIX))) return false;
    if (path.basename(source) === BACKUP_METADATA_FILE) return false;
    if (BACKUP_EXCLUDED_LOCK_FILES.has(path.basename(source))) return false;
    if (!settings?.includeLogs && (parts.includes('logs') || source.endsWith('.log'))) return false;
    return true;
  }

  private async getBackupById(serverId: string, backupId: string): Promise<BackupInfoDto> {
    const backups = await this.listBackups(serverId);
    const backup = backups.find((item) => item.id === backupId);
    if (!backup) {
      throw this.createBackupOperationError(
        this.createBackupFailure(
          'MISSING_SOURCE_PATH',
          '找不到指定的備份。',
          'preflight',
          path.join(this.getBackupRoot(this.getExistingServer(serverId).directory), backupId),
          undefined,
          '請確認備份仍存在於清單中，或重新整理後再試一次。'
        ),
        IpcErrorCode.FS_READ_ERROR
      );
    }
    return backup;
  }

  private async getFreeSpaceBytes(targetPath: string): Promise<number | undefined> {
    try {
      const stat = await fs.statfs(targetPath);
      return stat.bavail * stat.bsize;
    } catch {
      return undefined;
    }
  }

  private async assertDirectoryWritable(directory: string): Promise<void> {
    const probePath = path.join(directory, `.lumix-write-check-${Date.now()}.tmp`);
    await fs.writeFile(probePath, 'ok', 'utf-8');
    await fs.rm(probePath, { force: true });
  }

  private async readBackupRestorableEntries(backupPath: string) {
    const entries = await fs.readdir(backupPath, { withFileTypes: true });
    return entries.filter((entry) => this.shouldRestoreEntry(entry.name, entry.isDirectory()));
  }

  private shouldRestoreEntry(name: string, isDirectory: boolean): boolean {
    if (name === BACKUP_METADATA_FILE || name === BACKUP_DIR_NAME) return false;
    if (name === 'logs') return false;
    if (name.startsWith(RESTORE_STAGING_PREFIX) || name.startsWith(RESTORE_ROLLBACK_PREFIX)) return false;
    if (name.startsWith('world')) return true;
    if (RESTORE_FILE_NAMES.has(name)) return true;
    if (isDirectory && RESTORE_DIRECTORY_NAMES.has(name)) return true;
    return false;
  }

  private async copyBackupContentsToRestoreStaging(backupPath: string, stagingDir: string): Promise<string[]> {
    const entries = await this.readBackupRestorableEntries(backupPath);
    const stagedEntryNames: string[] = [];

    for (const entry of entries) {
      const source = path.join(backupPath, entry.name);
      const destination = path.join(stagingDir, entry.name);
      if (entry.isDirectory()) {
        await fs.cp(source, destination, { recursive: true });
      } else if (entry.isFile()) {
        await fs.copyFile(source, destination);
      }
      stagedEntryNames.push(entry.name);
    }

    return stagedEntryNames;
  }

  private async rollbackRestoreChanges(
    serverDirectory: string,
    rollbackDir: string,
    stagedEntryNames: string[]
  ): Promise<boolean> {
    try {
      await Promise.allSettled(
        stagedEntryNames.map((name) => fs.rm(path.join(serverDirectory, name), { recursive: true, force: true }))
      );

      const rollbackEntries = await fs.readdir(rollbackDir, { withFileTypes: true });
      for (const entry of rollbackEntries) {
        await fs.rename(path.join(rollbackDir, entry.name), path.join(serverDirectory, entry.name));
      }

      return false;
    } catch {
      return true;
    }
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
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
        try {
          await fs.cp(source, destination, {
            recursive: true,
            filter: (currentSource) => this.shouldIncludeInBackup(serverDirectory, currentSource, settings),
          });
        } catch (error) {
          if (this.canIgnoreLiveBackupLockError(error, source)) return;
          throw error;
        }
        return;
      }

      if (entry.isFile()) {
        try {
          await fs.copyFile(source, destination);
        } catch (error) {
          if (this.canIgnoreLiveBackupLockError(error, source)) return;
          throw error;
        }
      }
    }));
  }

  private canIgnoreLiveBackupLockError(error: unknown, sourcePath: string): boolean {
    const nodeError = error as NodeJS.ErrnoException | undefined;
    const baseName = path.basename(sourcePath);
    if (!BACKUP_EXCLUDED_LOCK_FILES.has(baseName)) return false;

    return (
      nodeError?.code === 'EBUSY' ||
      nodeError?.code === 'EPERM' ||
      nodeError?.code === 'EACCES' ||
      /busy|lock|locked|used by another process|resource busy/i.test(nodeError?.message ?? '')
    );
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

  private async pruneBackups(
    serverId: string,
    kind: BackupKind,
    overrideSettings?: BackupSettings
  ): Promise<void> {
    const backups = await this.listBackups(serverId);
    const server = this.getExistingServer(serverId);
    const settings = normalizeBackupSettings(overrideSettings ?? server.backupSettings);
    const limit = kind === 'pre-restore'
      ? settings.preRestoreRetention ?? DEFAULT_BACKUP_RETENTION
      : settings.regularRetention ?? DEFAULT_BACKUP_RETENTION;
    const staleBackups = backups.filter((backup) => backup.kind === kind).slice(limit);
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

function normalizeMemory(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_RAM_MAX;
  return Math.min(MAX_RAM_MB, Math.max(MIN_RAM_MB, Math.round(numeric / RAM_STEP_MB) * RAM_STEP_MB));
}

function normalizeAutoRestart(value?: Partial<AutoRestartSettings>): AutoRestartSettings {
  const maxAttempts = typeof value?.maxAttempts === 'number'
    ? Math.round(value.maxAttempts)
    : Number(value?.maxAttempts);
  return {
    enabled: value?.enabled === true,
    maxAttempts: Number.isFinite(maxAttempts)
      ? Math.min(10, Math.max(1, maxAttempts))
      : 3,
  };
}

function createFallbackSettings(defaultServersPath: string): import('../../shared/ipc-types').SettingsDto {
  return {
    theme: 'system',
    language: 'zh-TW',
    defaultRamMin: DEFAULT_RAM_MIN,
    defaultRamMax: DEFAULT_RAM_MAX,
    autoCheckUpdate: true,
    autoUpdate: true,
    launchAtLogin: false,
    startMinimized: true,
    restoreLastSession: true,
    closeBehavior: 'minimize-to-tray',
    defaultServersPath: path.resolve(defaultServersPath),
    defaultRegularBackupRetention: DEFAULT_BACKUP_RETENTION,
    defaultPreRestoreBackupRetention: DEFAULT_BACKUP_RETENTION,
    javaInstallations: [],
  };
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
