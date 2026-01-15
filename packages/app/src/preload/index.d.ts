import type { ElectronAPI } from '@electron-toolkit/preload';

interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
      getVersions: (coreType: string) => Promise<IpcResult<string[]>>;
    };
  }
}
