/**
 * ServerManager Property Tests - createServer & startServer
 * 使用 fast-check 進行 property-based testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ServerManager } from './server-manager';
import { FileManager } from './file-manager';
import { ProcessManager } from './process-manager';
import type { CreateServerRequest, ServerStatus } from '../../shared/ipc-types';

// ============================================================================
// Test Configuration
// ============================================================================

const PBT_CONFIG = {
  numRuns: 50,
  verbose: true,
};

// ============================================================================
// Generators
// ============================================================================

const validServerName = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.replace(/[<>:"/\\|?*\r\n]/g, '_').trim());

const whitespaceOnlyName = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
  .map((arr) => arr.join(''));

const coreType = fc.constantFrom(
  'vanilla' as const,
  'paper' as const,
  'spigot' as const,
  'fabric' as const,
  'forge' as const
);

const mcVersion = fc
  .tuple(fc.constant(1), fc.integer({ min: 16, max: 21 }), fc.integer({ min: 0, max: 4 }))
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

const createServerRequest: fc.Arbitrary<CreateServerRequest> = fc.record({
  name: validServerName,
  coreType: coreType,
  mcVersion: mcVersion,
  ramMin: fc.option(fc.integer({ min: 512, max: 4096 }), { nil: undefined }),
  ramMax: fc.option(fc.integer({ min: 1024, max: 16384 }), { nil: undefined }),
  jvmArgs: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }), { nil: undefined }),
});

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
// Test Suite: createServer Properties
// ============================================================================

describe('ServerManager Property Tests - createServer', () => {
  let testDir: string;
  let serverManager: ServerManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-sm-test-'));
    const managers = await createTestServerManager(testDir);
    serverManager = managers.serverManager;
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /** Property 3: Empty Name Rejection - Validates: Requirements 1.6 */
  it('Property 3: Empty Name Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(whitespaceOnlyName, coreType, mcVersion, async (name, core, version) => {
        const request: CreateServerRequest = { name, coreType: core, mcVersion: version };
        await expect(serverManager.createServer(request)).rejects.toThrow('INVALID_NAME');
      }),
      PBT_CONFIG
    );
  });

  it('Property 3 Extension: Empty string rejection', async () => {
    const request: CreateServerRequest = { name: '', coreType: 'paper', mcVersion: '1.20.4' };
    await expect(serverManager.createServer(request)).rejects.toThrow('INVALID_NAME');
  });

  /** Property 4: Duplicate Name Rejection - Validates: Requirements 1.7 */
  it('Property 4: Duplicate Name Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        await serverManager.createServer(request);
        await expect(serverManager.createServer(request)).rejects.toThrow('DUPLICATE_NAME');
      }),
      { numRuns: 20 }
    );
  });

  /** Property 5: Server Persistence After Creation - Validates: Requirements 1.8 */
  it('Property 5: Server Persistence After Creation', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        const uniqueRequest = { ...request, name: `${request.name.trim()}-${Date.now()}-${counter++}` };
        const created = await serverManager.createServer(uniqueRequest);
        const servers = await serverManager.getAllServers();
        const found = servers.find((s) => s.id === created.id);
        expect(found).toBeDefined();
        expect(found?.name).toBe(uniqueRequest.name.trim());
        expect(found?.status).toBe('stopped');
      }),
      { numRuns: 20 }
    );
  });

  /** Property 1: Server Directory Creation - Validates: Requirements 1.1 */
  it('Property 1: Server Directory Creation', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        const uniqueName = `${request.name.trim()}-dir-${Date.now()}-${counter++}`;
        const uniqueRequest = { ...request, name: uniqueName };
        const created = await serverManager.createServer(uniqueRequest);
        const serverPath = path.join(testDir, 'servers', uniqueName);
        const exists = await fs.access(serverPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        expect(created.directory).toBe(serverPath);
      }),
      { numRuns: 20 }
    );
  });

  /** Property 2: Server Creation Generates Required Files - Validates: Requirements 1.3, 1.4, 1.5 */
  it('Property 2: Server Creation Generates Required Files', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        const uniqueName = `${request.name.trim()}-files-${Date.now()}-${counter++}`;
        const uniqueRequest = { ...request, name: uniqueName };
        const created = await serverManager.createServer(uniqueRequest);

        const eulaContent = await fs.readFile(path.join(created.directory, 'eula.txt'), 'utf-8');
        expect(eulaContent).toContain('eula=true');

        const batContent = await fs.readFile(path.join(created.directory, 'run.bat'), 'utf-8');
        expect(batContent).toContain('-jar server.jar');

        const jsonContent = await fs.readFile(path.join(created.directory, 'server.json'), 'utf-8');
        const metadata = JSON.parse(jsonContent);
        expect(metadata.id).toBe(created.id);
        expect(metadata.name).toBe(uniqueName);
      }),
      { numRuns: 20 }
    );
  });
});

// ============================================================================
// Test Suite: startServer Properties
// ============================================================================

describe('ServerManager Property Tests - startServer', () => {
  let testDir: string;
  let serverManager: ServerManager;
  let processManager: ProcessManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-sm-start-'));
    const managers = await createTestServerManager(testDir);
    serverManager = managers.serverManager;
    processManager = managers.processManager;
  });

  afterEach(async () => {
    processManager.killAll();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /** Property 6: Status Transitions Emit Events - Validates: Requirements 2.6, 2.7 */
  it('Property 6: Status Transitions Emit Events', async () => {
    const request: CreateServerRequest = { name: 'test-server-events', coreType: 'paper', mcVersion: '1.20.4' };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    const statusEvents: Array<{ serverId: string; status: ServerStatus }> = [];
    serverManager.on('status-changed', (event) => {
      statusEvents.push({ serverId: event.serverId, status: event.status });
    });

    vi.spyOn(processManager, 'spawn').mockImplementation(() => ({ pid: 12345 }) as any);
    await serverManager.startServer(server.id);

    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
    expect(statusEvents.some((e) => e.serverId === server.id && e.status === 'starting')).toBe(true);
  });

  /** Property 7: Cannot Start Running Server - Validates: Requirements 2.8 */
  it('Property 7: Cannot Start Running Server', async () => {
    const request: CreateServerRequest = { name: 'test-server-running', coreType: 'paper', mcVersion: '1.20.4' };
    const server = await serverManager.createServer(request);
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    vi.spyOn(processManager, 'spawn').mockImplementation(() => ({ pid: 12345 }) as any);
    await serverManager.startServer(server.id);

    await expect(serverManager.startServer(server.id)).rejects.toThrow('INVALID_STATE');
  });

  /** Property 24: Startup Failure Reverts Status - Validates: Requirements 8.2 */
  it('Property 24: Startup Failure Reverts Status (no server.jar)', async () => {
    const request: CreateServerRequest = { name: 'test-server-no-jar', coreType: 'paper', mcVersion: '1.20.4' };
    const server = await serverManager.createServer(request);

    await expect(serverManager.startServer(server.id)).rejects.toThrow('JAR_NOT_FOUND');

    const updatedServer = await serverManager.getServerById(server.id);
    expect(updatedServer?.status).toBe('stopped');
  });
});
