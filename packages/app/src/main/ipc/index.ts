/**
 * IPC Handlers Index
 * 統一初始化所有 IPC handlers 並管理 ServerManager 生命週期
 */

import { app } from 'electron';
import { initServerHandlers, cleanupServerHandlers } from './server-handlers';
import { initJavaHandlers } from './java-handlers';
import { initDownloadHandlers } from './download-handlers';
import { initSettingsHandlers } from './settings-handlers';
import { initTunnelHandlers, cleanupTunnelHandlers } from './tunnel-handlers';
import { initAppHandlers } from './app-handlers';
import { ServerManager } from '../services/server-manager';
import { FileManager } from '../services/file-manager';
import { ProcessManager } from '../services/process-manager';

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
  const processManager = new ProcessManager();

  serverManager = new ServerManager({
    fileManager,
    processManager,
    defaultJavaPath: 'java',
  });

  // 載入現有伺服器
  await serverManager.loadServers();

  // 初始化所有 IPC handlers
  initServerHandlers(serverManager);
  initJavaHandlers();
  initDownloadHandlers();
  initSettingsHandlers();
  initTunnelHandlers();
  initAppHandlers();
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupAllIpcHandlers(): void {
  cleanupServerHandlers();
  cleanupTunnelHandlers();
}

// ============================================================================
// Exports
// ============================================================================

export {
  initServerHandlers,
  initJavaHandlers,
  initDownloadHandlers,
  initSettingsHandlers,
  initTunnelHandlers,
  initAppHandlers,
};
