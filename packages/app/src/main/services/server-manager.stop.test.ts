/**
 * ServerManager stopServer Property Tests
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
// Test Suite: stopServer Properties
// ============================================================================

describe('ServerManager Property Tests - stopServer', () => {
  let testDir: string;
  let serverManager: ServerManager;
  let processManager: ProcessManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-sm-stop-'));
    const managers = await createTestServerManager(testDir);
    serverManager = managers.serverManager;
    processManager = managers.processManager;
  });

  afterEach(async () => {
    processManager.killAll();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Property 14: Exit Updates Status
   * **Validates: Requirements 5.2, 7.4**
   */
  it('Property 14: Exit Updates Status', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-exit',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    await serverManager.startServer(server.id);
    expect((await serverManager.getServerById(server.id))?.status).toBe('running');

    processManager.emit('exit', server.id, 0);

    const updatedServer = await serverManager.getServerById(server.id);
    expect(updatedServer?.status).toBe('stopped');
  });

  /**
   * Property 14 Extension: Exit with non-zero code updates status
   */
  it('Property 14 Extension: Exit with non-zero code updates status', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-crash',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    await serverManager.startServer(server.id);
    processManager.emit('exit', server.id, 1);

    const updatedServer = await serverManager.getServerById(server.id);
    expect(updatedServer?.status).toBe('stopped');
  });

  /**
   * Property 15: Exit Code Capture
   * **Validates: Requirements 5.3**
   */
  it('Property 15: Exit Code Capture', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-exitcode',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    await serverManager.startServer(server.id);

    let capturedExitCode: number | undefined;
    serverManager.on('status-changed', (event) => {
      if (event.status === 'stopped' && event.exitCode !== undefined) {
        capturedExitCode = event.exitCode;
      }
    });

    processManager.emit('exit', server.id, 42);
    expect(capturedExitCode).toBe(42);
  });

  /**
   * Property 16: Cannot Stop Stopped Server
   * **Validates: Requirements 5.6**
   */
  it('Property 16: Cannot Stop Stopped Server', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-already-stopped',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);

    expect((await serverManager.getServerById(server.id))?.status).toBe('stopped');
    await expect(serverManager.stopServer(server.id)).rejects.toThrow('INVALID_STATE');
  });

  /**
   * Property 13: Stop Sends Stop Command
   * **Validates: Requirements 5.1**
   */
  it('Property 13: Stop Sends Stop Command', async () => {
    const request: CreateServerRequest = {
      name: 'test-server-stop-cmd',
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
    await serverManager.stopServer(server.id);

    expect(writeStdinSpy).toHaveBeenCalledWith(server.id, 'stop');
  });
});
