// Core type definitions for Lumix

// ============================================================================
// Enums & Basic Types
// ============================================================================

export type CoreType = 'vanilla' | 'paper' | 'fabric' | 'forge';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export type LogLevel = 'info' | 'warn' | 'error';

export type Theme = 'light' | 'dark' | 'system';

export type Language = 'zh-TW' | 'en';

// ============================================================================
// Server Instance Types
// ============================================================================

export interface ServerInstance {
  id: string;
  name: string;
  coreType: CoreType;
  mcVersion: string;
  javaPath: string;
  ramMin: number;
  ramMax: number;
  jvmArgs: string[];
  directory: string;
  status: ServerStatus;
  createdAt: Date;
  lastStartedAt?: Date;
}

/**
 * 儲存於 instance.json 的配置格式
 * 日期使用 ISO 8601 字串格式
 */
export interface InstanceConfig {
  id: string;
  name: string;
  coreType: CoreType;
  mcVersion: string;
  javaPath: string;
  ramMin: number;
  ramMax: number;
  jvmArgs: string[];
  createdAt: string;
  lastStartedAt?: string;
}

export interface CreateInstanceConfig {
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin?: number;
  ramMax?: number;
  jvmArgs?: string[];
  javaPath?: string;
}

// ============================================================================
// Java Types
// ============================================================================

export interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
}

// ============================================================================
// Download Types
// ============================================================================

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

// ============================================================================
// Log Types
// ============================================================================

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface AppSettings {
  theme: Theme;
  language: Language;
  defaultRamMin: number;
  defaultRamMax: number;
  autoCheckUpdate: boolean;
}

/**
 * 儲存於 settings.json 的完整配置格式
 */
export interface SettingsFile {
  theme: Theme;
  language: Language;
  defaultRamMin: number;
  defaultRamMax: number;
  autoCheckUpdate: boolean;
  javaInstallations: JavaInstallation[];
}

// ============================================================================
// Update Types
// ============================================================================

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  mandatory: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_SETTINGS: SettingsFile = {
  theme: 'system',
  language: 'zh-TW',
  defaultRamMin: 1024,
  defaultRamMax: 4096,
  autoCheckUpdate: true,
  javaInstallations: [],
};

export const DEFAULT_INSTANCE_CONFIG: Omit<InstanceConfig, 'id' | 'name' | 'coreType' | 'mcVersion' | 'createdAt'> = {
  javaPath: '',
  ramMin: 1024,
  ramMax: 4096,
  jvmArgs: [],
};
