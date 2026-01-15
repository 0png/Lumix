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
  UPDATE: 'server:update',
  DELETE: 'server:delete',
  
  // Lifecycle control
  START: 'server:start',
  STOP: 'server:stop',
  SEND_COMMAND: 'server:send-command',
  
  // Events (Main -> Renderer)
  STATUS_CHANGED: 'server:status-changed',
  LOG_ENTRY: 'server:log-entry',
} as const;

// ============================================================================
// Java Management Channels
// ============================================================================

export const JavaChannels = {
  DETECT: 'java:detect',
  GET_INSTALLATIONS: 'java:get-installations',
  INSTALL: 'java:install',
  SELECT_FOR_MC: 'java:select-for-mc',
  
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
  OPEN_FOLDER: 'app:open-folder',
} as const;

// ============================================================================
// All Channels Export
// ============================================================================

export const IpcChannels = {
  Server: ServerChannels,
  Java: JavaChannels,
  Download: DownloadChannels,
  Settings: SettingsChannels,
  App: AppChannels,
} as const;
