import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';
import type {
  UpdateCheckResult,
} from '../../shared/ipc-types';

/**
 * UpdateService
 * 負責處理應用程式自動更新邏輯
 */
export class UpdateService {
  private mainWindow: BrowserWindow | null = null;
  private isChecking = false;
  private isDownloading = false;

  constructor() {
    this.setupAutoUpdater();
  }

  /**
   * 設定 autoUpdater 事件監聽
   */
  private setupAutoUpdater(): void {
    // 關閉自動下載，改為手動控制
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // 檢查更新錯誤
    autoUpdater.on('error', (error) => {
      this.isChecking = false;
      this.isDownloading = false;
      this.sendToRenderer('update:error', {
        message: error.message,
        code: 'UPDATE_ERROR',
      });
    });

    // 檢查更新中
    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
    });

    // 有可用更新
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.isChecking = false;
      this.sendToRenderer('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes as string | undefined,
      });
    });

    // 無可用更新
    autoUpdater.on('update-not-available', () => {
      this.isChecking = false;
      this.sendToRenderer('update:not-available', {});
    });

    // 下載進度
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.sendToRenderer('update:download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    // 下載完成
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.isDownloading = false;
      this.sendToRenderer('update:downloaded', {
        version: info.version,
      });
    });
  }

  /**
   * 設定主視窗參考（用於發送事件）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 檢查更新
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      return {
        hasUpdate: false,
        message: 'Already checking for updates',
      };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        return {
          hasUpdate: false,
          message: 'No update available',
        };
      }

      const updateInfo = result.updateInfo;
      return {
        hasUpdate: updateInfo.version !== autoUpdater.currentVersion.version,
        version: updateInfo.version,
        releaseDate: updateInfo.releaseDate,
        releaseNotes: updateInfo.releaseNotes as string | undefined,
      };
    } catch (error) {
      throw new Error(`Failed to check for updates: ${(error as Error).message}`);
    }
  }

  /**
   * 下載更新
   */
  async downloadUpdate(): Promise<void> {
    if (this.isDownloading) {
      throw new Error('Update is already being downloaded');
    }

    try {
      this.isDownloading = true;
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.isDownloading = false;
      throw new Error(`Failed to download update: ${(error as Error).message}`);
    }
  }

  /**
   * 安裝更新並重啟應用程式
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * 取得當前版本
   */
  getCurrentVersion(): string {
    return autoUpdater.currentVersion.version;
  }

  /**
   * 發送事件到 Renderer Process
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

// Singleton instance
let updateServiceInstance: UpdateService | null = null;

export function getUpdateService(): UpdateService {
  if (!updateServiceInstance) {
    updateServiceInstance = new UpdateService();
  }
  return updateServiceInstance;
}
