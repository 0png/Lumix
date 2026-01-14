// Core type definitions for Lumix

export type CoreType = 'vanilla' | 'paper' | 'fabric' | 'forge';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';

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

export interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-TW' | 'en';
  defaultRamMin: number;
  defaultRamMax: number;
  autoCheckUpdate: boolean;
}

export interface CreateInstanceConfig {
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin?: number;
  ramMax?: number;
  jvmArgs?: string[];
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  mandatory: boolean;
}
