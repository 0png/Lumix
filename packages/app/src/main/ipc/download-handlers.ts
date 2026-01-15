// Download IPC Handlers
// 處理下載相關的 IPC 請求

import { ipcMain, BrowserWindow } from 'electron';
import { DownloadChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  FetchVersionsResult,
  DownloadServerRequest,
} from '../../shared/ipc-types';
import {
  fetchVersions,
  downloadServerJar,
  type CoreType,
} from '@lumix/core';

/**
 * 初始化下載 handlers
 */
export function initDownloadHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  // 取得版本列表
  ipcMain.handle(DownloadChannels.FETCH_VERSIONS, async (_, coreType: CoreType): Promise<IpcResult<FetchVersionsResult>> => {
    try {
      const versions = await fetchVersions(coreType);
      return { success: true, data: { versions } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 下載伺服器 JAR
  ipcMain.handle(DownloadChannels.DOWNLOAD_SERVER, async (_, data: DownloadServerRequest): Promise<IpcResult<string>> => {
    try {
      const jarPath = await downloadServerJar(
        data.coreType,
        data.mcVersion,
        data.targetDir,
        (progress) => {
          // 發送進度事件
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((win) => {
            win.webContents.send(DownloadChannels.DOWNLOAD_PROGRESS, {
              serverId: data.targetDir,
              progress,
            });
          });
        }
      );
      return { success: true, data: jarPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
