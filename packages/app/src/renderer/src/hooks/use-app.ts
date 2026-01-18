// useApp Hook
// 封裝應用程式相關的 IPC 呼叫

import { useState, useEffect, useCallback } from 'react';
import { useUpdate } from './use-update';

interface UseAppReturn {
  version: string | null;
  dataPath: string | null;
  loading: boolean;
  openFolder: (path: string) => Promise<boolean>;
}

export function useApp(): UseAppReturn {
  const [version, setVersion] = useState<string | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { checkForUpdates } = useUpdate();

  // 載入應用程式資訊
  useEffect(() => {
    const loadAppInfo = async () => {
      setLoading(true);
      try {
        const [versionResult, pathResult] = await Promise.all([
          window.electronAPI.app.getVersion(),
          window.electronAPI.app.getDataPath(),
        ]);

        if (versionResult.success && versionResult.data) {
          setVersion(versionResult.data);
        }
        if (pathResult.success && pathResult.data) {
          setDataPath(pathResult.data);
        }

        // 啟動後自動檢查更新（延遲 3 秒避免影響啟動速度）
        setTimeout(() => {
          checkForUpdates().catch(console.error);
        }, 3000);
      } catch (err) {
        console.error('Failed to load app info:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAppInfo();
  }, [checkForUpdates]);

  // 開啟資料夾
  const openFolder = useCallback(async (path: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.app.openFolder(path);
      return result.success;
    } catch (err) {
      console.error('Failed to open folder:', err);
      return false;
    }
  }, []);

  return {
    version,
    dataPath,
    loading,
    openFolder,
  };
}
