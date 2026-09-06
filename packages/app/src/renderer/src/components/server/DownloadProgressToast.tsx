import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Progress } from '@/components/ui/progress';
import type { DownloadProgress } from '../../../../shared/ipc-types';
import type { ServerInstance } from './ServerList';

interface DownloadProgressToastProps {
  servers: ServerInstance[];
  downloadProgress: Map<string, DownloadProgress>;
}

interface ToastContentProps {
  server: ServerInstance;
  progress?: DownloadProgress;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function ToastContent({ server, progress }: ToastContentProps) {
  const { t } = useTranslation();
  const percentage = progress?.percentage ?? 0;
  const hasKnownTotal = Boolean(progress && progress.total > 0);
  const isPreparing = percentage >= 100 || ((progress?.downloaded ?? 0) > 0 && !hasKnownTotal);
  const progressLabel = hasKnownTotal
    ? `${Math.round(percentage)}%`
    : t('toast.downloadProgressUnknown');

  return (
    <div className="w-[310px] space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60">
          {isPreparing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium">
            {t('toast.downloadProgressTitle', { name: server.name })}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {isPreparing
              ? t('toast.downloadPreparing', {
                  core: t(`coreType.${server.coreType}`),
                  version: server.mcVersion,
                })
              : t('toast.downloadProgressDescription', {
                  core: t(`coreType.${server.coreType}`),
                  version: server.mcVersion,
                })}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progressLabel}</span>
      </div>

      <div className="space-y-1.5">
        <Progress
          value={hasKnownTotal ? percentage : 35}
          indeterminate={!hasKnownTotal || isPreparing}
          className="h-1.5 bg-muted/70"
        />
        {hasKnownTotal && (
          <div className="flex justify-between text-[10px] text-muted-foreground/80">
            <span>{formatBytes(progress?.downloaded ?? 0)}</span>
            <span>{formatBytes(progress?.total ?? 0)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DownloadProgressToast({ servers, downloadProgress }: DownloadProgressToastProps) {
  const toastIds = useRef<Map<string, string>>(new Map());
  const activeDownloads = useMemo(
    () => servers.filter((server) => server.isReady === false),
    [servers]
  );

  useEffect(() => {
    const activeIds = new Set(activeDownloads.map((server) => server.id));

    for (const server of activeDownloads) {
      const toastId = `server-download-${server.id}`;
      toastIds.current.set(server.id, toastId);
      toast.add({
        id: toastId,
        type: 'loading',
        timeout: 0,
        data: {
          content: <ToastContent server={server} progress={downloadProgress.get(server.id)} />,
        },
      });
    }

    for (const [serverId, toastId] of toastIds.current) {
      if (!activeIds.has(serverId)) {
        toast.close(toastId);
        toastIds.current.delete(serverId);
      }
    }
  }, [activeDownloads, downloadProgress]);

  useEffect(() => {
    const activeToastIds = toastIds.current;
    return () => {
      for (const toastId of activeToastIds.values()) {
        toast.close(toastId);
      }
      activeToastIds.clear();
    };
  }, []);

  return null;
}
