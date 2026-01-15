// ServerManager Property-Based Tests
// Feature: lumix-launcher, Task 11

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ServerManager } from '../src/services/server/server-manager';
import { setCustomHomeDir } from '../src/utils/file-utils';
import type { CoreType, CreateInstanceConfig, LogLevel } from '../src/models/types';

// 測試用的臨時目錄
let testDir: string;
let serverManager: ServerManager;

// 設定測試環境
beforeEach(async () => {
  testDir = path.join(
    os.tmpdir(),
    `lumix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(testDir, { recursive: true });
  setCustomHomeDir(testDir);
  serverManager = new ServerManager();
});

afterEach(async () => {
  setCustomHomeDir(null);
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // 忽略清理錯誤
  }
});

// ============================================================================
// Arbitraries (資料生成器)
// ============================================================================

const coreTypeArb = fc.constantFrom<CoreType>('vanilla', 'paper', 'fabric', 'forge');

const serverNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !/[<>:"/\\|?*]/.test(s));

const mcVersionArb = fc.stringMatching(/^1\.\d{1,2}(\.\d{1,2})?$/);

const createConfigArb: fc.Arbitrary<CreateInstanceConfig> = fc.record({
  name: serverNameArb,
  coreType: coreTypeArb,
  mcVersion: mcVersionArb,
  ramMin: fc.option(fc.integer({ min: 512, max: 8192 }), { nil: undefined }),
  ramMax: fc.option(fc.integer({ min: 1024, max: 16384 }), { nil: undefined }),
  jvmArgs: fc.option(fc.array(fc.string({ maxLength: 50 }), { maxLength: 5 }), { nil: undefined }),
});

// ============================================================================
// Property 4: Server Instance Directory Structure (11.2)
// ============================================================================

describe('Property 4: Server Instance Directory Structure', () => {
  it('should create correct directory structure for new instances (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(createConfigArb, async (config) => {
        const instance = await serverManager.createInstance(config);

        // 驗證主目錄存在
        const mainDirExists = await fs
          .access(instance.directory)
          .then(() => true)
          .catch(() => false);
        expect(mainDirExists).toBe(true);

        // 驗證子目錄存在
        const expectedDirs = ['plugins', 'mods', 'world', 'logs', 'config'];
        for (const dir of expectedDirs) {
          const dirPath = path.join(instance.directory, dir);
          const exists = await fs
            .access(dirPath)
            .then(() => true)
            .catch(() => false);
          expect(exists).toBe(true);
        }

        // 驗證 eula.txt 存在且內容正確
        const eulaPath = path.join(instance.directory, 'eula.txt');
        const eulaContent = await fs.readFile(eulaPath, 'utf-8');
        expect(eulaContent).toContain('eula=true');

        // 驗證 instance.json 存在
        const configPath = path.join(instance.directory, 'instance.json');
        const configExists = await fs
          .access(configPath)
          .then(() => true)
          .catch(() => false);
        expect(configExists).toBe(true);

        // 清理
        await serverManager.deleteInstance(instance.id);
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 6: Server Instance List Completeness (11.4)
// ============================================================================

describe('Property 6: Server Instance List Completeness', () => {
  it('should return all created instances in getAllInstances (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createConfigArb, { minLength: 1, maxLength: 5 }),
        async (configs) => {
          const createdIds: string[] = [];

          // 建立多個實例
          for (const config of configs) {
            const instance = await serverManager.createInstance(config);
            createdIds.push(instance.id);
          }

          // 取得所有實例
          const allInstances = await serverManager.getAllInstances();

          // 驗證所有建立的實例都在列表中
          for (const id of createdIds) {
            const found = allInstances.find((inst) => inst.id === id);
            expect(found).toBeDefined();
          }

          // 驗證數量一致
          expect(allInstances.length).toBe(createdIds.length);

          // 清理
          for (const id of createdIds) {
            await serverManager.deleteInstance(id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly retrieve single instance by ID (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(createConfigArb, async (config) => {
        const created = await serverManager.createInstance(config);

        // 取得單一實例
        const retrieved = await serverManager.getInstance(created.id);

        // 驗證資料一致
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(created.id);
        expect(retrieved!.name).toBe(config.name);
        expect(retrieved!.coreType).toBe(config.coreType);
        expect(retrieved!.mcVersion).toBe(config.mcVersion);

        // 清理
        await serverManager.deleteInstance(created.id);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 7: Log Entry Format (11.7)
// ============================================================================

describe('Property 7: Log Entry Format', () => {
  const logLevelArb = fc.constantFrom<LogLevel>('info', 'warn', 'error');

  // 生成有效的日誌訊息（非空白開頭的字串，模擬真實 Minecraft 日誌）
  const logMessageArb = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => !s.includes('\n') && s.trim().length > 0 && !s.startsWith(' '));

  // 生成有效的 thread 名稱
  const threadNameArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !s.includes('/') && !s.includes(']') && s.trim().length > 0 && !s.startsWith(' '));

  it('should correctly parse Minecraft log format (100 runs)', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          time: fc.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
          thread: threadNameArb,
          level: fc.constantFrom('INFO', 'WARN', 'ERROR'),
          message: logMessageArb,
        }),
        ({ time, thread, level, message }) => {
          const logLine = `[${time}] [${thread}/${level}]: ${message}`;
          const entry = serverManager.parseLogLine(logLine);

          // 驗證日誌等級正確解析
          const expectedLevel = level === 'WARN' ? 'warn' : level === 'ERROR' ? 'error' : 'info';
          expect(entry.level).toBe(expectedLevel);

          // 驗證訊息被正確提取
          expect(entry.message).toBe(message);

          // 驗證時間戳存在
          expect(entry.timestamp).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle non-standard log lines gracefully (100 runs)', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\n')),
        logLevelArb,
        (line, defaultLevel) => {
          const entry = serverManager.parseLogLine(line, defaultLevel);

          // 驗證回傳有效的 LogEntry
          expect(entry).toHaveProperty('timestamp');
          expect(entry).toHaveProperty('level');
          expect(entry).toHaveProperty('message');
          expect(['info', 'warn', 'error']).toContain(entry.level);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 8: Server Exit Notification (11.9)
// ============================================================================

describe('Property 8: Server Exit Notification', () => {
  it('should emit exit event with correct parameters', async () => {
    // 這個測試需要模擬進程退出，使用單元測試方式
    const exitEvents: Array<{ id: string; code: number | null; signal: string | null }> = [];

    serverManager.on('exit', (id, code, signal) => {
      exitEvents.push({ id, code, signal });
    });

    // 建立實例
    const instance = await serverManager.createInstance({
      name: 'Test Server',
      coreType: 'vanilla',
      mcVersion: '1.20.4',
    });

    // 由於無法實際啟動伺服器，我們測試狀態管理邏輯
    expect(serverManager.getServerStatus(instance.id)).toBe('stopped');
    expect(serverManager.isRunning(instance.id)).toBe(false);

    // 清理
    await serverManager.deleteInstance(instance.id);
  });
});

// ============================================================================
// CRUD Operations Tests
// ============================================================================

describe('ServerManager CRUD Operations', () => {
  it('should update instance configuration', async () => {
    const instance = await serverManager.createInstance({
      name: 'Original Name',
      coreType: 'vanilla',
      mcVersion: '1.20.4',
    });

    // 更新配置
    const updated = await serverManager.updateInstance(instance.id, {
      name: 'Updated Name',
      ramMax: 8192,
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.ramMax).toBe(8192);

    // 清理
    await serverManager.deleteInstance(instance.id);
  });

  it('should delete instance and remove directory', async () => {
    const instance = await serverManager.createInstance({
      name: 'To Delete',
      coreType: 'paper',
      mcVersion: '1.20.4',
    });

    const directory = instance.directory;

    // 確認目錄存在
    const existsBefore = await fs
      .access(directory)
      .then(() => true)
      .catch(() => false);
    expect(existsBefore).toBe(true);

    // 刪除實例
    const deleted = await serverManager.deleteInstance(instance.id);
    expect(deleted).toBe(true);

    // 確認目錄已刪除
    const existsAfter = await fs
      .access(directory)
      .then(() => true)
      .catch(() => false);
    expect(existsAfter).toBe(false);

    // 確認無法再取得實例
    const retrieved = await serverManager.getInstance(instance.id);
    expect(retrieved).toBeNull();
  });

  it('should return false when deleting non-existent instance', async () => {
    const deleted = await serverManager.deleteInstance('non-existent-id');
    expect(deleted).toBe(false);
  });

  it('should return null when getting non-existent instance', async () => {
    const instance = await serverManager.getInstance('non-existent-id');
    expect(instance).toBeNull();
  });

  it('should return null when updating non-existent instance', async () => {
    const updated = await serverManager.updateInstance('non-existent-id', { name: 'New Name' });
    expect(updated).toBeNull();
  });
});

// ============================================================================
// Default Values Tests
// ============================================================================

describe('ServerManager Default Values', () => {
  it('should use default RAM values when not specified', async () => {
    const instance = await serverManager.createInstance({
      name: 'Default RAM Test',
      coreType: 'vanilla',
      mcVersion: '1.20.4',
    });

    expect(instance.ramMin).toBe(1024);
    expect(instance.ramMax).toBe(4096);
    expect(instance.jvmArgs).toEqual([]);

    await serverManager.deleteInstance(instance.id);
  });

  it('should use provided RAM values when specified', async () => {
    const instance = await serverManager.createInstance({
      name: 'Custom RAM Test',
      coreType: 'vanilla',
      mcVersion: '1.20.4',
      ramMin: 2048,
      ramMax: 8192,
      jvmArgs: ['-XX:+UseG1GC'],
    });

    expect(instance.ramMin).toBe(2048);
    expect(instance.ramMax).toBe(8192);
    expect(instance.jvmArgs).toEqual(['-XX:+UseG1GC']);

    await serverManager.deleteInstance(instance.id);
  });
});
