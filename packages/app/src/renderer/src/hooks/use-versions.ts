// useVersions Hook
// 封裝版本列表獲取的 IPC 呼叫

import { useState, useCallback } from 'react';
import type { CoreType } from '../../../shared/ipc-types';

interface UseVersionsReturn {
  versions: string[];
  loading: boolean;
  error: string | null;
  fetchVersions: (coreType: CoreType) => Promise<string[]>;
}

export function useVersions(): UseVersionsReturn {
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async (coreType: CoreType): Promise<string[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.download.fetchVersions(coreType);
      if (result.success && result.data) {
        setVersions(result.data.versions);
        return result.data.versions;
      }
      setError(result.error || 'Failed to fetch versions');
      return [];
    } catch (err) {
      setError(String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    versions,
    loading,
    error,
    fetchVersions,
  };
}
