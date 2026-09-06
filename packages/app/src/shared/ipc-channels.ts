// IPC Channel definitions
// 定義所有 Main Process 與 Renderer Process 之間的通訊通道

// ============================================================================
// Server Management Channels
// ============================================================================

export const ServerChannels = {
  // CRUD operations
  GET_ALL: 'server:get-all',
  GET_BY_ID: 'server:get-by-id',
  CREATE: 'server:create',
  DETECT_IMPORT_CANDIDATE: 'server:detect-import-candidate',
  IMPORT_EXISTING: 'server:import-existing',
  UPDATE: 'server:update',
  DELETE: 'server:delete',
  
  // Lifecycle control
  START: 'server:start',
  STOP: 'server:stop',
  CANCEL_AUTO_RESTART: 'server:cancel-auto-restart',
  SEND_COMMAND: 'server:send-command',
  GET_PERFORMANCE_HISTORY: 'server:get-performance-history',
  GET_PLAYERS: 'server:get-players',
  PLAYER_ACTION: 'server:player-action',

  // Backups
  LIST_BACKUPS: 'server:list-backups',
  CREATE_BACKUP: 'server:create-backup',
  GET_RESTORE_BACKUP_PREFLIGHT: 'server:get-restore-backup-preflight',
  RESTORE_BACKUP: 'server:restore-backup',
  DELETE_BACKUP: 'server:delete-backup',
  UPDATE_BACKUP_SETTINGS: 'server:update-backup-settings',
  
  // Server properties
  GET_CONNECTION_INFO: 'server:get-connection-info',
  GET_PROPERTIES: 'server:get-properties',
  GET_PROPERTIES_RAW: 'server:get-properties-raw',
  UPDATE_PROPERTIES: 'server:update-properties',
  
  // Events (Main -> Renderer)
  STATUS_CHANGED: 'server:status-changed',
  LOG_ENTRY: 'server:log-entry',
  PERFORMANCE_SAMPLE: 'server:performance-sample',
  READY: 'server:ready', // 服務器成功啟動事件
  AUTO_RESTART: 'server:auto-restart',
} as const;

// ============================================================================
// Modpack Import Channels
// ============================================================================

export const ModpackChannels = {
  SCAN: 'modpack:scan',
  IMPORT: 'modpack:import',
  INSTALL_PROGRESS: 'modpack:install-progress',
} as const;

/**
 * 取得所有需要 ipcMain.handle 的 Server channels（不含 event channels）
 * 用於 cleanup 時移除 handlers
 */
export function getAllServerChannels(): string[] {
  return [
    ServerChannels.GET_ALL,
    ServerChannels.GET_BY_ID,
    ServerChannels.CREATE,
    ServerChannels.DETECT_IMPORT_CANDIDATE,
    ServerChannels.IMPORT_EXISTING,
    ServerChannels.UPDATE,
    ServerChannels.DELETE,
    ServerChannels.START,
    ServerChannels.STOP,
    ServerChannels.CANCEL_AUTO_RESTART,
    ServerChannels.SEND_COMMAND,
    ServerChannels.GET_PERFORMANCE_HISTORY,
    ServerChannels.GET_PLAYERS,
    ServerChannels.PLAYER_ACTION,
    ServerChannels.LIST_BACKUPS,
    ServerChannels.CREATE_BACKUP,
    ServerChannels.GET_RESTORE_BACKUP_PREFLIGHT,
    ServerChannels.RESTORE_BACKUP,
    ServerChannels.DELETE_BACKUP,
    ServerChannels.UPDATE_BACKUP_SETTINGS,
    ServerChannels.GET_CONNECTION_INFO,
    ServerChannels.GET_PROPERTIES,
    ServerChannels.GET_PROPERTIES_RAW,
    ServerChannels.UPDATE_PROPERTIES,
  ];
}

// ============================================================================
// Java Management Channels
// ============================================================================

export const JavaChannels = {
  DETECT: 'java:detect',
  GET_INSTALLATIONS: 'java:get-installations',
  INSTALL: 'java:install',
  SELECT_FOR_MC: 'java:select-for-mc',
  GET_REQUIRED_VERSION: 'java:get-required-version',
  VALIDATE: 'java:validate',
  
  // Events
  INSTALL_PROGRESS: 'java:install-progress',
} as const;

// ============================================================================
// Download Channels
// ============================================================================

export const DownloadChannels = {
  FETCH_VERSIONS: 'download:fetch-versions',
  DOWNLOAD_SERVER: 'download:download-server',
  
  // Events
  DOWNLOAD_PROGRESS: 'download:progress',
} as const;

// ============================================================================
// Settings Channels
// ============================================================================

export const SettingsChannels = {
  GET: 'settings:get',
  SAVE: 'settings:save',
} as const;

// ============================================================================
// App Channels
// ============================================================================

export const AppChannels = {
  GET_VERSION: 'app:get-version',
  GET_DATA_PATH: 'app:get-data-path',
  GET_SYSTEM_INFO: 'app:get-system-info',
  SELECT_DIRECTORY: 'app:select-directory',
  SELECT_MODPACK_FILE: 'app:select-modpack-file',
  SELECT_JAVA_EXECUTABLE: 'app:select-java-executable',
  OPEN_FOLDER: 'app:open-folder',
  OPEN_EXTERNAL: 'app:open-external',
} as const;

// ============================================================================
// Window Channels
// ============================================================================

export const WindowChannels = {
  MINIMIZE: 'window:minimize',
  TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  CLOSE: 'window:close',
  SET_TITLE_BAR_OVERLAY: 'window:set-title-bar-overlay',
} as const;

// ============================================================================
// Update Channels
// ============================================================================

export const UpdateChannels = {
  CHECK_FOR_UPDATES: 'update:check-for-updates',
  DOWNLOAD_UPDATE: 'update:download-update',
  QUIT_AND_INSTALL: 'update:quit-and-install',
  GET_CURRENT_VERSION: 'update:get-current-version',
  GET_RELEASE_NOTES: 'update:get-release-notes',
  
  // Events (Main -> Renderer)
  ERROR: 'update:error',
  AVAILABLE: 'update:available',
  NOT_AVAILABLE: 'update:not-available',
  DOWNLOAD_PROGRESS: 'update:download-progress',
  DOWNLOADED: 'update:downloaded',
} as const;

// ============================================================================
// All Channels Export
// ============================================================================

export const IpcChannels = {
  Server: ServerChannels,
  Modpack: ModpackChannels,
  Java: JavaChannels,
  Download: DownloadChannels,
  Settings: SettingsChannels,
  App: AppChannels,
  Window: WindowChannels,
  Update: UpdateChannels,
} as const;
