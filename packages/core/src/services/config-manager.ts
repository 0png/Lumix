// Configuration Manager for Lumix
// Handles reading/writing JSON configuration files with error recovery

import {
  type SettingsFile,
  type InstanceConfig,
  DEFAULT_SETTINGS,
} from '../models/types';
import {
  getSettingsPath,
  getInstancesDir,
  readJsonFile,
  writeJsonFile,
  fileExists,
  ensureDir,
  listSubDirs,
} from '../utils/file-utils';
import path from 'node:path';

/**
 * ConfigManager 負責管理應用程式設定和實例配置
 * - 讀取/寫入 JSON 配置檔
 * - 處理配置檔損壞情況
 * - 提供預設值
 */
export class ConfigManager {
  private settingsCache: SettingsFile | null = null;
  private instancesCache: Map<string, InstanceConfig> = new Map();

  /**
   * 取得應用程式設定（別名方法）
   */
  async loadSettings(): Promise<SettingsFile> {
    return this.getSettings();
  }

  /**
   * 取得應用程式設定
   * 如果設定檔不存在或損壞，回傳預設值
   */
  async getSettings(): Promise<SettingsFile> {
    if (this.settingsCache) {
      return this.settingsCache;
    }

    const settingsPath = getSettingsPath();
    const settings = await readJsonFile<SettingsFile>(settingsPath);

    if (settings) {
      // 驗證並補充缺失的欄位
      this.settingsCache = this.mergeWithDefaults(settings);
    } else {
      // 設定檔不存在或損壞，使用預設值
      this.settingsCache = { ...DEFAULT_SETTINGS };
      // 寫入預設設定檔
      await this.saveSettings(this.settingsCache);
    }

    return this.settingsCache;
  }

  /**
   * 更新應用程式設定
   */
  async updateSettings(partial: Partial<SettingsFile>): Promise<SettingsFile> {
    const current = await this.getSettings();
    const updated: SettingsFile = { ...current, ...partial };

    await this.saveSettings(updated);
    this.settingsCache = updated;

    return updated;
  }

  /**
   * 儲存設定到檔案（公開方法）
   */
  async saveSettings(settings: SettingsFile): Promise<void> {
    const settingsPath = getSettingsPath();
    await writeJsonFile(settingsPath, settings);
    this.settingsCache = settings;
  }

  /**
   * 合併設定與預設值，確保所有欄位都存在
   */
  private mergeWithDefaults(settings: Partial<SettingsFile>): SettingsFile {
    return {
      theme: settings.theme ?? DEFAULT_SETTINGS.theme,
      language: settings.language ?? DEFAULT_SETTINGS.language,
      defaultRamMin: settings.defaultRamMin ?? DEFAULT_SETTINGS.defaultRamMin,
      defaultRamMax: settings.defaultRamMax ?? DEFAULT_SETTINGS.defaultRamMax,
      autoCheckUpdate: settings.autoCheckUpdate ?? DEFAULT_SETTINGS.autoCheckUpdate,
      javaInstallations: settings.javaInstallations ?? DEFAULT_SETTINGS.javaInstallations,
    };
  }

  /**
   * 取得所有實例配置
   */
  async getAllInstanceConfigs(): Promise<InstanceConfig[]> {
    const instancesDir = getInstancesDir();
    await ensureDir(instancesDir);

    const instanceIds = await listSubDirs(instancesDir);
    const configs: InstanceConfig[] = [];

    for (const id of instanceIds) {
      const config = await this.getInstanceConfig(id);
      if (config) {
        configs.push(config);
      }
    }

    return configs;
  }

  /**
   * 取得單一實例配置
   */
  async getInstanceConfig(id: string): Promise<InstanceConfig | null> {
    // 先檢查快取
    if (this.instancesCache.has(id)) {
      return this.instancesCache.get(id)!;
    }

    const configPath = this.getInstanceConfigPath(id);
    const config = await readJsonFile<InstanceConfig>(configPath);

    if (config) {
      this.instancesCache.set(id, config);
    }

    return config;
  }

  /**
   * 儲存實例配置
   */
  async saveInstanceConfig(config: InstanceConfig): Promise<void> {
    const configPath = this.getInstanceConfigPath(config.id);
    await writeJsonFile(configPath, config);
    this.instancesCache.set(config.id, config);
  }

  /**
   * 刪除實例配置（僅從快取移除，實際刪除由 ServerManager 處理）
   */
  removeInstanceFromCache(id: string): void {
    this.instancesCache.delete(id);
  }

  /**
   * 檢查實例是否存在
   */
  async instanceExists(id: string): Promise<boolean> {
    const configPath = this.getInstanceConfigPath(id);
    return fileExists(configPath);
  }

  /**
   * 取得實例配置檔路徑
   */
  private getInstanceConfigPath(id: string): string {
    return path.join(getInstancesDir(), id, 'instance.json');
  }

  /**
   * 取得實例目錄路徑
   */
  getInstanceDir(id: string): string {
    return path.join(getInstancesDir(), id);
  }

  /**
   * 清除所有快取
   */
  clearCache(): void {
    this.settingsCache = null;
    this.instancesCache.clear();
  }

  /**
   * 重新載入設定（清除快取後重新讀取）
   */
  async reloadSettings(): Promise<SettingsFile> {
    this.settingsCache = null;
    return this.getSettings();
  }
}

// 匯出單例實例
export const configManager = new ConfigManager();
