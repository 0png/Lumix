import { contextBridge, ipcRenderer } from 'electron';

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api = {
  ping: () => ipcRenderer.invoke('ping'),
  getVersions: (coreType: string): Promise<IpcResult<string[]>> => 
    ipcRenderer.invoke('get-versions', coreType),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = api;
}
