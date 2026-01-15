// Server IPC Handlers
// 處理伺服器管理相關的 IPC 請求

import { ipcMain, BrowserWindow } from 'electron';
import { ServerChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  ServerInstanceDto,
  CreateServerRequest,
  UpdateServerRequest,
} from '../../shared/ipc-types';
import {
  ServerManager,
  ConfigManager,
  type ServerInstance,
  type LogEntry,
} from '@lumix/core';

let serverManager: ServerManager | null = null;
let configManager: ConfigManager | null = null;

/**
 * 初始化伺服器 handlers
 */
export function initServerHandlers(dataPath: string): void {
  configManager = new ConfigManager(dataPath);
  serverManager = new ServerManager(configManager);

  // 訂閱伺服器狀態變更
  serverManager.onStatusChange((serverId, status, exitCode) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send(ServerChannels.STATUS_CHANGED, { serverId, status, exitCode });
    });
  });

  // 訂閱日誌輸出
  serverManager.onLog((serverId, entry) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send(ServerChannels.LOG_ENTRY, {
        serverId,
        entry: {
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          message: entry.message,
        },
      });
    });
  });

  registerHandlers();
}

function registerHandlers(): void {
  // 取得所有伺服器
  ipcMain.handle(ServerChannels.GET_ALL, async (): Promise<IpcResult<ServerInstanceDto[]>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      const instances = await serverManager.getAllInstances();
      return { success: true, data: instances.map(toDto) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 取得單一伺服器
  ipcMain.handle(ServerChannels.GET_BY_ID, async (_, id: string): Promise<IpcResult<ServerInstanceDto>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      const instance = await serverManager.getInstance(id);
      if (!instance) {
        return { success: false, error: 'Server not found' };
      }
      return { success: true, data: toDto(instance) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 建立伺服器
  ipcMain.handle(ServerChannels.CREATE, async (_, data: CreateServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      const instance = await serverManager.createInstance(data);
      return { success: true, data: toDto(instance) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 更新伺服器
  ipcMain.handle(ServerChannels.UPDATE, async (_, data: UpdateServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      const { id, ...updates } = data;
      const instance = await serverManager.updateInstance(id, updates);
      return { success: true, data: toDto(instance) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 刪除伺服器
  ipcMain.handle(ServerChannels.DELETE, async (_, id: string): Promise<IpcResult<void>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      await serverManager.deleteInstance(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 啟動伺服器
  ipcMain.handle(ServerChannels.START, async (_, id: string): Promise<IpcResult<void>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      await serverManager.startServer(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 停止伺服器
  ipcMain.handle(ServerChannels.STOP, async (_, id: string): Promise<IpcResult<void>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      await serverManager.stopServer(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 發送指令
  ipcMain.handle(ServerChannels.SEND_COMMAND, async (_, id: string, command: string): Promise<IpcResult<void>> => {
    try {
      if (!serverManager) throw new Error('ServerManager not initialized');
      serverManager.sendCommand(id, command);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

/**
 * 轉換 ServerInstance 為 DTO
 */
function toDto(instance: ServerInstance): ServerInstanceDto {
  return {
    id: instance.id,
    name: instance.name,
    coreType: instance.coreType,
    mcVersion: instance.mcVersion,
    javaPath: instance.javaPath,
    ramMin: instance.ramMin,
    ramMax: instance.ramMax,
    jvmArgs: instance.jvmArgs,
    directory: instance.directory,
    status: instance.status,
    createdAt: instance.createdAt.toISOString(),
    lastStartedAt: instance.lastStartedAt?.toISOString(),
  };
}

/**
 * 清理資源
 */
export function cleanupServerHandlers(): void {
  if (serverManager) {
    serverManager.cleanup();
    serverManager = null;
  }
  configManager = null;
}
