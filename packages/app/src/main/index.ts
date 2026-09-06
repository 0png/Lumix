import { app, autoUpdater, BrowserWindow, Menu, Tray, shell } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initAllIpcHandlers, cleanupAllIpcHandlers } from './ipc';
import { getUpdateService } from './services/update-service';

// ============================================================================
// Window Management
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function getIconPath(): string {
  return join(__dirname, '../../resources/icon.png');
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
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
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('double-click', showMainWindow);
}

function createWindow(): BrowserWindow {
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
    window.show();
    window.focus();
  });

  window.on('close', (event) => {
    if (isQuitting) return;

    event.preventDefault();
    window.hide();
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

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // 初始化所有 IPC handlers（包含 ServerManager 載入）
    await initAllIpcHandlers();

    createTray();
    mainWindow = createWindow();

    // 設定 UpdateService 的主視窗參考
    const updateService = getUpdateService();
    updateService.setMainWindow(mainWindow);

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

app.on('before-quit', () => {
  isQuitting = true;
  // 清理所有資源（包含終止執行中的伺服器程序）
  cleanupAllIpcHandlers();
});
