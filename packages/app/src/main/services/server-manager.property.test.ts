/**
 * ServerManager Property Tests
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

// Valid server name generator
const validServerName = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.replace(/[<>:"/\\|?*\r\n]/g, '_').trim());

// Whitespace-only name generator (invalid)
const whitespaceOnlyName = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
  .map((arr) => arr.join(''));

// Core type generator
const coreType = fc.constantFrom(
  'vanilla' as const,
  'paper' as const,
  'spigot' as const,
  'fabric' as const,
  'forge' as const
);

// MC version generator
const mcVersion = fc
  .tuple(
    fc.constant(1),
    fc.integer({ min: 16, max: 21 }),
    fc.integer({ min: 0, max: 4 })
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

// Create server request generator
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

  /**
   * Property 3: Empty Name Rejection
   * 
   * For any string composed entirely of whitespace (including empty string),
   * attempting to create a server with that name SHALL be rejected with an error.
   * 
   * **Feature: server-lifecycle, Property 3: Empty Name Rejection**
   * **Validates: Requirements 1.6**
   */
  it('Property 3: Empty Name Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(whitespaceOnlyName, coreType, mcVersion, async (name, core, version) => {
        const request: CreateServerRequest = {
          name,
          coreType: core,
          mcVersion: version,
        };

        await expect(serverManager.createServer(request)).rejects.toThrow('INVALID_NAME');
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property 3 Extension: Empty string rejection
   */
  it('Property 3 Extension: Empty string rejection', async () => {
    const request: CreateServerRequest = {
      name: '',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };

    await expect(serverManager.createServer(request)).rejects.toThrow('INVALID_NAME');
  });


  /**
   * Property 4: Duplicate Name Rejection
   * 
   * For any existing server name, attempting to create another server
   * with the same name SHALL be rejected with an error.
   * 
   * **Feature: server-lifecycle, Property 4: Duplicate Name Rejection**
   * **Validates: Requirements 1.7**
   */
  it('Property 4: Duplicate Name Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        // 建立第一個伺服器
        await serverManager.createServer(request);

        // 嘗試建立同名伺服器應該失敗
        await expect(serverManager.createServer(request)).rejects.toThrow('DUPLICATE_NAME');
      }),
      { numRuns: 20 } // 減少執行次數避免檔案系統壓力
    );
  });

  /**
   * Property 5: Server Persistence After Creation
   * 
   * For any successfully created server, the server SHALL appear
   * in the server list returned by getAllServers().
   * 
   * **Feature: server-lifecycle, Property 5: Server Persistence After Creation**
   * **Validates: Requirements 1.8**
   */
  it('Property 5: Server Persistence After Creation', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        // 使用唯一名稱避免重複
        const uniqueRequest = {
          ...request,
          name: `${request.name.trim()}-${Date.now()}-${counter++}`,
        };

        // 建立伺服器
        const created = await serverManager.createServer(uniqueRequest);

        // 驗證伺服器出現在列表中
        const servers = await serverManager.getAllServers();
        const found = servers.find((s) => s.id === created.id);

        expect(found).toBeDefined();
        expect(found?.name).toBe(uniqueRequest.name.trim());
        expect(found?.coreType).toBe(uniqueRequest.coreType);
        expect(found?.mcVersion).toBe(uniqueRequest.mcVersion);
        expect(found?.status).toBe('stopped');
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1: Server Directory Creation
   * 
   * For any valid server creation request, the ServerManager SHALL create
   * a directory at {dataPath}/servers/{serverName}/.
   * 
   * **Feature: server-lifecycle, Property 1: Server Directory Creation**
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Server Directory Creation', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        const uniqueName = `${request.name.trim()}-dir-${Date.now()}-${counter++}`;
        const uniqueRequest = { ...request, name: uniqueName };
        const created = await serverManager.createServer(uniqueRequest);

        // 驗證目錄存在
        const serverPath = path.join(testDir, 'servers', uniqueName);
        const exists = await fs.access(serverPath).then(() => true).catch(() => false);

        expect(exists).toBe(true);
        expect(created.directory).toBe(serverPath);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2: Server Creation Generates Required Files
   * 
   * For any successfully created server, the server directory SHALL contain:
   * - eula.txt with content eula=true
   * - run.bat with valid Java launch command
   * - server.json with correct metadata
   * 
   * **Feature: server-lifecycle, Property 2: Server Creation Generates Required Files**
   * **Validates: Requirements 1.3, 1.4, 1.5**
   */
  it('Property 2: Server Creation Generates Required Files', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(createServerRequest, async (request) => {
        const uniqueName = `${request.name.trim()}-files-${Date.now()}-${counter++}`;
        const uniqueRequest = { ...request, name: uniqueName };
        const created = await serverManager.createServer(uniqueRequest);

        // 驗證 eula.txt
        const eulaPath = path.join(created.directory, 'eula.txt');
        const eulaContent = await fs.readFile(eulaPath, 'utf-8');
        expect(eulaContent).toContain('eula=true');

        // 驗證 run.bat
        const batPath = path.join(created.directory, 'run.bat');
        const batContent = await fs.readFile(batPath, 'utf-8');
        expect(batContent).toContain('-jar server.jar');

        // 驗證 server.json
        const jsonPath = path.join(created.directory, 'server.json');
        const jsonContent = await fs.readFile(jsonPath, 'utf-8');
        const metadata = JSON.parse(jsonContent);
        expect(metadata.id).toBe(created.id);
        expect(metadata.name).toBe(uniqueName);
        expect(metadata.coreType).toBe(uniqueRequest.coreType);
        expect(metadata.mcVersion).toBe(uniqueRequest.mcVersion);
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
    // 清理所有程序
    processManager.killAll();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Property 6: Status Transitions Emit Events
   * 
   * For any server status change, a status change event SHALL be emitted
   * with the correct server ID and new status.
   * 
   * **Feature: server-lifecycle, Property 6: Status Transitions Emit Events**
   * **Validates: Requirements 2.6, 2.7**
   */
  it('Property 6: Status Transitions Emit Events', async () => {
    // 建立伺服器
    const request: CreateServerRequest = {
      name: 'test-server-events',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);

    // 建立假的 server.jar
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    // 監聽狀態變更事件
    const statusEvents: Array<{ serverId: string; status: ServerStatus }> = [];
    serverManager.on('status-changed', (event) => {
      statusEvents.push({ serverId: event.serverId, status: event.status });
    });

    // Mock spawn 以避免真正啟動 Java
    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    // 啟動伺服器
    await serverManager.startServer(server.id);

    // 驗證事件
    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
    expect(statusEvents.some((e) => e.serverId === server.id && e.status === 'starting')).toBe(true);
  });

  /**
   * Property 7: Cannot Start Running Server
   * 
   * For any server with status running or starting, attempting to start it
   * SHALL be rejected with an error.
   * 
   * **Feature: server-lifecycle, Property 7: Cannot Start Running Server**
   * **Validates: Requirements 2.8**
   */
  it('Property 7: Cannot Start Running Server', async () => {
    // 建立伺服器
    const request: CreateServerRequest = {
      name: 'test-server-running',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);

    // 建立假的 server.jar
    await fs.writeFile(path.join(server.directory, 'server.jar'), 'fake jar');

    // Mock spawn
    vi.spyOn(processManager, 'spawn').mockImplementation(() => {
      return { pid: 12345 } as any;
    });

    // 啟動伺服器
    await serverManager.startServer(server.id);

    // 嘗試再次啟動應該失敗
    await expect(serverManager.startServer(server.id)).rejects.toThrow('INVALID_STATE');
  });

  /**
   * Property 24: Startup Failure Reverts Status
   * 
   * For any server startup that fails after status was set to starting,
   * the status SHALL be reverted to stopped.
   * 
   * **Feature: server-lifecycle, Property 24: Startup Failure Reverts Status**
   * **Validates: Requirements 8.2**
   */
  it('Property 24: Startup Failure Reverts Status (no server.jar)', async () => {
    // 建立伺服器但不建立 server.jar
    const request: CreateServerRequest = {
      name: 'test-server-no-jar',
      coreType: 'paper',
      mcVersion: '1.20.4',
    };
    const server = await serverManager.createServer(request);

    // 嘗試啟動應該失敗
    await expect(serverManager.startServer(server.id)).rejects.toThrow('JAR_NOT_FOUND');

    // 驗證狀態仍為 stopped
    const updatedServer = await serverManager.getServerById(server.id);
    expect(updatedServer?.status).toBe('stopped');
  });
});
