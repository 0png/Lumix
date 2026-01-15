// Settings IPC Handlers
// 處理設定相關的 IPC 請求

import { ipcMain } from 'electron';
import { SettingsChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  SettingsDto,
  SaveSettingsRequest,
} from '../../shared/ipc-types';
import { ConfigManager } from '@lumix/core';

let configManager: ConfigManager | null = null;

/**
 * 初始化設定 handlers
 */
export function initSettingsHandlers(dataPath: string): void {
  configManager = new ConfigManager(dataPath);
  registerHandlers();
}

function registerHandlers(): void {
  // 取得設定
  ipcMain.handle(SettingsChannels.GET, async (): Promise<IpcResult<SettingsDto>> => {
    try {
      if (!configManager) throw new Error('ConfigManager not initialized');
      const settings = await configManager.loadSettings();
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 儲存設定
  ipcMain.handle(SettingsChannels.SAVE, async (_, data: SaveSettingsRequest): Promise<IpcResult<SettingsDto>> => {
    try {
      if (!configManager) throw new Error('ConfigManager not initialized');
      const current = await configManager.loadSettings();
      const updated = { ...current, ...data };
      await configManager.saveSettings(updated);
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

/**
 * 清理資源
 */
export function cleanupSettingsHandlers(): void {
  configManager = null;
}
