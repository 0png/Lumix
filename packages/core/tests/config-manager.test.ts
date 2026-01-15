// ConfigManager Property-Based Tests
// Feature: lumix-launcher, Property 5: Configuration Round-Trip

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../src/services/config-manager';
import { setCustomHomeDir } from '../src/utils/file-utils';
import type { SettingsFile, InstanceConfig, CoreType, Theme, Language } from '../src/models/types';

// 測試用的臨時目錄
let testDir: string;

// 設定測試環境
beforeEach(async () => {
  // 建立臨時測試目錄
  testDir = path.join(os.tmpdir(), `lumix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testDir, { recursive: true });

  // 設定自訂 home 目錄
  setCustomHomeDir(testDir);
});

afterEach(async () => {
  // 還原 home 目錄
  setCustomHomeDir(null);

  // 清理測試目錄
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
const themeArb = fc.constantFrom<Theme>('light', 'dark', 'system');
const languageArb = fc.constantFrom<Language>('zh-TW', 'en');

const settingsArb: fc.Arbitrary<SettingsFile> = fc.record({
  theme: themeArb,
  language: languageArb,
  defaultRamMin: fc.integer({ min: 512, max: 16384 }),
  defaultRamMax: fc.integer({ min: 512, max: 16384 }),
  autoCheckUpdate: fc.boolean(),
  javaInstallations: fc.array(
    fc.record({
      path: fc.string({ minLength: 1, maxLength: 100 }),
      version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
      majorVersion: fc.integer({ min: 8, max: 21 }),
    }),
    { maxLength: 5 }
  ),
});

const instanceConfigArb: fc.Arbitrary<InstanceConfig> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  coreType: coreTypeArb,
  mcVersion: fc.stringMatching(/^1\.\d{1,2}(\.\d{1,2})?$/),
  javaPath: fc.string({ minLength: 1, maxLength: 200 }),
  ramMin: fc.integer({ min: 512, max: 16384 }),
  ramMax: fc.integer({ min: 512, max: 16384 }),
  jvmArgs: fc.array(fc.string({ maxLength: 50 }), { maxLength: 10 }),
  createdAt: fc.date().map((d) => d.toISOString()),
  lastStartedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('ConfigManager', () => {
  describe('Property 5: Configuration Round-Trip', () => {
    it('should preserve SettingsFile through serialization (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(settingsArb, async (settings) => {
          const configManager = new ConfigManager();

          // 寫入設定
          await configManager.updateSettings(settings);

          // 清除快取後重新讀取
          configManager.clearCache();
          const loaded = await configManager.getSettings();

          // 驗證所有欄位
          expect(loaded.theme).toBe(settings.theme);
          expect(loaded.language).toBe(settings.language);
          expect(loaded.defaultRamMin).toBe(settings.defaultRamMin);
          expect(loaded.defaultRamMax).toBe(settings.defaultRamMax);
          expect(loaded.autoCheckUpdate).toBe(settings.autoCheckUpdate);
          expect(loaded.javaInstallations).toEqual(settings.javaInstallations);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve InstanceConfig through serialization (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(instanceConfigArb, async (config) => {
          const configManager = new ConfigManager();

          // 寫入實例配置
          await configManager.saveInstanceConfig(config);

          // 清除快取後重新讀取
          configManager.clearCache();
          const loaded = await configManager.getInstanceConfig(config.id);

          // 驗證配置完全相同
          expect(loaded).not.toBeNull();
          expect(loaded).toEqual(config);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Default Values', () => {
    it('should return default settings when file does not exist', async () => {
      const configManager = new ConfigManager();
      const settings = await configManager.getSettings();

      expect(settings.theme).toBe('system');
      expect(settings.language).toBe('zh-TW');
      expect(settings.defaultRamMin).toBe(1024);
      expect(settings.defaultRamMax).toBe(4096);
      expect(settings.autoCheckUpdate).toBe(true);
      expect(settings.javaInstallations).toEqual([]);
    });

    it('should merge partial settings with defaults', async () => {
      const configManager = new ConfigManager();

      // 先建立一個只有部分欄位的設定檔
      const settingsPath = path.join(testDir, '.lumix', 'settings.json');
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify({ theme: 'dark' }));

      const settings = await configManager.getSettings();

      // 應該保留指定的值，其他使用預設值
      expect(settings.theme).toBe('dark');
      expect(settings.language).toBe('zh-TW');
      expect(settings.defaultRamMin).toBe(1024);
    });
  });

  describe('Error Recovery', () => {
    it('should handle corrupted JSON gracefully', async () => {
      const configManager = new ConfigManager();

      // 建立損壞的設定檔
      const settingsPath = path.join(testDir, '.lumix', 'settings.json');
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, '{ invalid json }}}');

      // 應該回傳預設值而不是拋出錯誤
      const settings = await configManager.getSettings();
      expect(settings.theme).toBe('system');
    });

    it('should return null for non-existent instance', async () => {
      const configManager = new ConfigManager();
      const config = await configManager.getInstanceConfig('non-existent-id');
      expect(config).toBeNull();
    });
  });

  describe('Cache Behavior', () => {
    it('should cache settings after first read', async () => {
      const configManager = new ConfigManager();

      // 第一次讀取（會建立預設設定檔）
      const settings1 = await configManager.getSettings();
      expect(settings1.theme).toBe('system');

      // 修改檔案（模擬外部變更）
      const settingsPath = path.join(testDir, '.lumix', 'settings.json');
      const modifiedSettings = { ...settings1, theme: 'light' as const };
      await fs.writeFile(settingsPath, JSON.stringify(modifiedSettings));

      // 第二次讀取應該回傳快取的值
      const settings2 = await configManager.getSettings();
      expect(settings2.theme).toBe('system'); // 仍然是快取的值

      // 清除快取後應該讀取新值
      configManager.clearCache();
      const settings3 = await configManager.getSettings();
      expect(settings3.theme).toBe('light');
    });
  });
});
