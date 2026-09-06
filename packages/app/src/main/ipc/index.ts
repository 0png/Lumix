/**
 * IPC Handlers Index
 * 統一初始化所有 IPC handlers 並管理 ServerManager 生命週期
 */

import { app } from 'electron';
import { initServerHandlers, cleanupServerHandlers } from './server-handlers';
import { initJavaHandlers, cleanupJavaHandlers } from './java-handlers';
import { initDownloadHandlers } from './download-handlers';
import { initSettingsHandlers, cleanupSettingsHandlers } from './settings-handlers';
import { initAppHandlers } from './app-handlers';
import { initModpackHandlers, cleanupModpackHandlers } from './modpack-handlers';
import { registerUpdateHandlers, removeUpdateHandlers } from './update-handlers';
import { ServerManager } from '../services/server-manager';
import { FileManager } from '../services/file-manager';
import { ImportRegistry } from '../services/import-registry';
import { ImportScanner } from '../services/import-scanner';
import { ProcessManager } from '../services/process-manager';
import { DownloadService } from '../services/download-service';
import { SettingsService } from '../services/settings-service';
import { ManagedServerRegistry } from '../services/managed-server-registry';
import { JavaDetector } from '../services/java-detector';

// ============================================================================
// Module State
// ============================================================================

let serverManager: ServerManager | null = null;
let settingsServiceInstance: SettingsService | null = null;

// ============================================================================
// Initialization
// ============================================================================

export async function initAllIpcHandlers(settingsService?: SettingsService): Promise<void> {
  // 初始化核心服務
  const dataPath = app.getPath('userData');
  const fileManager = new FileManager(dataPath);
  const importRegistry = new ImportRegistry(dataPath);
  settingsServiceInstance = settingsService ?? new SettingsService(dataPath);
  const managedServerRegistry = new ManagedServerRegistry(dataPath);
  const importScanner = new ImportScanner();
  const processManager = new ProcessManager();
  const downloadService = new DownloadService();
  const javaDetector = new JavaDetector();

  serverManager = new ServerManager({
    fileManager,
    importRegistry,
    importScanner,
    processManager,
    defaultJavaPath: 'java',
    settingsService: settingsServiceInstance,
    managedServerRegistry,
    javaDetector,
  });

  // 載入現有伺服器
  await serverManager.loadServers();

  // 初始化所有 IPC handlers
  initServerHandlers(serverManager);
  initModpackHandlers(serverManager, downloadService, javaDetector);
  initJavaHandlers(javaDetector);
  initDownloadHandlers(downloadService);
  initSettingsHandlers(settingsServiceInstance);
  initAppHandlers();
  registerUpdateHandlers();
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupAllIpcHandlers(): void {
  cleanupServerHandlers();
  cleanupModpackHandlers();
  cleanupJavaHandlers();
  cleanupSettingsHandlers();
  removeUpdateHandlers();
}

export async function shutdownAllIpcHandlers(): Promise<void> {
  if (serverManager) {
    await serverManager.shutdown();
  }
  cleanupAllIpcHandlers();
  serverManager = null;
  settingsServiceInstance = null;
}

export function hasRunningServers(): boolean {
  return serverManager?.hasRunningServers() ?? false;
}

// ============================================================================
// Exports
// ============================================================================

export {
  initServerHandlers,
  initJavaHandlers,
  cleanupJavaHandlers,
  initDownloadHandlers,
  initSettingsHandlers,
  cleanupSettingsHandlers,
  initAppHandlers,
  registerUpdateHandlers,
  removeUpdateHandlers,
};
