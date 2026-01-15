// IPC Handlers Index
// 統一初始化所有 IPC handlers

import { initServerHandlers, cleanupServerHandlers } from './server-handlers';
import { initJavaHandlers } from './java-handlers';
import { initDownloadHandlers } from './download-handlers';
import { initSettingsHandlers } from './settings-handlers';
import { initAppHandlers } from './app-handlers';

/**
 * 初始化所有 IPC handlers
 */
export function initAllIpcHandlers(): void {
  initServerHandlers();
  initJavaHandlers();
  initDownloadHandlers();
  initSettingsHandlers();
  initAppHandlers();
}

/**
 * 清理所有 IPC handlers
 */
export function cleanupAllIpcHandlers(): void {
  cleanupServerHandlers();
}

export {
  initServerHandlers,
  initJavaHandlers,
  initDownloadHandlers,
  initSettingsHandlers,
  initAppHandlers,
};
