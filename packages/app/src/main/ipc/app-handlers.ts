// App IPC Handlers
// 處理應用程式相關的 IPC 請求

import { ipcMain, app, shell } from 'electron';
import { AppChannels } from '../../shared/ipc-channels';
import type { IpcResult } from '../../shared/ipc-types';

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
}
