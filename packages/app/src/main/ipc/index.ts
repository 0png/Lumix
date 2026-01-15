// IPC Handlers Index
// 統一初始化所有 IPC handlers

import { app } from 'electron';
import { initServerHandlers, cleanupServerHandlers } from './server-handlers';
import { initJavaHandlers, cleanupJavaHandlers } from './java-handlers';
import { initDownloadHandlers } from './download-handlers';
import { initSettingsHandlers, cleanupSettingsHandlers } from './settings-handlers';
import { initAppHandlers } from './app-handlers';

/**
 * 初始化所有 IPC handlers
 */
export function initAllIpcHandlers(): void {
  const dataPath = app.getPath('userData');
  
  initServerHandlers(dataPath);
  initJavaHandlers(dataPath);
  initDownloadHandlers();
  initSettingsHandlers(dataPath);
  initAppHandlers();
}

/**
 * 清理所有 IPC handlers
 */
export function cleanupAllIpcHandlers(): void {
  cleanupServerHandlers();
  cleanupJavaHandlers();
  cleanupSettingsHandlers();
}

export {
  initServerHandlers,
  initJavaHandlers,
  initDownloadHandlers,
  initSettingsHandlers,
  initAppHandlers,
};
