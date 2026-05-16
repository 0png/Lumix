// App IPC Handlers
// 處理應用程式相關的 IPC 請求

import { ipcMain, app, shell, BrowserWindow } from 'electron';
import os from 'os';
import { AppChannels, WindowChannels } from '../../shared/ipc-channels';
import type { IpcResult, SystemInfo } from '../../shared/ipc-types';

/**
 * 初始化應用程式 handlers
 */
export function initAppHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  // 取得應用程式版本
  ipcMain.handle(AppChannels.GET_VERSION, async (): Promise<IpcResult<string>> => {
    try {
      const version = app.getVersion();
      return { success: true, data: version };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 取得資料目錄路徑
  ipcMain.handle(AppChannels.GET_DATA_PATH, async (): Promise<IpcResult<string>> => {
    try {
      const dataPath = app.getPath('userData');
      return { success: true, data: dataPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 開啟資料夾
  ipcMain.handle(AppChannels.OPEN_FOLDER, async (_, path: string): Promise<IpcResult<void>> => {
    try {
      await shell.openPath(path);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 開啟外部連結
  ipcMain.handle(AppChannels.OPEN_EXTERNAL, async (_, url: string): Promise<IpcResult<void>> => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(AppChannels.GET_SYSTEM_INFO, async (): Promise<IpcResult<SystemInfo>> => {
    try {
      return {
        success: true,
        data: {
          totalMemoryMb: Math.floor(os.totalmem() / (1024 * 1024)),
          cpuThreads: os.cpus().length,
          platform: process.platform,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.on(WindowChannels.MINIMIZE, (event) => {
    try {
      BrowserWindow.fromWebContents(event.sender)?.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  });

  ipcMain.on(WindowChannels.TOGGLE_MAXIMIZE, (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return;

      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    } catch (error) {
      console.error('Failed to toggle window maximize state:', error);
    }
  });

  ipcMain.on(WindowChannels.CLOSE, (event) => {
    try {
      BrowserWindow.fromWebContents(event.sender)?.close();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  });

  ipcMain.on(WindowChannels.SET_TITLE_BAR_OVERLAY, (event, theme: 'light' | 'dark') => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || process.platform !== 'win32') return;

      window.setTitleBarOverlay({
        color: theme === 'dark' ? '#0a0a0b' : '#ffffff',
        symbolColor: theme === 'dark' ? '#f2f2f2' : '#111827',
        height: 36,
      });
    } catch (error) {
      console.error('Failed to update title bar overlay:', error);
    }
  });
}
