// Electron API type definitions for renderer process

interface FetchVersionsResult {
  success: boolean;
  versions?: string[];
  error?: string;
}

interface ElectronAPI {
  ping: () => Promise<string>;
  fetchVersions: (coreType: string) => Promise<FetchVersionsResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
