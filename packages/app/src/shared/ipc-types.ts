// IPC Type definitions
// 定義所有 IPC 通訊的請求與回應型別

// ============================================================================
// Core Types (原本從 @lumix/core 匯入)
// ============================================================================

export type CoreType = 'vanilla' | 'paper' | 'spigot' | 'fabric' | 'forge';
export type ServerOrigin = 'managed' | 'imported';
export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';
export type LogLevel = 'info' | 'warn' | 'error';
export type Theme = 'light' | 'dark' | 'system';
export type Language = 'zh-TW' | 'en';
export type ConnectionDiagnosticLevel = 'info' | 'warn' | 'error';
export type ConnectionDiagnosticCode =
  | 'SERVER_NOT_RUNNING'
  | 'PORT_NOT_LISTENING'
  | 'LAN_IP_UNAVAILABLE'
  | 'SERVER_IP_BOUND'
  | 'WAN_REQUIRES_PORT_FORWARDING'
  | 'PUBLIC_IP_UNAVAILABLE'
  | 'CGNAT_SUSPECTED'
  | 'FIREWALL_MAY_BLOCK';
export type OnboardingStepId =
  | 'review-folder-core'
  | 'review-memory-java'
  | 'review-properties'
  | 'review-connection'
  | 'start-server'
  | 'create-backup';

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

export interface OnboardingState {
  dismissedAt?: string;
  completedSteps: OnboardingStepId[];
}

// ============================================================================
// Server Types
// ============================================================================

export interface ServerInstanceDto {
  id: string;
  name: string;
  origin: ServerOrigin;
  coreType: CoreType;
  mcVersion: string;
  javaPath: string;
  ramMin: number;
  ramMax: number;
  jvmArgs: string[];
  directory: string;
  launchJarPath?: string;
  status: ServerStatus;
  createdAt: string;
  lastStartedAt?: string;
  isReady?: boolean; // server.jar 是否已下載完成
  hasServerProperties?: boolean;
  eulaAccepted?: boolean;
  backupSettings?: BackupSettings;
  onboardingState?: OnboardingState;
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
  launchJarPath?: string;
  eulaAccepted?: boolean;
  backupSettings?: BackupSettings;
  onboardingState?: OnboardingState;
}

export interface DetectImportCandidateRequest {
  directory: string;
}

export interface ImportCandidateDto {
  directory: string;
  suggestedName: string;
  detectedCoreType?: CoreType;
  detectedMcVersion?: string;
  serverJarPath?: string;
  jarCandidates: string[];
  hasEula: boolean;
  eulaAccepted: boolean;
  hasServerProperties: boolean;
  hasWorldData: boolean;
  hasModsFolder: boolean;
  hasPluginsFolder: boolean;
  hasLibrariesFolder: boolean;
  hasUserCache: boolean;
  hasOpsFile: boolean;
  hasWhitelistFile: boolean;
  warnings: string[];
}

export interface ImportServerRequest {
  directory: string;
  name: string;
  coreType: CoreType;
  mcVersion: string;
  launchJarPath: string;
  javaPath?: string;
  ramMin?: number;
  ramMax?: number;
  jvmArgs?: string[];
  eulaAccepted?: boolean;
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

export interface PlayerDto {
  name: string;
  uuid?: string;
  online: boolean;
  isOp: boolean;
  isBanned: boolean;
  isWhitelisted: boolean;
  lastSeenAt?: string;
}

export type PlayerActionType =
  | 'op'
  | 'deop'
  | 'ban'
  | 'pardon'
  | 'kick'
  | 'whitelist-add'
  | 'whitelist-remove';

export interface PlayerActionRequest {
  serverId: string;
  playerName: string;
  action: PlayerActionType;
}

export interface ConnectionDiagnostic {
  level: ConnectionDiagnosticLevel;
  code: ConnectionDiagnosticCode;
  message: string;
}

export interface ConnectionInfoDto {
  serverId: string;
  port?: number;
  serverIp?: string;
  localhostAddress?: string;
  lanAddress?: string;
  publicIp?: string;
  isRunning: boolean;
  isListeningOnPort: boolean;
  diagnostics: ConnectionDiagnostic[];
  checkedAt: string;
  hasServerProperties: boolean;
  firewallStatus: 'unknown' | 'allowed' | 'blocked' | 'warning';
}

// ============================================================================
// Backup Types
// ============================================================================

export type BackupScheduleType = 'hourly' | 'daily' | 'weekly' | 'while-running';
export type BackupTrigger = 'manual' | 'scheduled';
export type BackupKind = 'regular' | 'pre-restore';
export type BackupFailureCode =
  | 'INSUFFICIENT_DISK_SPACE'
  | 'FILE_LOCKED'
  | 'PERMISSION_DENIED'
  | 'CORRUPTED_BACKUP'
  | 'MISSING_SOURCE_PATH'
  | 'SERVER_MUST_BE_STOPPED'
  | 'PRE_RESTORE_BACKUP_FAILED'
  | 'RESTORE_VALIDATION_FAILED'
  | 'UNKNOWN';
export type BackupOperationContext = 'backup' | 'restore' | 'preflight' | 'pre-restore-backup';

export interface BackupSettings {
  enabled: boolean;
  scheduleType: BackupScheduleType;
  time: string; // HH:mm
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  intervalHours?: number;
  intervalMinutes?: number;
  includeLogs?: boolean;
  notifyOps?: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface BackupInfoDto {
  id: string;
  serverId: string;
  name: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  trigger: BackupTrigger;
  kind: BackupKind;
  sourceServerState?: 'running' | 'stopped';
}

export interface BackupOperationFailure {
  code: BackupFailureCode;
  message: string;
  context: BackupOperationContext;
  path?: string;
  details?: string[];
  suggestedAction?: string;
}

export interface BackupPreflightResult {
  canRun: boolean;
  requiresServerStop: boolean;
  estimatedRestoreBytes?: number;
  freeSpaceBytes?: number;
  warnings: string[];
  blockingIssues: BackupOperationFailure[];
}

export interface CreateBackupRequest {
  serverId: string;
  trigger?: BackupTrigger;
}

export interface GetRestorePreflightRequest {
  serverId: string;
  backupId: string;
}

export interface RestoreBackupRequest {
  serverId: string;
  backupId: string;
  createPreRestoreBackup?: boolean;
}

export interface RestoreBackupResult {
  restoredBackupId: string;
  preRestoreBackupId?: string;
  warnings: string[];
}

export interface UpdateBackupSettingsRequest {
  serverId: string;
  settings: BackupSettings;
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
  majorVersion: 8 | 17 | 21 | 25;
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

export interface SystemInfo {
  totalMemoryMb: number;
  cpuThreads: number;
  platform: string;
}

// ============================================================================
// Update Types
// ============================================================================

export interface UpdateCheckResult {
  hasUpdate: boolean;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  message?: string;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateErrorEvent {
  message: string;
  code: string;
}

export interface UpdateDownloadedEvent {
  version: string;
}

// ============================================================================
// Server Properties Types
// ============================================================================

export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';
export type Gamemode = 'survival' | 'creative' | 'adventure' | 'spectator';
export type ServerPropertyValue = string | number | boolean;

export interface ServerProperties extends Record<string, ServerPropertyValue> {
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
