// useJava Hook
// 封裝 Java 管理的 IPC 呼叫

import { useState, useEffect, useCallback } from 'react';
import type {
  JavaInstallationDto,
  JavaInstallProgressEvent,
  JavaRequiredVersionResult,
} from '../../../shared/ipc-types';

interface UseJavaReturn {
  installations: JavaInstallationDto[];
  loading: boolean;
  error: string | null;
  installProgress: Map<number, number>;
  detect: () => Promise<JavaInstallationDto[]>;
  install: (majorVersion: 8 | 17 | 21) => Promise<JavaInstallationDto | null>;
  selectForMc: (mcVersion: string) => Promise<JavaInstallationDto | null>;
  getRequiredVersion: (mcVersion: string) => Promise<JavaRequiredVersionResult | null>;
  refresh: () => Promise<void>;
}

export function useJava(): UseJavaReturn {
  const [installations, setInstallations] = useState<JavaInstallationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<Map<number, number>>(new Map());

  // 載入已儲存的 Java 安裝
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.java.getInstallations();
      if (result.success && result.data) {
        setInstallations(result.data);
      } else {
        setError(result.error || 'Failed to load Java installations');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 檢測系統 Java
  const detect = useCallback(async (): Promise<JavaInstallationDto[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.java.detect();
      if (result.success && result.data) {
        setInstallations(result.data);
        return result.data;
      }
      setError(result.error || 'Failed to detect Java');
      return [];
    } catch (err) {
      setError(String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 安裝 Java
  const install = useCallback(async (majorVersion: 8 | 17 | 21): Promise<JavaInstallationDto | null> => {
    setError(null);
    setInstallProgress((prev) => {
      const next = new Map(prev);
      next.set(majorVersion, 0);
      return next;
    });

    try {
      const result = await window.electronAPI.java.install({ majorVersion });
      if (result.success && result.data) {
        setInstallations((prev) => {
          const existing = prev.findIndex((j) => j.majorVersion === majorVersion);
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = result.data!;
            return next;
          }
          return [...prev, result.data!];
        });
        return result.data;
      }
      setError(result.error || 'Failed to install Java');
      return null;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setInstallProgress((prev) => {
        const next = new Map(prev);
        next.delete(majorVersion);
        return next;
      });
    }
  }, []);

  // 為 Minecraft 版本選擇 Java
  const selectForMc = useCallback(async (mcVersion: string): Promise<JavaInstallationDto | null> => {
    try {
      const result = await window.electronAPI.java.selectForMc(mcVersion);
      if (result.success) {
        return result.data ?? null;
      }
      setError(result.error || 'Failed to select Java');
      return null;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, []);

  // 取得 MC 版本所需的 Java 版本
  const getRequiredVersion = useCallback(async (mcVersion: string): Promise<JavaRequiredVersionResult | null> => {
    try {
      const result = await window.electronAPI.java.getRequiredVersion(mcVersion);
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // 訂閱安裝進度事件
  useEffect(() => {
    const unsubscribe = window.electronAPI.java.onInstallProgress((event: JavaInstallProgressEvent) => {
      setInstallProgress((prev) => {
        const next = new Map(prev);
        next.set(event.majorVersion, event.progress.percentage);
        return next;
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
    installations,
    loading,
    error,
    installProgress,
    detect,
    install,
    selectForMc,
    getRequiredVersion,
    refresh,
  };
}
