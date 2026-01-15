// Settings IPC Handlers
// 處理設定相關的 IPC 請求

import { ipcMain } from 'electron';
import { SettingsChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  SettingsDto,
  SaveSettingsRequest,
} from '../../shared/ipc-types';
import { configManager } from '@lumix/core';

/**
 * 初始化設定 handlers
 */
export function initSettingsHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  // 取得設定
  ipcMain.handle(SettingsChannels.GET, async (): Promise<IpcResult<SettingsDto>> => {
    try {
      const settings = await configManager.loadSettings();
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 儲存設定
  ipcMain.handle(SettingsChannels.SAVE, async (_, data: SaveSettingsRequest): Promise<IpcResult<SettingsDto>> => {
    try {
      const current = await configManager.loadSettings();
      const updated = { ...current, ...data };
      await configManager.saveSettings(updated);
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
