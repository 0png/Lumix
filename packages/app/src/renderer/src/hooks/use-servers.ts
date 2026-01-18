// useServers Hook
// 封裝伺服器管理的 IPC 呼叫

import { useState, useEffect, useCallback } from 'react';
import type {
  ServerInstanceDto,
  CreateServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  LogEntryDto,
  IpcErrorCodeType,
} from '../../../shared/ipc-types';
import { parseIpcError, IpcErrorCode } from '../../../shared/ipc-types';

export interface CreateServerError {
  code: IpcErrorCodeType;
  message: string;
}

interface UseServersReturn {
  servers: ServerInstanceDto[];
  loading: boolean;
  error: string | null;
  logs: Map<string, LogEntryDto[]>;
  refresh: () => Promise<void>;
  createServer: (data: CreateServerRequest) => Promise<{ server: ServerInstanceDto | null; error: CreateServerError | null }>;
  updateServer: (data: UpdateServerRequest) => Promise<ServerInstanceDto | null>;
  deleteServer: (id: string) => Promise<boolean>;
  startServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  stopServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  sendCommand: (id: string, command: string) => Promise<boolean>;
  clearLogs: (serverId: string) => void;
}

export function useServers(): UseServersReturn {
  const [servers, setServers] = useState<ServerInstanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Map<string, LogEntryDto[]>>(new Map());

  // 載入伺服器列表
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.server.getAll();
      if (result.success && result.data) {
        // 已存在的伺服器預設為已就緒
        const serversWithReady = result.data.map((s) => ({ ...s, isReady: s.isReady ?? true }));
        setServers(serversWithReady);
      } else {
        setError(result.error || 'Failed to load servers');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 建立伺服器（包含下載）
  const createServer = useCallback(async (data: CreateServerRequest): Promise<{ server: ServerInstanceDto | null; error: CreateServerError | null }> => {
    try {
      // 1. 先建立伺服器（建立目錄和 metadata）
      const result = await window.electronAPI.server.create(data);
      if (!result.success || !result.data) {
        const errorStr = result.error || 'Failed to create server';
        const parsedError = parseIpcError(errorStr);
        setError(errorStr);
        return { server: null, error: { code: parsedError.code, message: parsedError.message } };
      }

      const server = result.data;
      // 標記為未就緒（正在下載）
      const serverWithStatus = { ...server, isReady: false };
      setServers((prev) => [...prev, serverWithStatus]);

      // 2. 下載 server.jar
      console.log('[useServers] Downloading server.jar for:', server.name);
      const downloadResult = await window.electronAPI.download.downloadServer({
        coreType: data.coreType,
        mcVersion: data.mcVersion,
        targetDir: server.directory,
      });

      if (!downloadResult.success) {
        console.error('[useServers] Download failed:', downloadResult.error);
        // 下載失敗，嘗試刪除已建立的伺服器
        const deleteResult = await window.electronAPI.server.delete(server.id);
        if (!deleteResult.success) {
          console.error('[useServers] Failed to cleanup server after download failure:', deleteResult.error);
        }
        // 無論 delete 是否成功，都從 UI 移除（因為伺服器已不可用）
        setServers((prev) => prev.filter((s) => s.id !== server.id));
        const errorStr = downloadResult.error || 'Failed to download server.jar';
        setError(errorStr);
        return { server: null, error: { code: IpcErrorCode.DOWNLOAD_FAILED, message: errorStr } };
      }

      console.log('[useServers] Server created and downloaded successfully');
      // 標記為已就緒
      const readyServer = { ...server, isReady: true };
      setServers((prev) => prev.map((s) => (s.id === server.id ? readyServer : s)));
      return { server: readyServer, error: null };
    } catch (err) {
      const errorStr = String(err);
      setError(errorStr);
      return { server: null, error: { code: IpcErrorCode.UNKNOWN_ERROR, message: errorStr } };
    }
  }, []);

  // 更新伺服器
  const updateServer = useCallback(async (data: UpdateServerRequest): Promise<ServerInstanceDto | null> => {
    try {
      const result = await window.electronAPI.server.update(data);
      if (result.success && result.data) {
        setServers((prev) => prev.map((s) => (s.id === data.id ? result.data! : s)));
        return result.data;
      }
      setError(result.error || 'Failed to update server');
      return null;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, []);

  // 刪除伺服器
  const deleteServer = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.server.delete(id);
      if (result.success) {
        setServers((prev) => prev.filter((s) => s.id !== id));
        return true;
      }
      setError(result.error || 'Failed to delete server');
      return false;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  // 啟動伺服器 - 回傳 { success, error } 讓呼叫端可以立即取得錯誤訊息
  const startServer = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await window.electronAPI.server.start(id);
      if (!result.success) {
        const errorMsg = result.error || 'Failed to start server';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
      return { success: true };
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // 停止伺服器 - 回傳 { success, error } 讓呼叫端可以立即取得錯誤訊息
  const stopServer = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await window.electronAPI.server.stop(id);
      if (!result.success) {
        const errorMsg = result.error || 'Failed to stop server';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
      return { success: true };
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // 發送指令
  const sendCommand = useCallback(async (id: string, command: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.server.sendCommand(id, command);
      return result.success;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  // 清除日誌
  const clearLogs = useCallback((serverId: string) => {
    setLogs((prev) => {
      const next = new Map(prev);
      next.set(serverId, []);
      return next;
    });
  }, []);

  // 訂閱狀態變更事件
  useEffect(() => {
    const unsubscribe = window.electronAPI.server.onStatusChanged((event: ServerStatusEvent) => {
      setServers((prev) =>
        prev.map((s) => (s.id === event.serverId ? { ...s, status: event.status } : s))
      );
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // 訂閱日誌事件（限制最多 1000 條，避免記憶體洩漏）
  useEffect(() => {
    const MAX_LOG_ENTRIES = 1000;
    const unsubscribe = window.electronAPI.server.onLogEntry((event: ServerLogEvent) => {
      setLogs((prev) => {
        const serverLogs = prev.get(event.serverId) || [];
        const newLogs = [...serverLogs, event.entry];
        
        // 超過上限時移除最舊的
        if (newLogs.length > MAX_LOG_ENTRIES) {
          const trimmedLogs = newLogs.slice(-MAX_LOG_ENTRIES);
          // 只在需要更新時創建新 Map
          if (prev.get(event.serverId) !== trimmedLogs) {
            const next = new Map(prev);
            next.set(event.serverId, trimmedLogs);
            return next;
          }
          return prev;
        } else {
          // 只在需要更新時創建新 Map
          const next = new Map(prev);
          next.set(event.serverId, newLogs);
          return next;
        }
      });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // 初始載入
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    servers,
    loading,
    error,
    logs,
    refresh,
    createServer,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
    sendCommand,
    clearLogs,
  };
}
