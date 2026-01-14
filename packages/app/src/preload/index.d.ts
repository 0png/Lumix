import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
    };
  }
}
