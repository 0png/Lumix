import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, fetchJson } from '../src/main/services/http-client';
import { runNeoForgeInstaller } from '../src/main/services/forge-installer';
import {
  DownloadService,
  getNeoForgeMinecraftVersion,
  selectNeoForgeVersion,
} from '../src/main/services/download-service';

vi.mock('../src/main/services/http-client', () => ({
  fetchJson: vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock('../src/main/services/forge-installer', () => ({
  runForgeInstaller: vi.fn(),
  runNeoForgeInstaller: vi.fn(),
}));

describe('DownloadService NeoForge and Purpur support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(downloadFile).mockResolvedValue(undefined);
    vi.mocked(runNeoForgeInstaller).mockResolvedValue(undefined);
  });

  it('maps NeoForge releases to their Minecraft versions', () => {
    expect(getNeoForgeMinecraftVersion('20.4.210')).toBe('1.20.4');
    expect(getNeoForgeMinecraftVersion('21.0.167')).toBe('1.21');
    expect(getNeoForgeMinecraftVersion('21.1.172')).toBe('1.21.1');
    expect(getNeoForgeMinecraftVersion('26.1.0.5-beta')).toBe('26.1');
    expect(getNeoForgeMinecraftVersion('26.1.2.95')).toBe('26.1.2');
    expect(getNeoForgeMinecraftVersion('0.1.0')).toBeNull();
  });

  it('prefers the latest stable NeoForge release and falls back to beta', () => {
    expect(selectNeoForgeVersion([
      '21.1.170',
      '21.1.172-beta',
      '21.1.171',
      '21.1.999-alpha',
    ], '1.21.1')).toBe('21.1.171');

    expect(selectNeoForgeVersion([
      '21.1.170-alpha',
      '21.1.172-beta',
      '21.1.171-beta',
    ], '1.21.1')).toBe('21.1.172-beta');
  });

  it('fetches and sorts Purpur Minecraft versions', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ versions: ['1.20.4', '1.21.1', '1.21'] } as never);

    await expect(new DownloadService().fetchVersions('purpur')).resolves.toEqual([
      '1.21.1',
      '1.21',
      '1.20.4',
    ]);
  });

  it('downloads the latest Purpur build for a supported Minecraft version', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ versions: ['1.21.1'] } as never);
    const targetDir = path.resolve('temporary-purpur-server');

    const result = await new DownloadService().downloadServer('purpur', '1.21.1', targetDir, 'server-id');

    expect(result).toBe(path.join(targetDir, 'server.jar'));
    expect(downloadFile).toHaveBeenCalledWith(
      'https://api.purpurmc.org/v2/purpur/1.21.1/latest/download',
      path.join(targetDir, 'server.jar'),
      0,
      expect.any(Function)
    );
  });

  it('downloads the selected NeoForge installer and uses the selected Java runtime', async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      versions: ['21.1.170', '21.1.172-beta', '21.1.171'],
    } as never);
    const targetDir = path.resolve('temporary-neoforge-server');

    await new DownloadService().downloadServer(
      'neoforge',
      '1.21.1',
      targetDir,
      'server-id',
      { javaPath: 'C:\\Java\\bin\\java.exe' }
    );

    const installerPath = path.join(targetDir, 'neoforge-installer.jar');
    expect(downloadFile).toHaveBeenCalledWith(
      'https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.171/neoforge-21.1.171-installer.jar',
      installerPath,
      0,
      expect.any(Function)
    );
    expect(runNeoForgeInstaller).toHaveBeenCalledWith(
      installerPath,
      targetDir,
      'C:\\Java\\bin\\java.exe'
    );
  });
});
