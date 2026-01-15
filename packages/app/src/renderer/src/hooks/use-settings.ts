// useSettings Hook
// 封裝設定管理的 IPC 呼叫

import { useState, useEffect, useCallback } from 'react';
import type { SettingsDto, SaveSettingsRequest } from '../../../shared/ipc-types';

interface UseSettingsReturn {
  settings: SettingsDto | null;
  loading: boolean;
  error: string | null;
  save: (data: SaveSettingsRequest) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 載入設定
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.settings.get();
      if (result.success && result.data) {
        setSettings(result.data);
      } else {
        setError(result.error || 'Failed to load settings');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 儲存設定
  const save = useCallback(async (data: SaveSettingsRequest): Promise<boolean> => {
    setError(null);
    try {
      const result = await window.electronAPI.settings.save(data);
      if (result.success && result.data) {
        setSettings(result.data);
        return true;
      }
      setError(result.error || 'Failed to save settings');
      return false;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  // 初始載入
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    settings,
    loading,
    error,
    save,
    refresh,
  };
}
