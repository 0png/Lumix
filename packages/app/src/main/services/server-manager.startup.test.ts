/**
 * ServerManager Startup Property Tests
 * 測試伺服器啟動載入功能
 *
 * Property 17: Servers Loaded on Startup
 * Property 22: Startup Sets All to Stopped
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServerManager } from './server-manager';
import { FileManager, ServerMetadata } from './file-manager';
import { ProcessManager } from './process-manager';
import * as fc from 'fast-check';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestMetadata(overrides: Partial<ServerMetadata> = {}): ServerMetadata {
  return {
    id: crypto.randomUUID(),
    name: `TestServer-${Date.now()}`,
    coreType: 'vanilla',
    mcVersion: '1.20.4',
    ramMin: 1024,
    ramMax: 2048,
    jvmArgs: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('ServerManager Startup Property Tests', () => {
  let tempDir: string;
  let fileManager: FileManager;
  let processManager: ProcessManager;
  let serverManager: ServerManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-startup-test-'));
    fileManager = new FileManager(tempDir);
    processManager = new ProcessManager();
    serverManager = new ServerManager({
      fileManager,
      processManager,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Property 17: Servers Loaded on Startup
   * 啟動時應載入所有現有伺服器
   */
  describe('Property 17: Servers Loaded on Startup', () => {
    it('should load all existing servers on startup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (serverCount) => {
            // 建立測試伺服器目錄和 metadata
            const serversPath = fileManager.getServersPath();
            await fs.mkdir(serversPath, { recursive: true });

            const expectedServers: ServerMetadata[] = [];
            for (let i = 0; i < serverCount; i++) {
              const metadata = createTestMetadata({
                id: `server-${i}`,
                name: `Server-${i}-${Date.now()}`,
              });
              expectedServers.push(metadata);

              const serverPath = path.join(serversPath, metadata.name);
              await fs.mkdir(serverPath, { recursive: true });
              await fs.writeFile(
                path.join(serverPath, 'server.json'),
                JSON.stringify(metadata, null, 2)
              );
            }

            // 建立新的 ServerManager 並載入
            const newManager = new ServerManager({
              fileManager,
              processManager,
            });
            await newManager.loadServers();

            // 驗證所有伺服器都被載入
            const loadedServers = await newManager.getAllServers();
            expect(loadedServers.length).toBe(serverCount);

            for (const expected of expectedServers) {
              const loaded = loadedServers.find((s) => s.id === expected.id);
              expect(loaded).toBeDefined();
              expect(loaded!.name).toBe(expected.name);
              expect(loaded!.coreType).toBe(expected.coreType);
              expect(loaded!.mcVersion).toBe(expected.mcVersion);
            }

            // 清理
            await fs.rm(serversPath, { recursive: true, force: true });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle empty servers directory', async () => {
      await serverManager.loadServers();
      const servers = await serverManager.getAllServers();
      expect(servers).toEqual([]);
    });

    it('should skip directories without server.json', async () => {
      const serversPath = fileManager.getServersPath();
      await fs.mkdir(serversPath, { recursive: true });

      // 建立一個沒有 server.json 的目錄
      const invalidDir = path.join(serversPath, 'invalid-server');
      await fs.mkdir(invalidDir, { recursive: true });

      // 建立一個有效的伺服器
      const validMetadata = createTestMetadata({ name: 'valid-server' });
      const validDir = path.join(serversPath, validMetadata.name);
      await fs.mkdir(validDir, { recursive: true });
      await fs.writeFile(
        path.join(validDir, 'server.json'),
        JSON.stringify(validMetadata, null, 2)
      );

      await serverManager.loadServers();
      const servers = await serverManager.getAllServers();

      // 只應載入有效的伺服器
      expect(servers.length).toBe(1);
      expect(servers[0]!.name).toBe('valid-server');
    });
  });

  /**
   * Property 22: Startup Sets All to Stopped
   * 啟動時所有伺服器狀態應設為 stopped
   */
  describe('Property 22: Startup Sets All to Stopped', () => {
    it('should set all loaded servers to stopped status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (serverCount) => {
            const serversPath = fileManager.getServersPath();
            await fs.mkdir(serversPath, { recursive: true });

            // 建立伺服器（metadata 中沒有 status 欄位）
            for (let i = 0; i < serverCount; i++) {
              const metadata = createTestMetadata({
                id: `server-${i}`,
                name: `Server-${i}-${Date.now()}`,
              });

              const serverPath = path.join(serversPath, metadata.name);
              await fs.mkdir(serverPath, { recursive: true });
              await fs.writeFile(
                path.join(serverPath, 'server.json'),
                JSON.stringify(metadata, null, 2)
              );
            }

            // 載入伺服器
            const newManager = new ServerManager({
              fileManager,
              processManager,
            });
            await newManager.loadServers();

            // 驗證所有伺服器狀態都是 stopped
            const servers = await newManager.getAllServers();
            for (const server of servers) {
              expect(server.status).toBe('stopped');
            }

            // 清理
            await fs.rm(serversPath, { recursive: true, force: true });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not have any running servers after startup', async () => {
      const serversPath = fileManager.getServersPath();
      await fs.mkdir(serversPath, { recursive: true });

      // 建立多個伺服器
      for (let i = 0; i < 3; i++) {
        const metadata = createTestMetadata({
          id: `server-${i}`,
          name: `Server-${i}`,
        });

        const serverPath = path.join(serversPath, metadata.name);
        await fs.mkdir(serverPath, { recursive: true });
        await fs.writeFile(
          path.join(serverPath, 'server.json'),
          JSON.stringify(metadata, null, 2)
        );
      }

      await serverManager.loadServers();
      const servers = await serverManager.getAllServers();

      // 確認沒有任何伺服器是 running 或 starting 狀態
      const runningServers = servers.filter(
        (s) => s.status === 'running' || s.status === 'starting'
      );
      expect(runningServers.length).toBe(0);
    });
  });

  /**
   * 額外測試：載入後的伺服器應可正常操作
   */
  describe('Loaded servers should be operational', () => {
    it('should be able to get server by id after loading', async () => {
      const serversPath = fileManager.getServersPath();
      await fs.mkdir(serversPath, { recursive: true });

      const metadata = createTestMetadata({
        id: 'test-server-id',
        name: 'TestServer',
      });

      const serverPath = path.join(serversPath, metadata.name);
      await fs.mkdir(serverPath, { recursive: true });
      await fs.writeFile(
        path.join(serverPath, 'server.json'),
        JSON.stringify(metadata, null, 2)
      );

      await serverManager.loadServers();

      const server = await serverManager.getServerById('test-server-id');
      expect(server).not.toBeNull();
      expect(server!.id).toBe('test-server-id');
      expect(server!.name).toBe('TestServer');
    });

    it('should preserve all metadata fields after loading', async () => {
      const serversPath = fileManager.getServersPath();
      await fs.mkdir(serversPath, { recursive: true });

      const metadata = createTestMetadata({
        id: 'full-metadata-test',
        name: 'FullMetadataServer',
        coreType: 'paper',
        mcVersion: '1.20.4',
        ramMin: 2048,
        ramMax: 4096,
        jvmArgs: ['-XX:+UseG1GC'],
        javaPath: '/custom/java/path',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastStartedAt: '2024-01-02T00:00:00.000Z',
      });

      const serverPath = path.join(serversPath, metadata.name);
      await fs.mkdir(serverPath, { recursive: true });
      await fs.writeFile(
        path.join(serverPath, 'server.json'),
        JSON.stringify(metadata, null, 2)
      );

      await serverManager.loadServers();

      const server = await serverManager.getServerById('full-metadata-test');
      expect(server).not.toBeNull();
      expect(server!.coreType).toBe('paper');
      expect(server!.mcVersion).toBe('1.20.4');
      expect(server!.ramMin).toBe(2048);
      expect(server!.ramMax).toBe(4096);
      expect(server!.jvmArgs).toEqual(['-XX:+UseG1GC']);
      expect(server!.javaPath).toBe('/custom/java/path');
      expect(server!.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(server!.lastStartedAt).toBe('2024-01-02T00:00:00.000Z');
    });
  });
});
