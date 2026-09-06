import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKUP_RETENTION,
  DEFAULT_RAM_MAX,
  DEFAULT_RAM_MIN,
  MAX_RAM_MB,
  SettingsService,
} from '../src/main/services/settings-service';

describe('SettingsService', () => {
  let userDataPath: string;

  beforeEach(async () => {
    userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-settings-'));
  });

  afterEach(async () => {
    await fs.rm(userDataPath, { recursive: true, force: true });
  });

  it('creates versioned defaults and keeps them after reloading', async () => {
    const service = new SettingsService(userDataPath);
    const settings = await service.get();

    expect(settings).toMatchObject({
      defaultRamMin: DEFAULT_RAM_MIN,
      defaultRamMax: DEFAULT_RAM_MAX,
      launchAtLogin: false,
      startMinimized: true,
      restoreLastSession: true,
      closeBehavior: 'minimize-to-tray',
      defaultServersPath: path.join(userDataPath, 'servers'),
      defaultRegularBackupRetention: DEFAULT_BACKUP_RETENTION,
      defaultPreRestoreBackupRetention: DEFAULT_BACKUP_RETENTION,
    });

    const raw = JSON.parse(await fs.readFile(service.getPath(), 'utf-8')) as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(1);
    expect(raw.defaultRamMin).toBe(DEFAULT_RAM_MIN);
    expect((await new SettingsService(userDataPath).get()).defaultRamMax).toBe(DEFAULT_RAM_MAX);
  });

  it('repairs partial, legacy, and out-of-range values field by field', async () => {
    const service = new SettingsService(userDataPath);
    await fs.writeFile(service.getPath(), JSON.stringify({
      schemaVersion: 0,
      theme: 'dark',
      language: 'invalid',
      defaultRamMax: 99999,
      defaultRamMin: 123,
      launchAtLogin: 'yes',
      startMinimized: false,
      closeBehavior: 'quit',
      defaultServersPath: 'relative/servers',
      defaultRegularBackupRetention: 999,
      defaultPreRestoreRetention: 0,
    }), 'utf-8');

    const settings = await service.get();

    expect(settings.theme).toBe('dark');
    expect(settings.language).toBe('zh-TW');
    expect(settings.defaultRamMax).toBe(MAX_RAM_MB);
    expect(settings.defaultRamMin).toBe(MAX_RAM_MB / 2);
    expect(settings.launchAtLogin).toBe(false);
    expect(settings.startMinimized).toBe(false);
    expect(settings.closeBehavior).toBe('quit');
    expect(settings.defaultServersPath).toBe(path.join(userDataPath, 'servers'));
    expect(settings.defaultRegularBackupRetention).toBe(50);
    expect(settings.defaultPreRestoreBackupRetention).toBe(1);
  });

  it('repairs corrupt JSON and writes a clean document atomically', async () => {
    const service = new SettingsService(userDataPath);
    await fs.writeFile(service.getPath(), '{not-json', 'utf-8');

    const settings = await service.get();
    expect(settings.defaultRamMax).toBe(DEFAULT_RAM_MAX);

    const repaired = JSON.parse(await fs.readFile(service.getPath(), 'utf-8')) as Record<string, unknown>;
    expect(repaired.schemaVersion).toBe(1);
    expect(() => JSON.parse(JSON.stringify(repaired))).not.toThrow();
    const files = await fs.readdir(userDataPath);
    expect(files.filter((file) => file.endsWith('.tmp'))).toEqual([]);
  });

  it('normalizes saved values and rejects an invalid server root without changing it', async () => {
    const service = new SettingsService(userDataPath);
    const validRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-server-root-'));
    try {
      const saved = await service.save({
        defaultRamMax: 7000,
        defaultRamMin: 1024,
        defaultServersPath: validRoot,
        defaultRegularBackupRetention: 0,
        defaultPreRestoreBackupRetention: 100,
      });

      expect(saved.defaultRamMax).toBe(7168);
      expect(saved.defaultRamMin).toBe(3584);
      expect(saved.defaultServersPath).toBe(path.resolve(validRoot));
      expect(saved.defaultRegularBackupRetention).toBe(1);
      expect(saved.defaultPreRestoreBackupRetention).toBe(50);

      await expect(service.save({ defaultServersPath: path.join(validRoot, 'missing') }))
        .rejects.toThrow('FS_PERMISSION_DENIED');
      expect((await service.get()).defaultServersPath).toBe(path.resolve(validRoot));
    } finally {
      await fs.rm(validRoot, { recursive: true, force: true });
    }
  });
});
