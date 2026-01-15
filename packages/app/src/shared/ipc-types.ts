// IPC Type definitions
// 定義所有 IPC 通訊的請求與回應型別

import type {
  CoreType,
  ServerStatus,
  LogLevel,
  Theme,
  Language,
  JavaInstallation,
  DownloadProgress,
} from '@lumix/core';

// ============================================================================
// Generic IPC Result
// ============================================================================

export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Server Types
// ============================================================================

export interface ServerInstanceDto {
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
  createdAt: string;
  lastStartedAt?: string;
}

export interface CreateServerRequest {
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin?: number;
  ramMax?: number;
  jvmArgs?: string[];
}

export interface UpdateServerRequest {
  id: string;
  name?: string;
  javaPath?: string;
  ramMin?: number;
  ramMax?: number;
  jvmArgs?: string[];
}

export interface ServerStatusEvent {
  serverId: string;
  status: ServerStatus;
  exitCode?: number;
}

export interface LogEntryDto {
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface ServerLogEvent {
  serverId: string;
  entry: LogEntryDto;
}

// ============================================================================
// Java Types
// ============================================================================

export interface JavaInstallationDto {
  path: string;
  version: string;
  majorVersion: number;
}

export interface JavaInstallRequest {
  majorVersion: 8 | 17 | 21;
}

export interface JavaInstallProgressEvent {
  majorVersion: number;
  progress: DownloadProgress;
}

// ============================================================================
// Download Types
// ============================================================================

export interface FetchVersionsRequest {
  coreType: CoreType;
}

export interface FetchVersionsResult {
  versions: string[];
}

export interface DownloadServerRequest {
  coreType: CoreType;
  mcVersion: string;
  targetDir: string;
}

export interface DownloadProgressEvent {
  serverId: string;
  progress: DownloadProgress;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface SettingsDto {
  theme: Theme;
  language: Language;
  defaultRamMin: number;
  defaultRamMax: number;
  autoCheckUpdate: boolean;
  javaInstallations: JavaInstallationDto[];
}

export interface SaveSettingsRequest {
  theme?: Theme;
  language?: Language;
  defaultRamMin?: number;
  defaultRamMax?: number;
  autoCheckUpdate?: boolean;
}

// ============================================================================
// App Types
// ============================================================================

export interface AppInfo {
  version: string;
  dataPath: string;
}
