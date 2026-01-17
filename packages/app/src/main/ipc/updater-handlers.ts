import { ipcMain } from 'electron';
import { UpdaterChannels } from '../../shared/ipc-channels';
import { AutoUpdater } from '../services/auto-updater';
import type { IpcResult, UpdateStatusDto } from '../../shared/ipc-types';

let autoUpdater: AutoUpdater | null = null;

export function initUpdaterHandlers(updater: AutoUpdater): void {
  autoUpdater = updater;

  ipcMain.handle(UpdaterChannels.CHECK_FOR_UPDATES, async () => {
    try {
      const status = await autoUpdater!.checkForUpdates();
      return {
        success: true,
        data: toUpdateStatusDto(status),
      } as IpcResult<UpdateStatusDto>;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      } as IpcResult<UpdateStatusDto>;
    }
  });

  ipcMain.handle(UpdaterChannels.DOWNLOAD_UPDATE, async () => {
    try {
      await autoUpdater!.downloadUpdate();
      return { success: true } as IpcResult;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      } as IpcResult;
    }
  });

  ipcMain.handle(UpdaterChannels.INSTALL_UPDATE, async () => {
    try {
      autoUpdater!.quitAndInstall();
      return { success: true } as IpcResult;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      } as IpcResult;
    }
  });

  ipcMain.handle(UpdaterChannels.GET_STATUS, async () => {
    try {
      const status = autoUpdater!.getStatus();
      return {
        success: true,
        data: toUpdateStatusDto(status),
      } as IpcResult<UpdateStatusDto>;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      } as IpcResult<UpdateStatusDto>;
    }
  });
}

function toUpdateStatusDto(status: any): UpdateStatusDto {
  return {
    available: status.available,
    version: status.version,
    downloading: status.downloading,
    progress: status.progress,
    error: status.error,
  };
}
