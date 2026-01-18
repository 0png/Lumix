// Preload Script
// 使用 contextBridge 安全地暴露 IPC API 給 Renderer Process

import { contextBridge, ipcRenderer } from 'electron';
import {
  ServerChannels,
  JavaChannels,
  DownloadChannels,
  SettingsChannels,
  AppChannels,
  UpdateChannels,
} from '../shared/ipc-channels';
import type {
  IpcResult,
  ServerInstanceDto,
  CreateServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  ServerReadyEvent,
  ServerProperties,
  UpdateServerPropertiesRequest,
  JavaInstallationDto,
  JavaInstallRequest,
  JavaInstallProgressEvent,
  JavaRequiredVersionResult,
  FetchVersionsResult,
  DownloadServerRequest,
  DownloadProgressEvent,
  SettingsDto,
  SaveSettingsRequest,
  CoreType,
  UpdateCheckResult,
  UpdateInfo,
  UpdateDownloadProgress,
  UpdateErrorEvent,
  UpdateDownloadedEvent,
} from '../shared/ipc-types';

// ============================================================================
// API Definition
// ============================================================================

const electronAPI = {
  // --------------------------------------------------------------------------
  // Server Management
  // --------------------------------------------------------------------------
  server: {
    getAll: (): Promise<IpcResult<ServerInstanceDto[]>> =>
      ipcRenderer.invoke(ServerChannels.GET_ALL),

    getById: (id: string): Promise<IpcResult<ServerInstanceDto>> =>
      ipcRenderer.invoke(ServerChannels.GET_BY_ID, id),

    create: (data: CreateServerRequest): Promise<IpcResult<ServerInstanceDto>> =>
      ipcRenderer.invoke(ServerChannels.CREATE, data),

    update: (data: UpdateServerRequest): Promise<IpcResult<ServerInstanceDto>> =>
      ipcRenderer.invoke(ServerChannels.UPDATE, data),

    delete: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(ServerChannels.DELETE, id),

    start: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(ServerChannels.START, id),

    stop: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(ServerChannels.STOP, id),

    sendCommand: (id: string, command: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(ServerChannels.SEND_COMMAND, id, command),

    getProperties: (id: string): Promise<IpcResult<ServerProperties>> =>
      ipcRenderer.invoke(ServerChannels.GET_PROPERTIES, id),

    getPropertiesRaw: (id: string): Promise<IpcResult<Record<string, string>>> =>
      ipcRenderer.invoke(ServerChannels.GET_PROPERTIES_RAW, id),

    updateProperties: (data: UpdateServerPropertiesRequest): Promise<IpcResult<ServerProperties>> =>
      ipcRenderer.invoke(ServerChannels.UPDATE_PROPERTIES, data),

    onStatusChanged: (callback: (event: ServerStatusEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: ServerStatusEvent) => callback(data);
      ipcRenderer.on(ServerChannels.STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(ServerChannels.STATUS_CHANGED, handler);
    },

    onLogEntry: (callback: (event: ServerLogEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: ServerLogEvent) => callback(data);
      ipcRenderer.on(ServerChannels.LOG_ENTRY, handler);
      return () => ipcRenderer.removeListener(ServerChannels.LOG_ENTRY, handler);
    },

    onReady: (callback: (event: ServerReadyEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: ServerReadyEvent) => callback(data);
      ipcRenderer.on(ServerChannels.READY, handler);
      return () => ipcRenderer.removeListener(ServerChannels.READY, handler);
    },
  },

  // --------------------------------------------------------------------------
  // Java Management
  // --------------------------------------------------------------------------
  java: {
    detect: (): Promise<IpcResult<JavaInstallationDto[]>> =>
      ipcRenderer.invoke(JavaChannels.DETECT),

    getInstallations: (): Promise<IpcResult<JavaInstallationDto[]>> =>
      ipcRenderer.invoke(JavaChannels.GET_INSTALLATIONS),

    install: (data: JavaInstallRequest): Promise<IpcResult<JavaInstallationDto>> =>
      ipcRenderer.invoke(JavaChannels.INSTALL, data),

    selectForMc: (mcVersion: string): Promise<IpcResult<JavaInstallationDto | null>> =>
      ipcRenderer.invoke(JavaChannels.SELECT_FOR_MC, mcVersion),

    getRequiredVersion: (mcVersion: string): Promise<IpcResult<JavaRequiredVersionResult>> =>
      ipcRenderer.invoke(JavaChannels.GET_REQUIRED_VERSION, mcVersion),

    onInstallProgress: (callback: (event: JavaInstallProgressEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: JavaInstallProgressEvent) => callback(data);
      ipcRenderer.on(JavaChannels.INSTALL_PROGRESS, handler);
      return () => ipcRenderer.removeListener(JavaChannels.INSTALL_PROGRESS, handler);
    },
  },

  // --------------------------------------------------------------------------
  // Download
  // --------------------------------------------------------------------------
  download: {
    fetchVersions: (coreType: CoreType): Promise<IpcResult<FetchVersionsResult>> =>
      ipcRenderer.invoke(DownloadChannels.FETCH_VERSIONS, coreType),

    downloadServer: (data: DownloadServerRequest): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(DownloadChannels.DOWNLOAD_SERVER, data),

    onProgress: (callback: (event: DownloadProgressEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: DownloadProgressEvent) => callback(data);
      ipcRenderer.on(DownloadChannels.DOWNLOAD_PROGRESS, handler);
      return () => ipcRenderer.removeListener(DownloadChannels.DOWNLOAD_PROGRESS, handler);
    },
  },

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------
  settings: {
    get: (): Promise<IpcResult<SettingsDto>> =>
      ipcRenderer.invoke(SettingsChannels.GET),

    save: (data: SaveSettingsRequest): Promise<IpcResult<SettingsDto>> =>
      ipcRenderer.invoke(SettingsChannels.SAVE, data),
  },

  // --------------------------------------------------------------------------
  // App
  // --------------------------------------------------------------------------
  app: {
    getVersion: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(AppChannels.GET_VERSION),

    getDataPath: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(AppChannels.GET_DATA_PATH),

    openFolder: (path: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(AppChannels.OPEN_FOLDER, path),

    openExternal: (url: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(AppChannels.OPEN_EXTERNAL, url),
  },

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------
  update: {
    checkForUpdates: (): Promise<IpcResult<UpdateCheckResult>> =>
      ipcRenderer.invoke(UpdateChannels.CHECK_FOR_UPDATES),

    downloadUpdate: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(UpdateChannels.DOWNLOAD_UPDATE),

    quitAndInstall: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(UpdateChannels.QUIT_AND_INSTALL),

    getCurrentVersion: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(UpdateChannels.GET_CURRENT_VERSION),

    onError: (callback: (event: UpdateErrorEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: UpdateErrorEvent) => callback(data);
      ipcRenderer.on(UpdateChannels.ERROR, handler);
      return () => ipcRenderer.removeListener(UpdateChannels.ERROR, handler);
    },

    onAvailable: (callback: (event: UpdateInfo) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: UpdateInfo) => callback(data);
      ipcRenderer.on(UpdateChannels.AVAILABLE, handler);
      return () => ipcRenderer.removeListener(UpdateChannels.AVAILABLE, handler);
    },

    onNotAvailable: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(UpdateChannels.NOT_AVAILABLE, handler);
      return () => ipcRenderer.removeListener(UpdateChannels.NOT_AVAILABLE, handler);
    },

    onDownloadProgress: (callback: (event: UpdateDownloadProgress) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: UpdateDownloadProgress) => callback(data);
      ipcRenderer.on(UpdateChannels.DOWNLOAD_PROGRESS, handler);
      return () => ipcRenderer.removeListener(UpdateChannels.DOWNLOAD_PROGRESS, handler);
    },

    onDownloaded: (callback: (event: UpdateDownloadedEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: UpdateDownloadedEvent) => callback(data);
      ipcRenderer.on(UpdateChannels.DOWNLOADED, handler);
      return () => ipcRenderer.removeListener(UpdateChannels.DOWNLOADED, handler);
    },
  },
};

// ============================================================================
// Expose API
// ============================================================================

export type ElectronAPI = typeof electronAPI;

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } catch (error) {
    console.error('Failed to expose electronAPI:', error);
  }
} else {
  // Fallback for non-isolated context
  (window as unknown as { electronAPI: ElectronAPI }).electronAPI = electronAPI;
}
