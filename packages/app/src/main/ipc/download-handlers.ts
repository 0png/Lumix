// Download IPC Handlers - Mock 版本
// 回傳假資料，不執行實際下載

import { ipcMain } from 'electron';
import { DownloadChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  FetchVersionsResult,
  DownloadServerRequest,
} from '../../shared/ipc-types';

// Mock 版本列表
const mockVersions: Record<string, string[]> = {
  vanilla: ['1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.19.4', '1.19.3'],
  paper: ['1.20.4', '1.20.2', '1.20.1', '1.19.4'],
  spigot: ['1.20.4', '1.20.2', '1.20.1', '1.19.4'],
  fabric: ['1.20.4', '1.20.2', '1.20.1', '1.19.4'],
  forge: ['1.20.4', '1.20.1', '1.19.4', '1.18.2'],
};

export function initDownloadHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  ipcMain.handle(DownloadChannels.FETCH_VERSIONS, async (_, coreType: string): Promise<IpcResult<FetchVersionsResult>> => {
    const versions = mockVersions[coreType] || [];
    return { success: true, data: { versions } };
  });

  ipcMain.handle(DownloadChannels.DOWNLOAD_SERVER, async (_, data: DownloadServerRequest): Promise<IpcResult<string>> => {
    // Mock: 假裝下載成功
    const jarPath = `${data.targetDir}/server.jar`;
    return { success: true, data: jarPath };
  });
}
