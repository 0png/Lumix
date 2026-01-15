/**
 * ServerCard 元件 - 伺服器卡片
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計
 */

import { useTranslation } from 'react-i18next';
import { Play, Square, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ServerInstance, ServerStatus } from './ServerList';

interface ServerCardProps {
  server: ServerInstance;
  isSelected?: boolean;
  onSelect?: () => void;
  onStart?: () => void;
  onStop?: () => void;
}

/**
 * 狀態指示器元件 - 帶光暈效果
 */
function StatusIndicator({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  const statusConfig = {
    stopped: { 
      color: 'bg-muted-foreground', 
      label: t('server.stopped'),
      glow: '',
    },
    starting: { 
      color: 'status-glow-transitioning', 
      label: t('server.starting'),
      glow: 'glow-yellow',
    },
    running: { 
      color: 'status-glow-running', 
      label: t('server.running'),
      glow: 'glow-green',
    },
    stopping: { 
      color: 'status-glow-transitioning', 
      label: t('server.stopping'),
      glow: 'glow-yellow',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      <span className={cn('h-2 w-2 rounded-full transition-all duration-300', config.color)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
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
}: ServerCardProps) {
  const { t } = useTranslation();
  const isRunning = server.status === 'running';
  const isTransitioning = server.status === 'starting' || server.status === 'stopping';
  const isReady = server.isReady !== false; // 預設為 true

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      onStop?.();
    } else if (server.status === 'stopped' && isReady) {
      onStart?.();
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer card-hover group relative overflow-hidden',
        'border border-border/50 bg-card/80 backdrop-blur-sm',
        'hover:border-primary/30 hover:bg-accent/30',
        isSelected && 'ring-2 ring-primary border-primary/50',
        isRunning && 'border-green-500/30 hover:border-green-500/50',
        'animate-fade-in-up'
      )}
      style={{ animationDelay: '0ms' }}
      onClick={onSelect}
    >
      {/* 頂部漸層裝飾 */}
      <div 
        className={cn(
          'absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          'bg-gradient-to-r from-transparent via-primary/50 to-transparent',
          isRunning && 'opacity-100 via-green-500/50'
        )}
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
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{t(`coreType.${server.coreType}`)}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>{server.mcVersion}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" />
              <span>{server.ramMax} MB</span>
            </div>
            <Button
              size="sm"
              variant={isRunning ? 'destructive' : 'default'}
              disabled={isTransitioning || (!isRunning && !isReady)}
              onClick={handleActionClick}
              className={cn(
                'h-7 text-xs px-3 transition-all duration-200',
                !isRunning && !isTransitioning && 'hover:shadow-md hover:shadow-primary/20',
                isRunning && 'hover:shadow-md hover:shadow-destructive/20'
              )}
            >
              {isRunning ? (
                <>
                  <Square className="mr-1 h-3 w-3" />
                  {t('server.stop')}
                </>
              ) : (
                <>
                  <Play className="mr-1 h-3 w-3" />
                  {!isReady ? t('server.downloading') : t('server.start')}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
