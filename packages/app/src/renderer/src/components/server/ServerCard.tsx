/**
 * ServerCard - 精準、低干擾的桌面伺服器控制卡片。
 */

import { useTranslation } from 'react-i18next';
import { Download, MemoryStick, Play, Square } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ServerCoreIcon } from './ServerCoreIcon';
import type { ServerInstance, ServerStatus } from './ServerList';

interface ServerCardProps {
  server: ServerInstance;
  isSelected?: boolean;
  onSelect?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  /** 下載進度 (0-100)，undefined 表示非下載狀態 */
  downloadProgress?: number;
}

const STATUS_DOT_CLASSES: Record<ServerStatus, string> = {
  stopped: 'bg-muted-foreground/55',
  starting: 'bg-amber-500 animate-pulse',
  running: 'bg-emerald-500 shadow-[0_0_0_3px_hsl(142_71%_45%/0.12)]',
  stopping: 'bg-amber-500 animate-pulse',
};

function StatusIndicator({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  return (
    <div
      className="flex shrink-0 items-center gap-2 pt-0.5 text-[11px] font-medium text-muted-foreground"
      role="status"
      aria-label={`${t('server.status')}: ${t(`server.${status}`)}`}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full motion-reduce:animate-none',
          STATUS_DOT_CLASSES[status]
        )}
        aria-hidden="true"
      />
      <span>{t(`server.${status}`)}</span>
    </div>
  );
}

function formatMemory(megabytes: number): string {
  if (megabytes < 1024) return `${megabytes} MB`;
  const gigabytes = megabytes / 1024;
  return `${Number.isInteger(gigabytes) ? gigabytes : gigabytes.toFixed(1)} GB`;
}

export function ServerCard({
  server,
  isSelected,
  onSelect,
  onStart,
  onStop,
  downloadProgress,
}: ServerCardProps) {
  const { t } = useTranslation();
  const isRunning = server.status === 'running';
  const isTransitioning = server.status === 'starting' || server.status === 'stopping';
  const isReady = server.isReady !== false;
  const isDownloading = downloadProgress !== undefined && downloadProgress < 100;
  const accessibleLabel = `${server.name} - ${t(`coreType.${server.coreType}`)} ${server.mcVersion}`;

  const handleActionClick = () => {
    if (isRunning) {
      onStop?.();
    } else if (server.status === 'stopped' && isReady) {
      onStart?.();
    }
  };

  return (
    <Card
      className={cn(
        'group/card relative min-h-[148px] overflow-hidden rounded-[14px] border border-border/65 bg-card/75',
        'shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_1px_2px_hsl(0_0%_0%/0.06)]',
        'transition-[border-color] duration-150 ease-in-out hover:border-border/90 motion-reduce:transition-none',
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[13px] before:bg-[radial-gradient(100%_100%_at_50%_0%,hsl(var(--foreground)/0.055)_0%,hsl(var(--foreground)/0.012)_100%)] before:opacity-0 before:content-['']",
        'before:transition-opacity before:duration-150 before:ease-in-out hover:before:opacity-100 motion-reduce:before:transition-none',
        isSelected && 'border-primary/35 bg-primary/[0.035]'
      )}
    >
      {isSelected ? (
        <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary/75" aria-hidden="true" />
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-10 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
        aria-label={accessibleLabel}
        aria-pressed={isSelected}
      />

      <div className="pointer-events-none relative z-20 flex min-h-[148px] flex-col p-4">
        <div className="flex items-start gap-3">
          <ServerCoreIcon
            coreType={server.coreType}
            className="h-10 w-10 shrink-0 rounded-[10px] border border-border/55 bg-background/65 shadow-[0_1px_2px_hsl(0_0%_0%/0.06)]"
            imageClassName="h-7 w-7 opacity-90 saturate-[0.92] transition-[filter,opacity] duration-150 ease-in-out group-hover/card:opacity-100 group-hover/card:saturate-100 motion-reduce:transition-none"
          />

          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="truncate text-[15px] font-semibold leading-5 tracking-[-0.012em] text-foreground/85 transition-colors duration-150 ease-in-out group-hover/card:text-foreground motion-reduce:transition-none">
              {server.name}
            </h2>
            <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
              {t(`coreType.${server.coreType}`)}
              <span className="px-1.5 text-muted-foreground/45" aria-hidden="true">·</span>
              <span className="tabular-nums">{server.mcVersion}</span>
            </p>
          </div>

          <StatusIndicator status={server.status} />
        </div>

        {isDownloading ? (
          <div
            className="mt-auto space-y-2"
            role="progressbar"
            aria-valuenow={downloadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                {t('server.downloading')}
              </span>
              <span className="font-medium tabular-nums text-foreground/70">{Math.round(downloadProgress)}%</span>
            </div>
            <Progress value={downloadProgress} className="h-1" />
          </div>
        ) : (
          <div className="mt-auto flex items-end justify-between gap-3 pt-6">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-medium tabular-nums text-foreground/65">{formatMemory(server.ramMax)}</span>
            </div>

            <Button
              size="sm"
              variant={isRunning ? 'ghost' : 'default'}
              disabled={isTransitioning || (!isRunning && !isReady)}
              onClick={handleActionClick}
              className={cn(
                'pointer-events-auto relative z-30 h-8 rounded-lg px-3 text-xs shadow-none transition-[background-color,color,transform] duration-150 ease-out active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none',
                isRunning && 'text-destructive hover:bg-destructive/10 hover:text-destructive'
              )}
              aria-label={isRunning ? t('server.stop') : t('server.start')}
            >
              {isRunning ? (
                <Square className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Play className="h-3 w-3" aria-hidden="true" />
              )}
              {isRunning ? t('server.stop') : !isReady ? t('server.downloading') : t('server.start')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
