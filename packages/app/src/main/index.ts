import { app, autoUpdater, BrowserWindow, dialog, Menu, Tray, shell, type MessageBoxOptions } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initAllIpcHandlers, hasRunningServers, shutdownAllIpcHandlers } from './ipc';
import { getUpdateService } from './services/update-service';
import { SettingsService } from './services/settings-service';
import type { SettingsDto } from '../shared/ipc-types';

// ============================================================================
// Window Management
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let shutdownComplete = false;
let shutdownPromise: Promise<boolean> | null = null;
let workspaceSettings: SettingsDto | null = null;
let startHidden = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function getIconPath(): string {
  return join(__dirname, '../../resources/icon.png');
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow(false);
    getUpdateService().setMainWindow(mainWindow);
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  if (tray) return;

  tray = new Tray(getIconPath());
  tray.setToolTip('Lumix');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '開啟 Lumix',
      click: showMainWindow,
    },
    {
      label: '結束 Lumix',
      click: () => {
        void quitApplication();
      },
    },
  ]));
  tray.on('double-click', showMainWindow);
}

function createWindow(hiddenOnLaunch = false): BrowserWindow {
  const window = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0b',
      symbolColor: '#f2f2f2',
      height: 36,
    },
    title: 'Lumix',
    backgroundColor: '#0a0a0b',
    show: false,
    autoHideMenuBar: true,
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  window.on('ready-to-show', () => {
    if (!hiddenOnLaunch) {
      window.show();
      window.focus();
    }
  });

  window.on('close', (event) => {
    if (isQuitting) return;

    event.preventDefault();
    void handleWindowClose(window);
  });

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

async function handleWindowClose(window: BrowserWindow): Promise<void> {
  let settings = workspaceSettings;
  try {
    const service = new SettingsService(app.getPath('userData'));
    settings = await service.get();
    workspaceSettings = settings;
  } catch {
    // Use the last known settings if the settings file is temporarily busy.
  }

  if (settings?.closeBehavior !== 'quit') {
    window.hide();
    return;
  }

  await quitApplication();
}

async function prepareSafeShutdown(): Promise<boolean> {
  if (shutdownComplete) return true;
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    if (hasRunningServers()) {
      const options: MessageBoxOptions = {
        type: 'warning',
        title: '關閉 Lumix',
        message: '仍有伺服器正在執行。',
        detail: '退出前 Lumix 會先要求所有伺服器安全停止，最多等待 30 秒。',
        buttons: ['取消', '停止伺服器並退出'],
        defaultId: 1,
        cancelId: 0,
        noLink: true,
      };
      const result = mainWindow
        ? await dialog.showMessageBox(mainWindow, options)
        : await dialog.showMessageBox(options);
      if (result.response !== 1) return false;
    }

    isQuitting = true;
    try {
      await shutdownAllIpcHandlers();
      shutdownComplete = true;
      return true;
    } catch (error) {
      isQuitting = false;
      console.error('Failed to safely shut down Lumix:', error);
      const errorOptions: MessageBoxOptions = {
        type: 'error',
        title: '無法關閉 Lumix',
        message: '伺服器未能完成安全關閉。',
        detail: error instanceof Error ? error.message : String(error),
        buttons: ['確定'],
      };
      if (mainWindow) {
        await dialog.showMessageBox(mainWindow, errorOptions);
      } else {
        await dialog.showMessageBox(errorOptions);
      }
      return false;
    }
  })();

  try {
    return await shutdownPromise;
  } finally {
    shutdownPromise = null;
  }
}

async function quitApplication(): Promise<void> {
  const prepared = await prepareSafeShutdown();
  if (prepared) app.quit();
}

// ============================================================================
// Application Lifecycle
// ============================================================================

if (!hasSingleInstanceLock) {
  isQuitting = true;
  app.quit();
} else {
  // electron-updater emits this Electron-level event immediately before it
  // asks Electron to quit. Mark the exit as intentional so the normal close
  // handler does not hide the window in the tray and block the update restart.
  autoUpdater.on('before-quit-for-update', () => {
    isQuitting = true;
  });

  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.lumix.launcher');

    const settingsService = new SettingsService(app.getPath('userData'));
    workspaceSettings = await settingsService.get();
    startHidden = process.platform === 'win32'
      && workspaceSettings.launchAtLogin
      && workspaceSettings.startMinimized
      && process.argv.includes('--hidden');
    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: workspaceSettings.launchAtLogin,
        args: ['--hidden'],
      });
    }

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // 初始化所有 IPC handlers（包含 ServerManager 載入）
    await initAllIpcHandlers(settingsService);

    createTray();
    mainWindow = createWindow(startHidden);

    // 設定 UpdateService 的主視窗參考
    const updateService = getUpdateService();
    updateService.setMainWindow(mainWindow);
    updateService.setBeforeInstallHandler(prepareSafeShutdown);

    app.on('activate', function () {
      showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (shutdownComplete) return;

  event.preventDefault();
  void quitApplication();
});
