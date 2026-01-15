/**
 * ServerList 元件 - 伺服器列表
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計
 */

import { useTranslation } from 'react-i18next';
import { Server } from 'lucide-react';
import { ServerCard } from './ServerCard';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';
export type CoreType = 'vanilla' | 'paper' | 'fabric' | 'forge';

export interface ServerInstance {
  id: string;
  name: string;
  coreType: CoreType;
  mcVersion: string;
  status: ServerStatus;
  ramMax: number;
  isReady?: boolean; // server.jar 是否已下載完成
}

interface ServerListProps {
  servers: ServerInstance[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onStartServer?: (id: string) => void;
  onStopServer?: (id: string) => void;
}

/**
 * 空狀態元件
 */
function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center border-muted-foreground/25 bg-muted/50 min-h-[200px]">
      <div className="text-center p-4 lg:p-6">
        <div className="rounded-full bg-background p-2 lg:p-3 w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2 lg:mb-3 flex items-center justify-center shadow-sm">
          <Server className="h-5 w-5 lg:h-6 lg:w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm lg:text-base font-semibold">{t('welcome.title')}</h3>
        <p className="text-xs lg:text-sm text-muted-foreground mt-1 max-w-xs">
          {t('welcome.description')}
        </p>
      </div>
    </div>
  );
}

/**
 * 伺服器列表元件
 */
export function ServerList({
  servers,
  selectedServerId,
  onSelectServer,
  onStartServer,
  onStopServer,
}: ServerListProps) {
  if (servers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((server) => (
        <ServerCard
          key={server.id}
          server={server}
          isSelected={selectedServerId === server.id}
          onSelect={() => onSelectServer?.(server.id)}
          onStart={() => onStartServer?.(server.id)}
          onStop={() => onStopServer?.(server.id)}
        />
      ))}
    </div>
  );
}
