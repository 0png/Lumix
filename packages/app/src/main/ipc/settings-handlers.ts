// Settings IPC Handlers
// 工作區設定由主程序持久化至 userData/settings.json。

import { app, ipcMain } from 'electron';
import { SettingsChannels } from '../../shared/ipc-channels';
import type { IpcResult, SaveSettingsRequest, SettingsDto } from '../../shared/ipc-types';
import { SettingsService } from '../services/settings-service';

let settingsService: SettingsService | null = null;

export function initSettingsHandlers(service?: SettingsService): void {
  settingsService = service ?? new SettingsService(app.getPath('userData'));

  ipcMain.handle(SettingsChannels.GET, async (): Promise<IpcResult<SettingsDto>> => {
    try {
      return { success: true, data: await settingsService!.get() };
    } catch (error) {
      return { success: false, error: formatError(error) };
    }
  });

  ipcMain.handle(
    SettingsChannels.SAVE,
    async (_, data: SaveSettingsRequest): Promise<IpcResult<SettingsDto>> => {
      try {
        const saved = await settingsService!.save(data);
        if (process.platform === 'win32') {
          app.setLoginItemSettings({
            openAtLogin: saved.launchAtLogin,
            args: ['--hidden'],
          });
        }
        return { success: true, data: saved };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );
}

export function cleanupSettingsHandlers(): void {
  ipcMain.removeHandler(SettingsChannels.GET);
  ipcMain.removeHandler(SettingsChannels.SAVE);
  settingsService = null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
