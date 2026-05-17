/**
 * Server IPC Handlers
 * 連接 ServerManager 到 IPC 通道，處理前端請求與事件轉發
 */

import { ipcMain, BrowserWindow } from 'electron';
import { ServerChannels, getAllServerChannels } from '../../shared/ipc-channels';
import { ServerManager } from '../services/server-manager';
import type {
  IpcResult,
  ServerInstanceDto,
  CreateServerRequest,
  DetectImportCandidateRequest,
  ImportCandidateDto,
  ImportServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  ServerReadyEvent,
  ConnectionInfoDto,
  ServerProperties,
  UpdateServerPropertiesRequest,
  PlayerActionRequest,
  PlayerDto,
  BackupInfoDto,
  BackupPreflightResult,
  CreateBackupRequest,
  GetRestorePreflightRequest,
  RestoreBackupRequest,
  RestoreBackupResult,
  UpdateBackupSettingsRequest,
} from '../../shared/ipc-types';
import { parseIpcError, type IpcError } from '../../shared/ipc-types';

// ============================================================================
// Module State
// ============================================================================

let serverManager: ServerManager | null = null;

// ============================================================================
// Initialization
// ============================================================================

export function initServerHandlers(manager: ServerManager): void {
  serverManager = manager;
  registerHandlers();
  setupEventForwarding();
}

// ============================================================================
// Handler Registration
// ============================================================================

function registerHandlers(): void {
  // GET_ALL - 取得所有伺服器
  ipcMain.handle(
    ServerChannels.GET_ALL,
    async (): Promise<IpcResult<ServerInstanceDto[]>> => {
      try {
        const servers = await serverManager!.getAllServers();
        return { success: true, data: servers };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_BY_ID - 取得單一伺服器
  ipcMain.handle(
    ServerChannels.GET_BY_ID,
    async (_, id: string): Promise<IpcResult<ServerInstanceDto>> => {
      try {
        const server = await serverManager!.getServerById(id);
        if (!server) {
          return { success: false, error: 'NOT_FOUND: 找不到指定的伺服器' };
        }
        return { success: true, data: server };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // CREATE - 建立伺服器
  ipcMain.handle(
    ServerChannels.CREATE,
    async (_, data: CreateServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
      try {
        // 如果沒有指定 javaPath，自動選擇合適的 Java 版本
        let effectiveData = data;
        if (!data.javaPath) {
          // 動態 import JavaDetector 以避免循環依賴
          const { JavaDetector } = await import('../services/java-detector');
          const javaDetector = new JavaDetector();
          
          // 偵測所有 Java 安裝
          const installations = await javaDetector.detectAll();
          
          // 根據 MC 版本選擇合適的 Java
          const selectedJava = await javaDetector.selectForMinecraft(installations, data.mcVersion);
          
          if (selectedJava) {
            effectiveData = { ...data, javaPath: selectedJava.path };
          } else {
            console.warn(`[ServerHandlers] No suitable Java found for MC ${data.mcVersion}, will use system default`);
          }
        }
        
        const server = await serverManager!.createServer(effectiveData);
        return { success: true, data: server };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  ipcMain.handle(
    ServerChannels.DETECT_IMPORT_CANDIDATE,
    async (_, data: DetectImportCandidateRequest): Promise<IpcResult<ImportCandidateDto>> => {
      try {
        const candidate = await serverManager!.detectImportCandidate(data);
        return { success: true, data: candidate };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  ipcMain.handle(
    ServerChannels.IMPORT_EXISTING,
    async (_, data: ImportServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
      try {
        let effectiveData = data;
        if (!data.javaPath) {
          const { JavaDetector } = await import('../services/java-detector');
          const javaDetector = new JavaDetector();
          const installations = await javaDetector.detectAll();
          const selectedJava = await javaDetector.selectForMinecraft(installations, data.mcVersion);
          if (selectedJava) {
            effectiveData = { ...data, javaPath: selectedJava.path };
          }
        }

        const server = await serverManager!.importExistingServer(effectiveData);
        return { success: true, data: server };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // UPDATE - 更新伺服器
  ipcMain.handle(
    ServerChannels.UPDATE,
    async (_, data: UpdateServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
      try {
        const server = await serverManager!.updateServer(data);
        return { success: true, data: server };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // DELETE - 刪除伺服器
  ipcMain.handle(
    ServerChannels.DELETE,
    async (_, id: string): Promise<IpcResult<void>> => {
      try {
        await serverManager!.deleteServer(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // START - 啟動伺服器
  ipcMain.handle(
    ServerChannels.START,
    async (_, id: string): Promise<IpcResult<void>> => {
      try {
        await serverManager!.startServer(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // STOP - 停止伺服器
  ipcMain.handle(
    ServerChannels.STOP,
    async (_, id: string): Promise<IpcResult<void>> => {
      try {
        await serverManager!.stopServer(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // SEND_COMMAND - 發送指令
  ipcMain.handle(
    ServerChannels.SEND_COMMAND,
    async (_, id: string, command: string): Promise<IpcResult<void>> => {
      try {
        await serverManager!.sendCommand(id, command);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_PLAYERS - 取得玩家清單與管理狀態
  ipcMain.handle(
    ServerChannels.GET_PLAYERS,
    async (_, id: string): Promise<IpcResult<PlayerDto[]>> => {
      try {
        const players = await serverManager!.getPlayers(id);
        return { success: true, data: players };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // PLAYER_ACTION - 對玩家執行管理指令
  ipcMain.handle(
    ServerChannels.PLAYER_ACTION,
    async (_, data: PlayerActionRequest): Promise<IpcResult<void>> => {
      try {
        await serverManager!.performPlayerAction(data);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // LIST_BACKUPS - 取得備份清單
  ipcMain.handle(
    ServerChannels.LIST_BACKUPS,
    async (_, id: string): Promise<IpcResult<BackupInfoDto[]>> => {
      try {
        const backups = await serverManager!.listBackups(id);
        return { success: true, data: backups };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // CREATE_BACKUP - 建立手動或排程備份
  ipcMain.handle(
    ServerChannels.CREATE_BACKUP,
    async (_, data: CreateBackupRequest): Promise<IpcResult<BackupInfoDto>> => {
      try {
        const backup = await serverManager!.createBackup(data.serverId, data.trigger);
        return { success: true, data: backup };
      } catch (error) {
        return createErrorResult(error);
      }
    }
  );

  ipcMain.handle(
    ServerChannels.GET_RESTORE_BACKUP_PREFLIGHT,
    async (_, data: GetRestorePreflightRequest): Promise<IpcResult<BackupPreflightResult>> => {
      try {
        const preflight = await serverManager!.getRestoreBackupPreflight(data);
        return { success: true, data: preflight };
      } catch (error) {
        return createErrorResult(error);
      }
    }
  );

  // RESTORE_BACKUP - 還原指定備份
  ipcMain.handle(
    ServerChannels.RESTORE_BACKUP,
    async (_, data: RestoreBackupRequest): Promise<IpcResult<RestoreBackupResult>> => {
      try {
        const result = await serverManager!.restoreBackup(data);
        return { success: true, data: result };
      } catch (error) {
        return createErrorResult(error);
      }
    }
  );

  // DELETE_BACKUP - 刪除指定備份
  ipcMain.handle(
    ServerChannels.DELETE_BACKUP,
    async (_, serverId: string, backupId: string): Promise<IpcResult<void>> => {
      try {
        await serverManager!.deleteBackup(serverId, backupId);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // UPDATE_BACKUP_SETTINGS - 更新自動備份設定
  ipcMain.handle(
    ServerChannels.UPDATE_BACKUP_SETTINGS,
    async (_, data: UpdateBackupSettingsRequest): Promise<IpcResult<ServerInstanceDto>> => {
      try {
        const server = await serverManager!.updateBackupSettings(data);
        return { success: true, data: server };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_PROPERTIES - 取得伺服器屬性
  ipcMain.handle(
    ServerChannels.GET_CONNECTION_INFO,
    async (_, id: string): Promise<IpcResult<ConnectionInfoDto>> => {
      try {
        const connectionInfo = await serverManager!.getConnectionInfo(id);
        return { success: true, data: connectionInfo };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  ipcMain.handle(
    ServerChannels.GET_PROPERTIES,
    async (_, id: string): Promise<IpcResult<ServerProperties>> => {
      try {
        const properties = await serverManager!.getServerProperties(id);
        return { success: true, data: properties };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_PROPERTIES_RAW - 取得伺服器屬性原始內容
  ipcMain.handle(
    ServerChannels.GET_PROPERTIES_RAW,
    async (_, id: string): Promise<IpcResult<Record<string, string>>> => {
      try {
        const properties = await serverManager!.getServerPropertiesRaw(id);
        return { success: true, data: properties };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // UPDATE_PROPERTIES - 更新伺服器屬性
  ipcMain.handle(
    ServerChannels.UPDATE_PROPERTIES,
    async (_, data: UpdateServerPropertiesRequest): Promise<IpcResult<ServerProperties>> => {
      try {
        const properties = await serverManager!.updateServerProperties(data.id, data.properties);
        return { success: true, data: properties };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );
}

// ============================================================================
// Event Forwarding
// ============================================================================

function setupEventForwarding(): void {
  if (!serverManager) return;

  // 轉發狀態變更事件到所有視窗
  serverManager.on('status-changed', (event: ServerStatusEvent) => {
    broadcastToAllWindows(ServerChannels.STATUS_CHANGED, event);
  });

  // 轉發日誌事件到所有視窗
  serverManager.on('log-entry', (event: ServerLogEvent) => {
    broadcastToAllWindows(ServerChannels.LOG_ENTRY, event);
  });

  // 轉發服務器就緒事件到所有視窗
  serverManager.on('server-ready', (event: ServerReadyEvent) => {
    broadcastToAllWindows(ServerChannels.READY, event);
  });
}

function broadcastToAllWindows(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupServerHandlers(): void {
  // 移除所有 IPC handlers（避免 hot reload 重複註冊）
  for (const channel of getAllServerChannels()) {
    ipcMain.removeHandler(channel);
  }

  if (serverManager) {
    serverManager.cleanup();
    serverManager = null;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function extractErrorDetails(error: unknown): IpcError | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'ipcError' in error &&
    (error as { ipcError?: IpcError }).ipcError
  ) {
    return (error as { ipcError: IpcError }).ipcError;
  }

  if (error instanceof Error) {
    return parseIpcError(error.message);
  }

  return undefined;
}

function createErrorResult<T = void>(error: unknown): IpcResult<T> {
  return {
    success: false,
    error: formatError(error),
    errorDetails: extractErrorDetails(error),
  };
}
