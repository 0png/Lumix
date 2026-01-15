/**
 * ServerManager sendCommand Property Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ServerManager } from './server-manager';
import { FileManager } from './file-manager';
import { ProcessManager } from './process-manager';
import type { CreateServerRequest } from '../../shared/ipc-types';

// ============================================================================
// Test Helpers
// ============================================================================

async function createTestServerManager(testDir: string): Promise<{
  serverManager: ServerManager;
  processManager: ProcessManager;
}> {
  const fileManager = new FileManager(testDir);
  const processManager = new ProcessManager();
  const serverManager = new ServerManager({
    fileManager,
    processManager,
    defaultJavaPath: 'java',
  });
  return { serverManager, processManager };
}

// ============================================================================
// Test Suite: sendCommand Properties
// ============================================================================

describe('ServerManager Property Tests - sendCommand', () => {
  let testDir: string;
  let serverManager: ServerManager;
  let processManager: ProcessManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-sm-cmd-'));
    const managers = await createTestServerManager(testDir);
    serverManager = managers.serverManager;
    processManager = managers.processManager;
  });

  afterEach(async () => {
    processManager.killAll();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Property 10: Command Writing to Stdin
   * **Validates: Requirements 4.1**
   */
  it('Property 10: Command Writing to Stdin', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-stdin',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    const writeStdinSpy = vi.spyOn(processManager, 'writeStdin').mockReturnValue(true);

    await serverManager.startServer(server.id);
    await serverManager.sendCommand(server.id, 'say Hello World');

    expect(writeStdinSpy).toHaveBeenCalledWith(server.id, 'say Hello World');
  });

  /**
   * Property 11: Command Echo in Log
   * **Validates: Requirements 4.2**
   */
  it('Property 11: Command Echo in Log', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-echo',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });
    vi.spyOn(processManager, 'writeStdin').mockReturnValue(true);

    const logEntries: Array<{ message: string }> = [];
    serverManager.on('log-entry', (event) => {
      logEntries.push({ message: event.entry.message });
    });

    await serverManager.startServer(server.id);
    await serverManager.sendCommand(server.id, 'gamemode creative');

    expect(logEntries.some((e) => e.message.includes('> gamemode creative'))).toBe(true);
  });

  /**
   * Property 12: Cannot Command Stopped Server
   * **Validates: Requirements 4.3**
   */
  it('Property 12: Cannot Command Stopped Server', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-cmd-stopped',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);

    expect((await serverManager.getServerById(server.id))?.status).toBe('stopped');
    await expect(serverManager.sendCommand(server.id, 'say test')).rejects.toThrow('INVALID_STATE');
  });

  /**
   * Property 12 Extension: Cannot command starting server
   */
  it('Property 12 Extension: Cannot command starting server', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-cmd-starting',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    let testedDuringStarting = false;
    serverManager.on('status-changed', async (event) => {
      if (event.status === 'starting' && !testedDuringStarting) {
        testedDuringStarting = true;
        await expect(serverManager.sendCommand(server.id, 'test')).rejects.toThrow('INVALID_STATE');
      }
    });

    await serverManager.startServer(server.id);
  });

  /**
   * Property: Various commands are written correctly
   */
  it('Property: Various commands are written correctly', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-various-cmds',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    const writeStdinSpy = vi.spyOn(processManager, 'writeStdin').mockReturnValue(true);

    await serverManager.startServer(server.id);

    const commands = ['help', 'list', 'op player1', 'gamemode survival player2', 'time set day'];
    for (const cmd of commands) {
      await serverManager.sendCommand(server.id, cmd);
      expect(writeStdinSpy).toHaveBeenCalledWith(server.id, cmd);
    }
  });
});
