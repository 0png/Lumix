/**
 * IPC Handlers Index
 * 統一初始化所有 IPC handlers 並管理 ServerManager 生命週期
 */

import { app } from 'electron';
import { initServerHandlers, cleanupServerHandlers } from './server-handlers';
import { initJavaHandlers } from './java-handlers';
import { initDownloadHandlers } from './download-handlers';
import { initSettingsHandlers } from './settings-handlers';
import { initAppHandlers } from './app-handlers';
import { initUpdaterHandlers } from './updater-handlers';
import { ServerManager } from '../services/server-manager';
import { FileManager } from '../services/file-manager';
import { ProcessManager } from '../services/process-manager';
import { AutoUpdater } from '../services/auto-updater';

// ============================================================================
// Module State
// ============================================================================

let serverManager: ServerManager | null = null;
let autoUpdater: AutoUpdater | null = null;

// ============================================================================
// Initialization
// ============================================================================

export async function initAllIpcHandlers(): Promise<void> {
  // 初始化核心服務
  const dataPath = app.getPath('userData');
  const fileManager = new FileManager(dataPath);
  const processManager = new ProcessManager();

  serverManager = new ServerManager({
    fileManager,
    processManager,
    defaultJavaPath: 'java',
  });

  // 載入現有伺服器
  await serverManager.loadServers();

  // 初始化 AutoUpdater
  autoUpdater = new AutoUpdater();

  // 初始化所有 IPC handlers
  initServerHandlers(serverManager);
  initJavaHandlers();
  initDownloadHandlers();
  initSettingsHandlers();
  initAppHandlers();
  initUpdaterHandlers(autoUpdater);
}

// ============================================================================
// Exports for Main Process
// ============================================================================

export function getAutoUpdater(): AutoUpdater | null {
  return autoUpdater;
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupAllIpcHandlers(): void {
  cleanupServerHandlers();
}

// ============================================================================
// Exports
// ============================================================================

export {
  initServerHandlers,
  initJavaHandlers,
  initDownloadHandlers,
  initSettingsHandlers,
  initAppHandlers,
  initUpdaterHandlers,
};
