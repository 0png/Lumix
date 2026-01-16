/**
 * ServerCard 元件 - 伺服器卡片
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計、無障礙、玻璃擬態效果
 */

import { useTranslation } from 'react-i18next';
import { Play, Square, MemoryStick, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
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

/**
 * 狀態指示器元件 - 帶光暈效果和無障礙支援
 */
function StatusIndicator({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  const statusConfig = {
    stopped: { 
      color: 'bg-muted-foreground', 
      label: t('server.stopped'),
      icon: '⏹',
      badgeVariant: 'ghost' as const,
    },
    starting: { 
      color: 'status-glow-transitioning', 
      label: t('server.starting'),
      icon: '⏳',
      badgeVariant: 'warning' as const,
    },
    running: { 
      color: 'status-glow-running', 
      label: t('server.running'),
      icon: '▶',
      badgeVariant: 'success' as const,
    },
    stopping: { 
      color: 'status-glow-transitioning', 
      label: t('server.stopping'),
      icon: '⏳',
      badgeVariant: 'warning' as const,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge 
      variant={config.badgeVariant}
      className="gap-1.5"
      role="status"
      aria-label={`${t('server.status')}: ${config.label}`}
    >
      <span 
        className={cn('h-2 w-2 rounded-full transition-all duration-300', config.color)} 
        aria-hidden="true"
      />
      <span className="text-xs">{config.label}</span>
    </Badge>
  );
}

/**
 * 伺服器卡片元件
 */
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

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      onStop?.();
    } else if (server.status === 'stopped' && isReady) {
      onStart?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer card-hover group relative overflow-hidden',
        'glass border-border/50',
        'hover:border-primary/30 hover:bg-accent/30',
        'focus-ring',
        isSelected && 'ring-2 ring-primary border-primary/50',
        isRunning && 'border-green-500/30 hover:border-green-500/50',
        'animate-fade-in-up'
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${server.name} - ${t(`coreType.${server.coreType}`)} ${server.mcVersion}`}
    >
      {/* 頂部漸層裝飾 */}
      <div 
        className={cn(
          'absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          'bg-gradient-to-r from-transparent via-primary/50 to-transparent',
          isRunning && 'opacity-100 via-green-500/50'
        )}
        aria-hidden="true"
      />
      
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium truncate group-hover:text-primary transition-colors duration-200">
            {server.name}
          </CardTitle>
          <StatusIndicator status={server.status} />
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="space-y-2.5">
          {/* 伺服器資訊 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {t(`coreType.${server.coreType}`)}
            </Badge>
            <span className="text-muted-foreground/50">•</span>
            <span>{server.mcVersion}</span>
          </div>

          {/* 下載進度條 */}
          {isDownloading && (
            <div className="space-y-1" role="progressbar" aria-valuenow={downloadProgress} aria-valuemin={0} aria-valuemax={100}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Download className="h-3 w-3 animate-pulse" aria-hidden="true" />
                  {t('server.downloading')}
                </span>
                <span className="text-muted-foreground tabular-nums">{Math.round(downloadProgress)}%</span>
              </div>
              <Progress value={downloadProgress} variant="default" className="h-1.5" />
            </div>
          )}

          {/* 記憶體和操作按鈕 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{server.ramMax} MB</span>
            </div>
            <Button
              size="sm"
              variant={isRunning ? 'destructive' : 'default'}
              disabled={isTransitioning || (!isRunning && !isReady) || isDownloading}
              onClick={handleActionClick}
              className={cn(
                'h-7 text-xs px-3 transition-all duration-200 ripple',
                !isRunning && !isTransitioning && 'hover:shadow-md hover:shadow-primary/20',
                isRunning && 'hover:shadow-md hover:shadow-destructive/20'
              )}
              aria-label={isRunning ? t('server.stop') : t('server.start')}
            >
              {isRunning ? (
                <>
                  <Square className="mr-1 h-3 w-3" aria-hidden="true" />
                  {t('server.stop')}
                </>
              ) : (
                <>
                  <Play className="mr-1 h-3 w-3" aria-hidden="true" />
                  {isDownloading ? t('server.downloading') : !isReady ? t('server.downloading') : t('server.start')}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
