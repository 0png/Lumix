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
 * 狀態指示器元件
 */
function StatusIndicator({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  const statusConfig = {
    stopped: { color: 'bg-muted-foreground', label: t('server.stopped') },
    starting: { color: 'bg-yellow-500 animate-pulse', label: t('server.starting') },
    running: { color: 'bg-green-500', label: t('server.running') },
    stopping: { color: 'bg-yellow-500 animate-pulse', label: t('server.stopping') },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      <span className={cn('h-1.5 w-1.5 lg:h-2 lg:w-2 rounded-full', config.color)} />
      <span className="text-[10px] lg:text-xs text-muted-foreground">{config.label}</span>
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

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      onStop?.();
    } else if (server.status === 'stopped') {
      onStart?.();
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
    >
      <CardHeader className="p-3 lg:p-4 pb-1.5 lg:pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xs lg:text-sm font-medium truncate">
            {server.name}
          </CardTitle>
          <StatusIndicator status={server.status} />
        </div>
      </CardHeader>
      <CardContent className="p-3 lg:p-4 pt-0">
        <div className="space-y-1.5 lg:space-y-2">
          <div className="flex items-center gap-2 lg:gap-3 text-[10px] lg:text-xs text-muted-foreground">
            <span className="capitalize">{t(`coreType.${server.coreType}`)}</span>
            <span>{server.mcVersion}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] lg:text-xs text-muted-foreground">
              <MemoryStick className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
              <span>{server.ramMax} MB</span>
            </div>
            <Button
              size="sm"
              variant={isRunning ? 'destructive' : 'default'}
              disabled={isTransitioning}
              onClick={handleActionClick}
              className="h-6 lg:h-7 text-[10px] lg:text-xs px-2 lg:px-3"
            >
              {isRunning ? (
                <>
                  <Square className="mr-1 h-2.5 w-2.5 lg:h-3 lg:w-3" />
                  {t('server.stop')}
                </>
              ) : (
                <>
                  <Play className="mr-1 h-2.5 w-2.5 lg:h-3 lg:w-3" />
                  {t('server.start')}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
