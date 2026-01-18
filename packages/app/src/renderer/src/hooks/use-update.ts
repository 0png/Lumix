import { useState, useEffect, useCallback } from 'react';
import type {
  UpdateInfo,
  UpdateDownloadProgress,
  UpdateErrorEvent,
} from '../../../shared/ipc-types';

interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  updateInfo: UpdateInfo | null;
  downloadProgress: UpdateDownloadProgress | null;
  error: string | null;
}

export function useUpdate() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    updateInfo: null,
    downloadProgress: null,
    error: null,
  });

  // 檢查更新
  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    const result = await window.electronAPI.update.checkForUpdates();

    if (result.success && result.data) {
      setState((prev) => ({
        ...prev,
        checking: false,
        available: result.data!.hasUpdate,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        checking: false,
        error: result.error || 'Failed to check for updates',
      }));
    }
  }, []);

  // 下載更新
  const downloadUpdate = useCallback(async () => {
    setState((prev) => ({ ...prev, downloading: true, error: null }));

    const result = await window.electronAPI.update.downloadUpdate();

    if (!result.success) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: result.error || 'Failed to download update',
      }));
    }
  }, []);

  // 安裝更新並重啟
  const quitAndInstall = useCallback(async () => {
    await window.electronAPI.update.quitAndInstall();
  }, []);

  // 監聽更新事件
  useEffect(() => {
    const unsubscribeError = window.electronAPI.update.onError((event: UpdateErrorEvent) => {
      setState((prev) => ({
        ...prev,
        checking: false,
        downloading: false,
        error: event.message,
      }));
    });

    const unsubscribeAvailable = window.electronAPI.update.onAvailable((info: UpdateInfo) => {
      setState((prev) => ({
        ...prev,
        available: true,
        updateInfo: info,
      }));
    });

    const unsubscribeNotAvailable = window.electronAPI.update.onNotAvailable(() => {
      setState((prev) => ({
        ...prev,
        available: false,
        updateInfo: null,
      }));
    });

    const unsubscribeProgress = window.electronAPI.update.onDownloadProgress(
      (progress: UpdateDownloadProgress) => {
        setState((prev) => ({
          ...prev,
          downloadProgress: progress,
        }));
      }
    );

    const unsubscribeDownloaded = window.electronAPI.update.onDownloaded(() => {
      setState((prev) => ({
        ...prev,
        downloading: false,
        downloaded: true,
        downloadProgress: null,
      }));
    });

    return () => {
      unsubscribeError();
      unsubscribeAvailable();
      unsubscribeNotAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
    };
  }, []);

  return {
    ...state,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
  };
}
