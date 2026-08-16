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
import { initModpackHandlers, cleanupModpackHandlers } from './modpack-handlers';
import { registerUpdateHandlers, removeUpdateHandlers } from './update-handlers';
import { ServerManager } from '../services/server-manager';
import { FileManager } from '../services/file-manager';
import { ImportRegistry } from '../services/import-registry';
import { ImportScanner } from '../services/import-scanner';
import { ProcessManager } from '../services/process-manager';
import { DownloadService } from '../services/download-service';

// ============================================================================
// Module State
// ============================================================================

let serverManager: ServerManager | null = null;

// ============================================================================
// Initialization
// ============================================================================

export async function initAllIpcHandlers(): Promise<void> {
  // 初始化核心服務
  const dataPath = app.getPath('userData');
  const fileManager = new FileManager(dataPath);
  const importRegistry = new ImportRegistry(dataPath);
  const importScanner = new ImportScanner();
  const processManager = new ProcessManager();
  const downloadService = new DownloadService();

  serverManager = new ServerManager({
    fileManager,
    importRegistry,
    importScanner,
    processManager,
    defaultJavaPath: 'java',
  });

  // 載入現有伺服器
  await serverManager.loadServers();

  // 初始化所有 IPC handlers
  initServerHandlers(serverManager);
  initModpackHandlers(serverManager, downloadService);
  initJavaHandlers();
  initDownloadHandlers(downloadService);
  initSettingsHandlers();
  initAppHandlers();
  registerUpdateHandlers();
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupAllIpcHandlers(): void {
  cleanupServerHandlers();
  cleanupModpackHandlers();
  removeUpdateHandlers();
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
  registerUpdateHandlers,
  removeUpdateHandlers,
};
