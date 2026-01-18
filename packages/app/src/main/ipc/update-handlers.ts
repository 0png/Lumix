import { ipcMain } from 'electron';
import { UpdateChannels } from '../../shared/ipc-channels';
import { getUpdateService } from '../services/update-service';
import type { IpcResult, UpdateCheckResult } from '../../shared/ipc-types';

/**
 * 註冊 Update 相關的 IPC handlers
 */
export function registerUpdateHandlers(): void {
  const updateService = getUpdateService();

  // 檢查更新
  ipcMain.handle(UpdateChannels.CHECK_FOR_UPDATES, async (): Promise<IpcResult<UpdateCheckResult>> => {
    try {
      const result = await updateService.checkForUpdates();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 下載更新
  ipcMain.handle(UpdateChannels.DOWNLOAD_UPDATE, async (): Promise<IpcResult<void>> => {
    try {
      await updateService.downloadUpdate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 安裝更新並重啟
  ipcMain.handle(UpdateChannels.QUIT_AND_INSTALL, (): IpcResult<void> => {
    try {
      updateService.quitAndInstall();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 取得當前版本
  ipcMain.handle(UpdateChannels.GET_CURRENT_VERSION, (): IpcResult<string> => {
    try {
      const version = updateService.getCurrentVersion();
      return { success: true, data: version };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}

/**
 * 移除 Update handlers
 */
export function removeUpdateHandlers(): void {
  ipcMain.removeHandler(UpdateChannels.CHECK_FOR_UPDATES);
  ipcMain.removeHandler(UpdateChannels.DOWNLOAD_UPDATE);
  ipcMain.removeHandler(UpdateChannels.QUIT_AND_INSTALL);
  ipcMain.removeHandler(UpdateChannels.GET_CURRENT_VERSION);
}
