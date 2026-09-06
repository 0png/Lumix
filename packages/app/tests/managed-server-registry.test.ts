import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileManager, type ServerMetadata } from '../src/main/services/file-manager';
import { ImportRegistry } from '../src/main/services/import-registry';
import { ImportScanner } from '../src/main/services/import-scanner';
import { ManagedServerRegistry } from '../src/main/services/managed-server-registry';
import { ServerManager } from '../src/main/services/server-manager';
import { SettingsService } from '../src/main/services/settings-service';

class IdleProcessManager extends EventEmitter {
  isRunning(): boolean { return false; }
  killAll(): void {}
}

function metadata(id: string, name: string): ServerMetadata {
  return {
    id,
    name,
    origin: 'managed',
    coreType: 'vanilla',
    mcVersion: '1.21.1',
    ramMin: 2048,
    ramMax: 4096,
    jvmArgs: [],
    javaPath: 'java',
    javaSelectionMode: 'auto',
    launchJarPath: 'server.jar',
    createdAt: new Date().toISOString(),
    backupSettings: {
      enabled: false,
      scheduleType: 'daily',
      time: '03:00',
      regularRetention: 3,
      preRestoreRetention: 3,
    },
    autoRestart: { enabled: false, maxAttempts: 3 },
  };
}

describe('managed server registry migration', () => {
  let dataPath: string;

  beforeEach(async () => {
    dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-managed-registry-'));
  });

  afterEach(async () => {
    await fs.rm(dataPath, { recursive: true, force: true });
  });

  it('loads registered servers from multiple roots and registers the legacy root without moving it', async () => {
    const fileManager = new FileManager(dataPath);
    const legacyDirectory = path.join(dataPath, 'servers', 'Legacy Server');
    const externalDirectory = path.join(dataPath, 'archive', 'External Server');
    await fs.mkdir(legacyDirectory, { recursive: true });
    await fs.mkdir(externalDirectory, { recursive: true });
    await fileManager.writeServerJson(legacyDirectory, metadata('legacy-id', 'Legacy Server'));
    await fileManager.writeServerJson(externalDirectory, metadata('external-id', 'External Server'));

    const registry = new ManagedServerRegistry(dataPath);
    await registry.save({ id: 'external-id', directory: externalDirectory });

    const manager = new ServerManager({
      fileManager,
      importRegistry: new ImportRegistry(dataPath),
      importScanner: new ImportScanner(),
      processManager: new IdleProcessManager() as never,
      defaultJavaPath: 'java',
      settingsService: new SettingsService(dataPath),
      managedServerRegistry: registry,
    });
    await manager.loadServers();

    const servers = await manager.getAllServers();
    expect(servers.map((server) => server.id).sort()).toEqual(['external-id', 'legacy-id']);
    expect(servers.find((server) => server.id === 'legacy-id')?.directory).toBe(legacyDirectory);
    expect((await registry.list()).map((entry) => entry.id).sort()).toEqual(['external-id', 'legacy-id']);
    await expect(fs.access(legacyDirectory)).resolves.toBeUndefined();
  });
});
