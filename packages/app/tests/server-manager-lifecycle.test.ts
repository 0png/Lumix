import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import type { ServerInstanceDto, ServerStatusEvent } from '../src/shared/ipc-types';
import { FileManager } from '../src/main/services/file-manager';
import { ImportRegistry } from '../src/main/services/import-registry';
import { ImportScanner } from '../src/main/services/import-scanner';
import { ServerManager } from '../src/main/services/server-manager';

class FakeProcessManager extends EventEmitter {
  spawn() {
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
    });
  });

  afterEach(async () => {
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
});
