// Server IPC Handlers - Mock 版本
// 回傳假資料，不執行實際後端邏輯

import { ipcMain, BrowserWindow } from 'electron';
import { ServerChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  ServerInstanceDto,
  CreateServerRequest,
  UpdateServerRequest,
} from '../../shared/ipc-types';

// Mock 資料儲存
let mockServers: ServerInstanceDto[] = [
  {
    id: '1',
    name: 'Survival Server',
    coreType: 'paper',
    mcVersion: '1.20.4',
    javaPath: '/usr/bin/java',
    ramMin: 1024,
    ramMax: 4096,
    jvmArgs: [],
    directory: '/servers/survival',
    status: 'stopped',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Creative World',
    coreType: 'vanilla',
    mcVersion: '1.20.2',
    javaPath: '/usr/bin/java',
    ramMin: 2048,
    ramMax: 8192,
    jvmArgs: [],
    directory: '/servers/creative',
    status: 'stopped',
    createdAt: new Date().toISOString(),
  },
];

export function initServerHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  ipcMain.handle(ServerChannels.GET_ALL, async (): Promise<IpcResult<ServerInstanceDto[]>> => {
    return { success: true, data: mockServers };
  });

  ipcMain.handle(ServerChannels.GET_BY_ID, async (_, id: string): Promise<IpcResult<ServerInstanceDto>> => {
    const server = mockServers.find((s) => s.id === id);
    if (!server) return { success: false, error: 'Server not found' };
    return { success: true, data: server };
  });

  ipcMain.handle(ServerChannels.CREATE, async (_, data: CreateServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
    const newServer: ServerInstanceDto = {
      id: crypto.randomUUID(),
      name: data.name,
      coreType: data.coreType,
      mcVersion: data.mcVersion,
      javaPath: data.javaPath || '/usr/bin/java',
      ramMin: data.ramMin ?? 1024,
      ramMax: data.ramMax ?? 4096,
      jvmArgs: [],
      directory: `/servers/${data.name.toLowerCase().replace(/\s+/g, '-')}`,
      status: 'stopped',
      createdAt: new Date().toISOString(),
    };
    mockServers.push(newServer);
    return { success: true, data: newServer };
  });

  ipcMain.handle(ServerChannels.UPDATE, async (_, data: UpdateServerRequest): Promise<IpcResult<ServerInstanceDto>> => {
    const index = mockServers.findIndex((s) => s.id === data.id);
    if (index === -1) return { success: false, error: 'Server not found' };
    const current = mockServers[index]!;
    mockServers[index] = {
      ...current,
      name: data.name ?? current.name,
      javaPath: data.javaPath ?? current.javaPath,
      ramMin: data.ramMin ?? current.ramMin,
      ramMax: data.ramMax ?? current.ramMax,
      jvmArgs: data.jvmArgs ?? current.jvmArgs,
    };
    return { success: true, data: mockServers[index] };
  });

  ipcMain.handle(ServerChannels.DELETE, async (_, id: string): Promise<IpcResult<void>> => {
    mockServers = mockServers.filter((s) => s.id !== id);
    return { success: true };
  });

  ipcMain.handle(ServerChannels.START, async (_, id: string): Promise<IpcResult<void>> => {
    const server = mockServers.find((s) => s.id === id);
    if (!server) return { success: false, error: 'Server not found' };
    server.status = 'running';
    // 發送狀態變更事件
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(ServerChannels.STATUS_CHANGED, { serverId: id, status: 'running' });
      // 發送模擬日誌
      win.webContents.send(ServerChannels.LOG_ENTRY, {
        serverId: id,
        entry: { timestamp: new Date().toISOString(), level: 'info', message: '[Mock] Server started' },
      });
    });
    return { success: true };
  });

  ipcMain.handle(ServerChannels.STOP, async (_, id: string): Promise<IpcResult<void>> => {
    const server = mockServers.find((s) => s.id === id);
    if (!server) return { success: false, error: 'Server not found' };
    server.status = 'stopped';
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(ServerChannels.STATUS_CHANGED, { serverId: id, status: 'stopped' });
    });
    return { success: true };
  });

  ipcMain.handle(ServerChannels.SEND_COMMAND, async (_, id: string, command: string): Promise<IpcResult<void>> => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(ServerChannels.LOG_ENTRY, {
        serverId: id,
        entry: { timestamp: new Date().toISOString(), level: 'info', message: `[Mock] > ${command}` },
      });
    });
    return { success: true };
  });
}

export function cleanupServerHandlers(): void {
  // Mock 版本不需要清理
}
