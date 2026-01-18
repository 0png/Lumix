// IPC Type definitions
// 定義所有 IPC 通訊的請求與回應型別

// ============================================================================
// Core Types (原本從 @lumix/core 匯入)
// ============================================================================

export type CoreType = 'vanilla' | 'paper' | 'spigot' | 'fabric' | 'forge';
export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';
export type LogLevel = 'info' | 'warn' | 'error';
export type Theme = 'light' | 'dark' | 'system';
export type Language = 'zh-TW' | 'en';

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * 統一錯誤碼定義
 * 格式: CATEGORY_SPECIFIC_ERROR
 */
export const IpcErrorCode = {
  // Server 相關錯誤
  SERVER_NOT_FOUND: 'SERVER_NOT_FOUND',
  SERVER_INVALID_NAME: 'SERVER_INVALID_NAME',
  SERVER_DUPLICATE_NAME: 'SERVER_DUPLICATE_NAME',
  SERVER_INVALID_STATE: 'SERVER_INVALID_STATE',
  SERVER_JAR_NOT_FOUND: 'SERVER_JAR_NOT_FOUND',

  // Java 相關錯誤
  JAVA_NOT_FOUND: 'JAVA_NOT_FOUND',
  JAVA_INVALID_VERSION: 'JAVA_INVALID_VERSION',
  JAVA_INSTALL_FAILED: 'JAVA_INSTALL_FAILED',

  // 下載相關錯誤
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DOWNLOAD_VERSION_NOT_FOUND: 'DOWNLOAD_VERSION_NOT_FOUND',
  DOWNLOAD_UNSUPPORTED_CORE: 'DOWNLOAD_UNSUPPORTED_CORE',
  DOWNLOAD_NETWORK_ERROR: 'DOWNLOAD_NETWORK_ERROR',

  // 檔案系統錯誤
  FS_READ_ERROR: 'FS_READ_ERROR',
  FS_WRITE_ERROR: 'FS_WRITE_ERROR',
  FS_DELETE_ERROR: 'FS_DELETE_ERROR',
  FS_PERMISSION_DENIED: 'FS_PERMISSION_DENIED',

  // 程序相關錯誤
  PROCESS_SPAWN_FAILED: 'PROCESS_SPAWN_FAILED',
  PROCESS_COMMAND_FAILED: 'PROCESS_COMMAND_FAILED',

  // 通用錯誤
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type IpcErrorCodeType = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];

/**
 * 統一錯誤介面
 */
export interface IpcError {
  code: IpcErrorCodeType;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 建立 IpcError 的工具函式
 */
export function createIpcError(
  code: IpcErrorCodeType,
  message: string,
  details?: Record<string, unknown>
): IpcError {
  return { code, message, details };
}

/**
 * 從錯誤字串解析 IpcError
 * 支援格式: "CODE: message" 或純訊息
 */
export function parseIpcError(errorStr: string): IpcError {
  const match = errorStr.match(/^([A-Z_]+):\s*(.+)$/);
  if (match && match[1] && match[2]) {
    const code = match[1] as IpcErrorCodeType;
    if (Object.values(IpcErrorCode).includes(code)) {
      return { code, message: match[2] };
    }
  }
  return { code: IpcErrorCode.UNKNOWN_ERROR, message: errorStr };
}

/**
 * 格式化 IpcError 為字串
 */
export function formatIpcError(error: IpcError): string {
  return `${error.code}: ${error.message}`;
}

// ============================================================================
// Generic IPC Result
// ============================================================================

export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorDetails?: IpcError;
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
  isReady?: boolean; // server.jar 是否已下載完成
}

export interface CreateServerRequest {
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin?: number;
  ramMax?: number;
  jvmArgs?: string[];
  javaPath?: string;
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
  vendor?: string;
  isValid?: boolean;
}

export interface JavaInstallRequest {
  majorVersion: 8 | 17 | 21;
}

export interface JavaRequiredVersionResult {
  requiredMajor: number;
  reason: string;
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
  serverId?: string;
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
  autoCheckUpdate?: boolean;
  autoUpdate?: boolean;
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

// ============================================================================
// Server Properties Types
// ============================================================================

export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';
export type Gamemode = 'survival' | 'creative' | 'adventure' | 'spectator';

export interface ServerProperties {
  'allow-flight': boolean;
  difficulty: Difficulty;
  gamemode: Gamemode;
  'max-players': number;
  'online-mode': boolean;
  'white-list': boolean;
}

export interface UpdateServerPropertiesRequest {
  id: string;
  properties: Partial<ServerProperties>;
}

export interface ServerReadyEvent {
  serverId: string;
}
