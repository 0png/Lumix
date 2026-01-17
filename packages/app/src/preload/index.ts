// Preload Script
// 使用 contextBridge 安全地暴露 IPC API 給 Renderer Process

import { contextBridge, ipcRenderer } from 'electron';
import {
  ServerChannels,
  JavaChannels,
  DownloadChannels,
  SettingsChannels,
  TunnelChannels,
  AppChannels,
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
  TunnelInfo,
  TunnelStatus,
  CreateTunnelRequest,
  TunnelStatusEvent,
  TunnelInfoEvent,
  TunnelClaimRequiredEvent,
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
  // Tunnel Management
  // --------------------------------------------------------------------------
  tunnel: {
    create: (data: CreateTunnelRequest): Promise<IpcResult<TunnelInfo>> =>
      ipcRenderer.invoke(TunnelChannels.CREATE, data),

    start: (serverId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(TunnelChannels.START, serverId),

    stop: (serverId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(TunnelChannels.STOP, serverId),

    delete: (serverId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(TunnelChannels.DELETE, serverId),

    getInfo: (serverId: string): Promise<IpcResult<TunnelInfo | null>> =>
      ipcRenderer.invoke(TunnelChannels.GET_INFO, serverId),

    getStatus: (serverId: string): Promise<IpcResult<TunnelStatus>> =>
      ipcRenderer.invoke(TunnelChannels.GET_STATUS, serverId),

    checkAgent: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(TunnelChannels.CHECK_AGENT),

    installAgent: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(TunnelChannels.INSTALL_AGENT),

    onStatusChanged: (callback: (event: TunnelStatusEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: TunnelStatusEvent) => callback(data);
      ipcRenderer.on(TunnelChannels.STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(TunnelChannels.STATUS_CHANGED, handler);
    },

    onInfoUpdated: (callback: (event: TunnelInfoEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: TunnelInfoEvent) => callback(data);
      ipcRenderer.on(TunnelChannels.INFO_UPDATED, handler);
      return () => ipcRenderer.removeListener(TunnelChannels.INFO_UPDATED, handler);
    },

    onClaimRequired: (callback: (event: TunnelClaimRequiredEvent) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: TunnelClaimRequiredEvent) => callback(data);
      ipcRenderer.on(TunnelChannels.CLAIM_REQUIRED, handler);
      return () => ipcRenderer.removeListener(TunnelChannels.CLAIM_REQUIRED, handler);
    },
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
