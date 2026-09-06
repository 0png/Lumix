import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import type { ConnectionInfoDto, ServerInstanceDto } from '../src/shared/ipc-types';
import { FileManager } from '../src/main/services/file-manager';
import { ImportRegistry } from '../src/main/services/import-registry';
import { ImportScanner } from '../src/main/services/import-scanner';
import { ServerManager } from '../src/main/services/server-manager';
import { createFakeJavaDetector } from './test-helpers';

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

describe('ServerManager connection info', () => {
  let rootDir: string;
  let fileManager: FileManager;
  let importRegistry: ImportRegistry;
  let processManager: FakeProcessManager;
  let manager: ServerManager;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-server-connection-'));
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
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('reads server.properties and forwards normalized input into the diagnostics service', async () => {
    const server = await manager.createServer({
      name: 'Connection Test Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await fs.writeFile(path.join(server.directory, 'server.properties'), 'server-port=25570\nserver-ip=192.168.1.8\n', 'utf-8');
    const runningServer: ServerInstanceDto = { ...server, status: 'running', hasServerProperties: true };
    (manager as unknown as { servers: Map<string, ServerInstanceDto> }).servers.set(server.id, runningServer);

    let receivedInput:
      | {
          serverId: string;
          status: ServerInstanceDto['status'];
          hasServerProperties: boolean;
          serverPortRaw?: string;
          serverIpRaw?: string;
        }
      | undefined;

    const fakeResponse: ConnectionInfoDto = {
      serverId: server.id,
      port: 25570,
      serverIp: '192.168.1.8',
      localhostAddress: 'localhost:25570',
      lanAddress: '192.168.1.20:25570',
      publicIp: '203.0.113.2',
      isRunning: true,
      isListeningOnPort: true,
      diagnostics: [],
      checkedAt: new Date().toISOString(),
      hasServerProperties: true,
      firewallStatus: 'allowed',
    };

    Object.assign(manager as unknown as {
      connectionDiagnostics: {
        getConnectionInfo: (input: typeof receivedInput extends infer T ? T : never) => Promise<ConnectionInfoDto>;
      };
    }, {
      connectionDiagnostics: {
        getConnectionInfo: async (input: typeof receivedInput) => {
          receivedInput = input;
          return fakeResponse;
        },
      },
    });

    const result = await manager.getConnectionInfo(server.id);

    expect(result).toEqual(fakeResponse);
    expect(receivedInput).toEqual({
      serverId: server.id,
      status: 'running',
      hasServerProperties: true,
      serverPortRaw: '25570',
      serverIpRaw: '192.168.1.8',
    });
  });
});
