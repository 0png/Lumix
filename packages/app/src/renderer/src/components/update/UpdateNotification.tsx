import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdate } from '../../hooks/use-update';
import { toast } from 'sonner';
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
      toast(t('update.available.title'), {
        description: t('update.available.description', { version: updateInfo.version }),
        duration: Infinity,
        action: {
          label: t('update.download'),
          onClick: downloadUpdate,
        },
      });
    }
  }, [available, updateInfo, downloadUpdate, t]);

  // 顯示下載進度
  useEffect(() => {
    if (downloading && downloadProgress) {
      const percent = Math.round(downloadProgress.percent);
      toast(t('update.downloading.title'), {
        description: (
          <div className="space-y-2">
            <Progress value={percent} />
            <p className="text-sm text-muted-foreground">{percent}%</p>
          </div>
        ),
        duration: Infinity,
      });
    }
  }, [downloading, downloadProgress, t]);

  // 顯示下載完成通知
  useEffect(() => {
    if (downloaded) {
      toast(t('update.downloaded.title'), {
        description: t('update.downloaded.description'),
        duration: Infinity,
        action: {
          label: t('update.install'),
          onClick: quitAndInstall,
        },
      });
    }
  }, [downloaded, quitAndInstall, t]);

  // 顯示錯誤通知
  useEffect(() => {
    if (error) {
      toast.error(t('update.error.title'), {
        description: error,
      });
    }
  }, [error, t]);

  return null;
}
