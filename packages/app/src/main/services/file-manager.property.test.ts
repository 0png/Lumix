/**
 * FileManager Property Tests
 * 使用 fast-check 進行 property-based testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FileManager, type ServerMetadata } from './file-manager';

// ============================================================================
// Test Configuration
// ============================================================================

const PBT_CONFIG = {
  numRuns: 100,
  verbose: true,
};

// ============================================================================
// Generators
// ============================================================================

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

// ISO date string generator (避免 Invalid Date 問題)
const isoDateString = fc
  .integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01 in ms
  .map((ms) => new Date(ms).toISOString());

// Server metadata generator
const serverMetadata: fc.Arbitrary<ServerMetadata> = fc.record({
  id: fc.uuid(),
  name: fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.replace(/[<>:"/\\|?*]/g, '_')),
  coreType: coreType,
  mcVersion: mcVersion,
  ramMin: fc.integer({ min: 512, max: 4096 }),
  ramMax: fc.integer({ min: 1024, max: 16384 }),
  jvmArgs: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  javaPath: fc.option(fc.constant('java'), { nil: undefined }),
  createdAt: isoDateString,
  lastStartedAt: fc.option(isoDateString, { nil: undefined }),
});

// ============================================================================
// Test Suite
// ============================================================================

describe('FileManager Property Tests', () => {
  let testDir: string;
  let fileManager: FileManager;

  beforeEach(async () => {
    // 建立臨時測試目錄
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-test-'));
    fileManager = new FileManager(testDir);
  });

  afterEach(async () => {
    // 清理測試目錄
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Property 20: Metadata Round-Trip
   * 
   * For any valid ServerMetadata object, serializing to JSON and then
   * parsing back SHALL produce an equivalent object.
   * 
   * **Feature: server-lifecycle, Property 20: Metadata Round-Trip**
   * **Validates: Requirements 6.5**
   */
  it.each([...Array(PBT_CONFIG.numRuns).keys()])(
    'Property 20: Metadata Round-Trip (run %i)',
    async () => {
      await fc.assert(
        fc.asyncProperty(serverMetadata, async (metadata) => {
          // 建立伺服器目錄
          const serverPath = await fileManager.createServerDirectory(metadata.name);

          // 寫入 metadata
          await fileManager.writeServerJson(serverPath, metadata);

          // 讀取 metadata
          const loaded = await fileManager.readServerJson(serverPath);

          // 驗證 round-trip 等價性
          expect(loaded.id).toBe(metadata.id);
          expect(loaded.name).toBe(metadata.name);
          expect(loaded.coreType).toBe(metadata.coreType);
          expect(loaded.mcVersion).toBe(metadata.mcVersion);
          expect(loaded.ramMin).toBe(metadata.ramMin);
          expect(loaded.ramMax).toBe(metadata.ramMax);
          expect(loaded.jvmArgs).toEqual(metadata.jvmArgs);
          expect(loaded.javaPath).toBe(metadata.javaPath);
          expect(loaded.createdAt).toBe(metadata.createdAt);
          expect(loaded.lastStartedAt).toBe(metadata.lastStartedAt);

          // 清理此次測試的目錄
          await fileManager.deleteServerDirectory(serverPath);
        }),
        { numRuns: 1 } // 每個 it.each 執行一次
      );
    }
  );

  /**
   * 簡化版 Property 20 測試 - 單次完整驗證
   */
  it('Property 20: Metadata Round-Trip - comprehensive test', async () => {
    await fc.assert(
      fc.asyncProperty(serverMetadata, async (metadata) => {
        const serverPath = await fileManager.createServerDirectory(metadata.name);

        await fileManager.writeServerJson(serverPath, metadata);
        const loaded = await fileManager.readServerJson(serverPath);

        // 完整物件比較
        expect(loaded).toEqual(metadata);

        await fileManager.deleteServerDirectory(serverPath);
      }),
      PBT_CONFIG
    );
  });

  /**
   * 額外驗證：JSON 序列化的穩定性
   */
  it('Property 20 Extension: Double round-trip produces identical results', async () => {
    await fc.assert(
      fc.asyncProperty(serverMetadata, async (metadata) => {
        const serverPath = await fileManager.createServerDirectory(metadata.name);

        // 第一次 round-trip
        await fileManager.writeServerJson(serverPath, metadata);
        const firstLoad = await fileManager.readServerJson(serverPath);

        // 第二次 round-trip
        await fileManager.writeServerJson(serverPath, firstLoad);
        const secondLoad = await fileManager.readServerJson(serverPath);

        // 兩次讀取結果應該相同
        expect(secondLoad).toEqual(firstLoad);

        await fileManager.deleteServerDirectory(serverPath);
      }),
      PBT_CONFIG
    );
  });
});
