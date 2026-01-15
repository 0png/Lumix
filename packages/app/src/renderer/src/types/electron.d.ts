// Electron API type definitions for renderer process

interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ElectronAPI {
  ping: () => Promise<string>;
  getVersions: (coreType: string) => Promise<IpcResult<string[]>>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
