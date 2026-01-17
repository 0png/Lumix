/**
 * useTunnel Hook
 * 封裝隧道管理的 IPC 呼叫
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  TunnelInfo,
  TunnelStatus,
  CreateTunnelRequest,
  TunnelStatusEvent,
  TunnelInfoEvent,
} from '../../../shared/ipc-types';

interface UseTunnelReturn {
  tunnelInfo: TunnelInfo | null;
  status: TunnelStatus;
  loading: boolean;
  error: string | null;
  createTunnel: (request: CreateTunnelRequest) => Promise<boolean>;
  startTunnel: (serverId: string) => Promise<boolean>;
  stopTunnel: (serverId: string) => Promise<boolean>;
  deleteTunnel: (serverId: string) => Promise<boolean>;
  refresh: (serverId: string) => Promise<void>;
}

export function useTunnel(serverId: string): UseTunnelReturn {
  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo | null>(null);
  const [status, setStatus] = useState<TunnelStatus>('stopped');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入隧道信息
  const refresh = useCallback(async () => {
    try {
      const result = await window.electronAPI.tunnel.getInfo(serverId);
      if (result.success) {
        if (result.data) {
          setTunnelInfo(result.data);
          setStatus(result.data.status);
        } else {
          setTunnelInfo(null);
          setStatus('stopped');
        }
      } else {
        setError(result.error || 'Failed to load tunnel info');
      }
    } catch (err) {
      setError(String(err));
    }
  }, [serverId]);

  // 創建隧道
  const createTunnel = useCallback(async (request: CreateTunnelRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.tunnel.create(request);
      if (result.success && result.data) {
        setTunnelInfo(result.data);
        setStatus(result.data.status);
        return true;
      } else {
        setError(result.error || 'Failed to create tunnel');
        return false;
      }
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 啟動隧道
  const startTunnel = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.tunnel.start(serverId);
      if (result.success) {
        setStatus('starting');
        return true;
      } else {
        setError(result.error || 'Failed to start tunnel');
        return false;
      }
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // 停止隧道
  const stopTunnel = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.tunnel.stop(serverId);
      if (result.success) {
        setStatus('stopping');
        return true;
      } else {
        setError(result.error || 'Failed to stop tunnel');
        return false;
      }
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // 刪除隧道
  const deleteTunnel = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.tunnel.delete(serverId);
      if (result.success) {
        setTunnelInfo(null);
        setStatus('stopped');
        return true;
      } else {
        setError(result.error || 'Failed to delete tunnel');
        return false;
      }
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // 監聽隧道狀態變化
  useEffect(() => {
    const unsubscribeStatus = window.electronAPI.tunnel.onStatusChanged((event: TunnelStatusEvent) => {
      if (event.serverId === serverId) {
        setStatus(event.status);
      }
    });

    const unsubscribeInfo = window.electronAPI.tunnel.onInfoUpdated((event: TunnelInfoEvent) => {
      if (event.serverId === serverId) {
        setTunnelInfo(event.info);
        setStatus(event.info.status);
      }
    });

    // 初始載入
    refresh();

    return () => {
      unsubscribeStatus();
      unsubscribeInfo();
    };
  }, [serverId, refresh]);

  return {
    tunnelInfo,
    status,
    loading,
    error,
    createTunnel,
    startTunnel,
    stopTunnel,
    deleteTunnel,
    refresh,
  };
}
