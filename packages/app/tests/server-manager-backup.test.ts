import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import type { BackupInfoDto, ServerInstanceDto } from '../src/shared/ipc-types';
import { FileManager } from '../src/main/services/file-manager';
import { ImportRegistry } from '../src/main/services/import-registry';
import { ImportScanner } from '../src/main/services/import-scanner';
import { ServerManager } from '../src/main/services/server-manager';
import { createFakeJavaDetector } from './test-helpers';

class FakeProcessManager extends EventEmitter {
  public commands: string[] = [];

  spawn() {
    return {} as never;
  }

  writeStdin(_serverId: string, command: string): boolean {
    this.commands.push(command);
    return true;
  }

  kill(): boolean {
    return true;
  }

  forceKill(): boolean {
    return true;
  }

  isRunning(): boolean {
    return false;
  }

  killAll(): void {}
}

async function writeFile(targetPath: string, content: string) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf-8');
}

describe('ServerManager backup flow', () => {
  let rootDir: string;
  let fileManager: FileManager;
  let importRegistry: ImportRegistry;
  let processManager: FakeProcessManager;
  let manager: ServerManager;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-server-backup-'));
    fileManager = new FileManager(rootDir);
    importRegistry = new ImportRegistry(rootDir);
    processManager = new FakeProcessManager();
    manager = new ServerManager({
      fileManager,
      importRegistry,
      importScanner: new ImportScanner(),
      processManager: processManager as never,
      defaultJavaPath: 'java',
      javaDetector: createFakeJavaDetector(),
    });

    Object.assign(manager as unknown as { delay: (ms: number) => Promise<void> }, {
      delay: async () => undefined,
    });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('sends save-off/save-all flush/save-on around live backups', async () => {
    const server = await manager.createServer({
      name: 'Running Backup Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await writeFile(path.join(server.directory, 'server.properties'), 'motd=Before Backup\n');

    const runningServer: ServerInstanceDto = { ...server, status: 'running' };
    (manager as unknown as { servers: Map<string, ServerInstanceDto> }).servers.set(server.id, runningServer);

    await manager.createBackup(server.id, 'manual');

    expect(processManager.commands).toEqual(['save-off', 'save-all flush', 'save-on']);
    const backups = await manager.listBackups(server.id);
    expect(backups[0]?.kind).toBe('regular');
  });

  it('returns a blocking preflight issue when the server is still running', async () => {
    const server = await manager.createServer({
      name: 'Preflight Running Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await writeFile(path.join(server.directory, 'server.properties'), 'motd=Running\n');
    const backup = await manager.createBackup(server.id, 'manual');

    const runningServer: ServerInstanceDto = { ...server, status: 'running' };
    (manager as unknown as { servers: Map<string, ServerInstanceDto> }).servers.set(server.id, runningServer);

    const preflight = await manager.getRestoreBackupPreflight({
      serverId: server.id,
      backupId: backup.id,
    });

    expect(preflight.canRun).toBe(false);
    expect(preflight.blockingIssues[0]?.code).toBe('SERVER_MUST_BE_STOPPED');
  });

  it('marks backups without world data and server.properties as corrupted in preflight', async () => {
    const server = await manager.createServer({
      name: 'Corrupted Backup Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    const backupRoot = path.join(server.directory, '.lumix-backups');
    const backupPath = path.join(backupRoot, 'manual-corrupted');
    await fs.mkdir(backupPath, { recursive: true });
    await writeFile(path.join(backupPath, 'ops.json'), '[]');

    const metadata: Omit<BackupInfoDto, 'sizeBytes'> = {
      id: 'manual-corrupted',
      serverId: server.id,
      name: 'Corrupted Backup',
      path: backupPath,
      createdAt: new Date().toISOString(),
      trigger: 'manual',
      kind: 'regular',
      sourceServerState: 'stopped',
    };
    await writeFile(path.join(backupPath, '.lumix-backup.json'), JSON.stringify(metadata, null, 2));

    const preflight = await manager.getRestoreBackupPreflight({
      serverId: server.id,
      backupId: 'manual-corrupted',
    });

    expect(preflight.canRun).toBe(false);
    expect(preflight.blockingIssues.some((issue) => issue.code === 'CORRUPTED_BACKUP')).toBe(true);
  });

  it('creates a pre-restore backup and only restores allowed entries', async () => {
    const server = await manager.createServer({
      name: 'Restore Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await writeFile(path.join(server.directory, 'world', 'level.dat'), 'world-original');
    await writeFile(path.join(server.directory, 'server.properties'), 'motd=Original\n');
    await writeFile(path.join(server.directory, 'mods', 'a.txt'), 'mod-original');
    await writeFile(path.join(server.directory, 'plugins', 'b.txt'), 'plugin-original');
    await writeFile(path.join(server.directory, 'custom.txt'), 'custom-original');

    const backup = await manager.createBackup(server.id, 'manual');

    await writeFile(path.join(server.directory, 'world', 'level.dat'), 'world-mutated');
    await writeFile(path.join(server.directory, 'server.properties'), 'motd=Mutated\n');
    await writeFile(path.join(server.directory, 'mods', 'a.txt'), 'mod-mutated');
    await writeFile(path.join(server.directory, 'plugins', 'b.txt'), 'plugin-mutated');
    await writeFile(path.join(server.directory, 'custom.txt'), 'custom-mutated');

    const result = await manager.restoreBackup({
      serverId: server.id,
      backupId: backup.id,
      createPreRestoreBackup: true,
    });

    expect(result.restoredBackupId).toBe(backup.id);
    expect(result.preRestoreBackupId).toBeTruthy();
    await expect(fs.readFile(path.join(server.directory, 'world', 'level.dat'), 'utf-8')).resolves.toBe('world-original');
    await expect(fs.readFile(path.join(server.directory, 'server.properties'), 'utf-8')).resolves.toContain('motd=Original');
    await expect(fs.readFile(path.join(server.directory, 'mods', 'a.txt'), 'utf-8')).resolves.toBe('mod-original');
    await expect(fs.readFile(path.join(server.directory, 'plugins', 'b.txt'), 'utf-8')).resolves.toBe('plugin-original');
    await expect(fs.readFile(path.join(server.directory, 'custom.txt'), 'utf-8')).resolves.toBe('custom-mutated');
    await expect(fs.stat(path.join(server.directory, '.lumix-backup.json'))).rejects.toThrow();

    const backups = await manager.listBackups(server.id);
    expect(backups).toHaveLength(2);
    expect(backups.find((item) => item.id === backup.id)?.kind).toBe('regular');
    expect(backups.find((item) => item.id === result.preRestoreBackupId)?.kind).toBe('pre-restore');
  });

  it('prunes regular and pre-restore backups independently', async () => {
    const server = await manager.createServer({
      name: 'Prune Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await writeFile(path.join(server.directory, 'server.properties'), 'motd=Prune\n');
    for (let i = 0; i < 3; i += 1) {
      await manager.createBackup(server.id, 'manual');
    }

    const regularBackupsBefore = await manager.listBackups(server.id);
    expect(regularBackupsBefore.filter((backup) => backup.kind === 'regular')).toHaveLength(3);

    const restoreSource = regularBackupsBefore[0];
    expect(restoreSource).toBeTruthy();

    await manager.restoreBackup({
      serverId: server.id,
      backupId: restoreSource!.id,
      createPreRestoreBackup: true,
    });
    await manager.restoreBackup({
      serverId: server.id,
      backupId: restoreSource!.id,
      createPreRestoreBackup: true,
    });
    await manager.restoreBackup({
      serverId: server.id,
      backupId: restoreSource!.id,
      createPreRestoreBackup: true,
    });
    await manager.restoreBackup({
      serverId: server.id,
      backupId: restoreSource!.id,
      createPreRestoreBackup: true,
    });

    const backups = await manager.listBackups(server.id);
    expect(backups.filter((backup) => backup.kind === 'regular')).toHaveLength(3);
    expect(backups.filter((backup) => backup.kind === 'pre-restore')).toHaveLength(3);
  });

  it('skips world session.lock during backups', async () => {
    const server = await manager.createServer({
      name: 'Lock File Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await writeFile(path.join(server.directory, 'world', 'session.lock'), 'locked');
    await writeFile(path.join(server.directory, 'world', 'level.dat'), 'world-data');

    const backup = await manager.createBackup(server.id, 'manual');
    const backupWorldDir = path.join(backup.path, 'world');

    await expect(fs.readFile(path.join(backupWorldDir, 'level.dat'), 'utf-8')).resolves.toBe('world-data');
    await expect(fs.stat(path.join(backupWorldDir, 'session.lock'))).rejects.toThrow();
  });
});
