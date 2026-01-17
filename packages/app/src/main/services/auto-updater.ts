import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateStatus {
  available: boolean;
  version?: string;
  downloading?: boolean;
  progress?: UpdateProgress;
  error?: string;
}

export class AutoUpdater {
  private mainWindow: BrowserWindow | null = null;
  private updateStatus: UpdateStatus = { available: false };

  constructor() {
    this.setupLogger();
    this.setupAutoUpdater();
  }

  private setupLogger(): void {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
  }

  private setupAutoUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus = {
        available: true,
        version: info.version,
      };
      this.sendStatusToWindow('update-available', info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.updateStatus = { available: false };
      this.sendStatusToWindow('update-not-available', info);
    });

    autoUpdater.on('error', (err: Error) => {
      this.updateStatus = {
        available: false,
        error: err.message,
      };
      this.sendStatusToWindow('update-error', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.updateStatus = {
        ...this.updateStatus,
        downloading: true,
        progress: progressObj,
      };
      this.sendStatusToWindow('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateStatus = {
        ...this.updateStatus,
        downloading: false,
      };
      this.sendStatusToWindow('update-downloaded', info);
    });
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      const result = await autoUpdater.checkForUpdates();
      return this.updateStatus;
    } catch (error) {
      const err = error as Error;
      this.updateStatus = {
        available: false,
        error: err.message,
      };
      return this.updateStatus;
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!this.updateStatus.available) {
      throw new Error('No update available');
    }
    await autoUpdater.downloadUpdate();
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  getStatus(): UpdateStatus {
    return this.updateStatus;
  }

  private sendStatusToWindow(event: string, data?: unknown): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('updater:status', {
        event,
        data,
      });
    }
  }
}
