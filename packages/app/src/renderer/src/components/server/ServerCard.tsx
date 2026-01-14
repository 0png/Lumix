/**
 * ServerCard 元件 - 伺服器卡片
 * 設計語言與 Lumix 保持一致
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
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', config.color)} />
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
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium truncate">
            {server.name}
          </CardTitle>
          <StatusIndicator status={server.status} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{t(`coreType.${server.coreType}`)}</span>
            <span>{server.mcVersion}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MemoryStick className="h-3 w-3" />
              <span>{server.ramMax} MB</span>
            </div>
            <Button
              size="sm"
              variant={isRunning ? 'destructive' : 'default'}
              disabled={isTransitioning}
              onClick={handleActionClick}
              className="h-7 text-xs"
            >
              {isRunning ? (
                <>
                  <Square className="mr-1 h-3 w-3" />
                  {t('server.stop')}
                </>
              ) : (
                <>
                  <Play className="mr-1 h-3 w-3" />
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
