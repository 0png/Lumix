import { beforeEach, describe, expect, it, vi } from 'vitest';

const { autoUpdater } = vi.hoisted(() => {
  const updater = {
    on: vi.fn(),
    autoDownload: true,
    autoInstallOnAppQuit: true,
    currentVersion: { version: '1.2.0' },
    quitAndInstall: vi.fn(),
  };

  return { autoUpdater: updater };
});

vi.mock('electron-updater', () => ({ autoUpdater }));

import { UpdateService } from '../src/main/services/update-service';

describe('UpdateService', () => {
  beforeEach(() => {
    autoUpdater.quitAndInstall.mockClear();
  });

  it('installs downloaded updates silently and relaunches the app', () => {
    const service = new UpdateService();

    service.quitAndInstall();

    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
});
