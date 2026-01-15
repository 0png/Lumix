/**
 * Download IPC Handlers
 * 處理版本獲取與伺服器下載的 IPC 請求
 */

import { ipcMain, BrowserWindow } from 'electron';
import { DownloadChannels } from '../../shared/ipc-channels';
import { DownloadService } from '../services/download-service';
import type {
  IpcResult,
  FetchVersionsResult,
  DownloadServerRequest,
  CoreType,
  DownloadProgress,
} from '../../shared/ipc-types';

// ============================================================================
// Module State
// ============================================================================

let downloadService: DownloadService | null = null;

// ============================================================================
// Initialization
// ============================================================================

export function initDownloadHandlers(): void {
  downloadService = new DownloadService();
  registerHandlers();
  setupEventForwarding();
}

// ============================================================================
// Handler Registration
// ============================================================================

function registerHandlers(): void {
  // FETCH_VERSIONS - 獲取版本列表
  ipcMain.handle(
    DownloadChannels.FETCH_VERSIONS,
    async (_, coreType: CoreType): Promise<IpcResult<FetchVersionsResult>> => {
      try {
        const versions = await downloadService!.fetchVersions(coreType);
        return { success: true, data: { versions } };
      } catch (error) {
        console.error(`Failed to fetch versions for ${coreType}:`, error);
        return { success: false, error: formatError(error) };
      }
    }
  );

  // DOWNLOAD_SERVER - 下載伺服器
  ipcMain.handle(
    DownloadChannels.DOWNLOAD_SERVER,
    async (_, data: DownloadServerRequest): Promise<IpcResult<string>> => {
      try {
        console.log('[DownloadHandlers] Download request:', data);
        const jarPath = await downloadService!.downloadServer(
          data.coreType,
          data.mcVersion,
          data.targetDir,
          data.targetDir // 使用 targetDir 作為 serverId 來追蹤進度
        );
        console.log('[DownloadHandlers] Download complete:', jarPath);
        return { success: true, data: jarPath };
      } catch (error) {
        console.error('[DownloadHandlers] Download failed:', error);
        return { success: false, error: formatError(error) };
      }
    }
  );
}

// ============================================================================
// Event Forwarding
// ============================================================================

function setupEventForwarding(): void {
  if (!downloadService) return;

  downloadService.on('progress', (serverId: string, progress: DownloadProgress) => {
    broadcastToAllWindows(DownloadChannels.DOWNLOAD_PROGRESS, { serverId, progress });
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
// Utilities
// ============================================================================

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
