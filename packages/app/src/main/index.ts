/**
 * Lumix Launcher - Main Process
 * Electron 主進程入口
 */

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initAllIpcHandlers, cleanupAllIpcHandlers } from './ipc';

// ============================================================================
// Window Management
// ============================================================================

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ============================================================================
// Application Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.lumix.launcher');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // 初始化所有 IPC handlers（包含 ServerManager 載入）
  await initAllIpcHandlers();

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 清理所有資源（包含終止執行中的伺服器程序）
  cleanupAllIpcHandlers();
});
