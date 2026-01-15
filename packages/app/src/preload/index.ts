// Preload Script
// 使用 contextBridge 安全地暴露 IPC API 給 Renderer Process

import { contextBridge, ipcRenderer } from 'electron';
import {
  ServerChannels,
  JavaChannels,
  DownloadChannels,
  SettingsChannels,
  AppChannels,
} from '../shared/ipc-channels';
import type {
  IpcResult,
  ServerInstanceDto,
  CreateServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  JavaInstallationDto,
  JavaInstallRequest,
  JavaInstallProgressEvent,
  FetchVersionsResult,
  DownloadServerRequest,
  DownloadProgressEvent,
  SettingsDto,
  SaveSettingsRequest,
  CoreType,
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
