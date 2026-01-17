import { useState, useEffect, useCallback } from 'react';
import type { UpdateStatusDto, UpdaterStatusEvent } from '@/../../shared/ipc-types';

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatusDto>({ available: false });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = window.electronAPI.updater.onStatus((event: UpdaterStatusEvent) => {
      if (event.event === 'update-available') {
        setStatus({
          available: true,
          version: (event.data as any)?.version,
        });
      } else if (event.event === 'update-not-available') {
        setStatus({ available: false });
      } else if (event.event === 'download-progress') {
        setStatus((prev) => ({
          ...prev,
          downloading: true,
          progress: event.data as any,
        }));
      } else if (event.event === 'update-downloaded') {
        setStatus((prev) => ({
          ...prev,
          downloading: false,
        }));
      } else if (event.event === 'update-error') {
        setStatus({
          available: false,
          error: (event.data as any)?.message,
        });
      }
      setChecking(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const result = await window.electronAPI.updater.checkForUpdates();
      if (result.success && result.data) {
        setStatus(result.data);
      }
    } catch (error) {
      setStatus({
        available: false,
        error: (error as Error).message,
      });
    } finally {
      setChecking(false);
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    try {
      await window.electronAPI.updater.downloadUpdate();
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    try {
      await window.electronAPI.updater.installUpdate();
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
    }
  }, []);

  return {
    status,
    checking,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
