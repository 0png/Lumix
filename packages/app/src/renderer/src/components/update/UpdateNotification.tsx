import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdate } from '../../hooks/use-update';
import { toast } from '@/components/ui/toast';
import { Progress } from '../ui/progress';

export function UpdateNotification() {
  const { t } = useTranslation();
  const {
    available,
    downloading,
    downloaded,
    updateInfo,
    downloadProgress,
    error,
    downloadUpdate,
    quitAndInstall,
  } = useUpdate();

  // 顯示更新可用通知
  useEffect(() => {
    if (available && updateInfo) {
      toast.add({
        id: 'app-update',
        title: t('update.available.title'),
        description: t('update.available.description', { version: updateInfo.version }),
        type: 'info',
        timeout: 0,
        actionProps: {
          children: t('update.download'),
          onClick: downloadUpdate,
        },
      });
    }
  }, [available, updateInfo, downloadUpdate, t]);

  // 顯示下載進度
  useEffect(() => {
    if (downloading && downloadProgress) {
      const percent = Math.round(downloadProgress.percent);
      toast.add({
        id: 'app-update',
        title: t('update.downloading.title'),
        description: (
          <div className="space-y-2">
            <Progress value={percent} />
            <p className="text-sm text-muted-foreground">{percent}%</p>
          </div>
        ),
        type: 'loading',
        timeout: 0,
        actionProps: undefined,
      });
    }
  }, [downloading, downloadProgress, t]);

  // 顯示下載完成通知
  useEffect(() => {
    if (downloaded) {
      toast.add({
        id: 'app-update',
        title: t('update.downloaded.title'),
        description: t('update.downloaded.description'),
        type: 'success',
        timeout: 0,
        actionProps: {
          children: t('update.install'),
          onClick: quitAndInstall,
        },
      });
    }
  }, [downloaded, quitAndInstall, t]);

  // 顯示錯誤通知
  useEffect(() => {
    if (error) {
      toast.add({
        id: 'app-update',
        title: t('update.error.title'),
        description: error,
        type: 'error',
        timeout: 3800,
        actionProps: undefined,
      });
    }
  }, [error, t]);

  return null;
}
