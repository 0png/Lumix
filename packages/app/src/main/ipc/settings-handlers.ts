// Settings IPC Handlers - Mock 版本
// 使用記憶體儲存設定

import { ipcMain } from 'electron';
import { SettingsChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  SettingsDto,
  SaveSettingsRequest,
} from '../../shared/ipc-types';

// Mock 設定資料
let mockSettings: SettingsDto = {
  theme: 'system',
  language: 'zh-TW',
  defaultRamMin: 1024,
  defaultRamMax: 4096,
  autoUpdate: true,
  javaInstallations: [],
};

export function initSettingsHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  ipcMain.handle(SettingsChannels.GET, async (): Promise<IpcResult<SettingsDto>> => {
    return { success: true, data: mockSettings };
  });

  ipcMain.handle(SettingsChannels.SAVE, async (_, data: SaveSettingsRequest): Promise<IpcResult<SettingsDto>> => {
    mockSettings = { 
      ...mockSettings, 
      ...data,
    };
    return { success: true, data: mockSettings };
  });
}
