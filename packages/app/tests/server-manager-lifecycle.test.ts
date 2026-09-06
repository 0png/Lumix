import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import type { ServerInstanceDto, ServerStatusEvent } from '../src/shared/ipc-types';
import { FileManager } from '../src/main/services/file-manager';
import { ImportRegistry } from '../src/main/services/import-registry';
import { ImportScanner } from '../src/main/services/import-scanner';
import { ServerManager } from '../src/main/services/server-manager';
import { ManagedServerRegistry } from '../src/main/services/managed-server-registry';
import { SettingsService } from '../src/main/services/settings-service';
import { createFakeJavaDetector } from './test-helpers';

class FakeProcessManager extends EventEmitter {
  public spawnCalls: unknown[] = [];

  spawn() {
    this.spawnCalls.push(arguments[0]);
    return {} as never;
  }

  writeStdin(): boolean {
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

describe('ServerManager process lifecycle', () => {
  let rootDir: string;
  let processManager: FakeProcessManager;
  let manager: ServerManager;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-server-lifecycle-'));
    processManager = new FakeProcessManager();
    manager = new ServerManager({
      fileManager: new FileManager(rootDir),
      importRegistry: new ImportRegistry(rootDir),
      importScanner: new ImportScanner(),
      processManager: processManager as never,
      defaultJavaPath: 'java',
      javaDetector: createFakeJavaDetector(),
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  async function createRunningServer(): Promise<ServerInstanceDto> {
    const server = await manager.createServer({
      name: 'Lifecycle Test Server',
      coreType: 'vanilla',
      mcVersion: '1.21.1',
      javaPath: 'java',
    });
    const runningServer = { ...server, status: 'running' as const };
    (manager as unknown as { servers: Map<string, ServerInstanceDto> }).servers.set(
      server.id,
      runningServer
    );
    return runningServer;
  }

  it('marks a silent process exit as unexpected even when the exit code is zero', async () => {
    const server = await createRunningServer();
    const events: ServerStatusEvent[] = [];
    manager.on('status-changed', (event: ServerStatusEvent) => events.push(event));

    processManager.emit('exit', server.id, 0, null);

    expect(events.at(-1)).toEqual({
      serverId: server.id,
      status: 'stopped',
      exitCode: 0,
      unexpected: true,
      serverName: server.name,
      latestLogPath: path.join(server.directory, 'logs', 'latest.log'),
      serverDirectory: server.directory,
    });
  });

  it('does not mark a stop console command as an unexpected exit', async () => {
    const server = await createRunningServer();
    const events: ServerStatusEvent[] = [];
    manager.on('status-changed', (event: ServerStatusEvent) => events.push(event));

    await manager.sendCommand(server.id, '/stop');
    processManager.emit('exit', server.id, 0, null);

    expect(events.at(-1)?.unexpected).toBe(false);
    expect(events.at(-1)?.status).toBe('stopped');
  });

  it('rejects JVM arguments managed by Lumix at the backend boundary', async () => {
    const server = await manager.createServer({
      name: 'JVM Validation Server',
      coreType: 'vanilla',
      mcVersion: '1.21.1',
      javaSelectionMode: 'auto',
    });

    await expect(manager.updateServer({
      id: server.id,
      jvmArgs: ['-Dmessage=hello world', '-Xmx8192M'],
    })).rejects.toThrow('VALIDATION_ERROR');
  });

  it('uses persisted workspace defaults for a server created through the backend', async () => {
    const settingsService = new SettingsService(rootDir);
    await settingsService.save({ defaultRamMax: 8192 });
    const persistedManager = new ServerManager({
      fileManager: new FileManager(rootDir),
      importRegistry: new ImportRegistry(rootDir),
      importScanner: new ImportScanner(),
      processManager: new FakeProcessManager() as never,
      defaultJavaPath: 'java',
      settingsService,
      managedServerRegistry: new ManagedServerRegistry(rootDir),
      javaDetector: createFakeJavaDetector(),
    });

    const server = await persistedManager.createServer({
      name: 'Persisted Defaults Server',
      coreType: 'vanilla',
      mcVersion: '1.21.1',
      javaSelectionMode: 'auto',
    });

    expect(server.ramMax).toBe(8192);
    expect(server.ramMin).toBe(4096);
    expect(server.directory).toBe(path.join(rootDir, 'servers', 'Persisted Defaults Server'));
    expect(server.backupSettings?.regularRetention).toBe(3);
  });

  it('schedules automatic restarts with bounded backoff and reports exhaustion', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const restartProcessManager = new FakeProcessManager();
    const restartManager = new ServerManager({
      fileManager: new FileManager(rootDir),
      importRegistry: new ImportRegistry(rootDir),
      importScanner: new ImportScanner(),
      processManager: restartProcessManager as never,
      defaultJavaPath: 'java',
      javaDetector: createFakeJavaDetector(),
    });
    const created = await restartManager.createServer({
      name: 'Restart Server',
      coreType: 'vanilla',
      mcVersion: '1.21.1',
      javaSelectionMode: 'auto',
    });
    await fs.writeFile(path.join(created.directory, 'server.jar'), 'test-jar');
    const running = {
      ...created,
      status: 'running' as const,
      autoRestart: { enabled: true, maxAttempts: 2 },
    };
    (restartManager as unknown as { servers: Map<string, ServerInstanceDto> }).servers.set(created.id, running);

    const events: Array<{ type: string; attempt?: number; delayMs?: number }> = [];
    restartManager.on('auto-restart', (event) => events.push(event));

    const waitForRunning = async () => {
      for (let i = 0; i < 20; i += 1) {
        if ((await restartManager.getServerById(created.id))?.status === 'running') return;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    };
    const waitForSpawnCount = async (count: number) => {
      await vi.waitFor(() => {
        expect(restartProcessManager.spawnCalls.length).toBeGreaterThanOrEqual(count);
      }, { timeout: 1000, interval: 10 });
    };

    restartProcessManager.emit('exit', created.id, 1, null);
    expect(events[0]).toMatchObject({ type: 'scheduled', attempt: 1, delayMs: 10000 });

    await vi.advanceTimersByTimeAsync(10000);
    await waitForSpawnCount(1);
    expect(restartProcessManager.spawnCalls).toHaveLength(1);
    await waitForRunning();

    restartProcessManager.emit('exit', created.id, 1, null);
    expect(events[1]).toMatchObject({ type: 'scheduled', attempt: 2, delayMs: 30000 });

    await vi.advanceTimersByTimeAsync(30000);
    await waitForSpawnCount(2);
    expect(restartProcessManager.spawnCalls).toHaveLength(2);
    await waitForRunning();

    restartProcessManager.emit('exit', created.id, 1, null);
    expect(events.at(-1)).toMatchObject({ type: 'exhausted', attempt: 2 });
    expect((await restartManager.getServerById(created.id))?.status).toBe('stopped');
    await restartManager.cleanup();
  });
});
