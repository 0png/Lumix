/**
 * ServerList 元件 - 伺服器列表
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計
 */

import { useTranslation } from 'react-i18next';
import { Server, Plus } from 'lucide-react';
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
 * 空狀態元件 - 帶動畫效果
 */
function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center border-muted-foreground/25 bg-muted/30 min-h-[200px] animate-fade-in backdrop-blur-sm">
      <div className="text-center p-4 lg:p-6">
        <div className="rounded-full bg-gradient-to-br from-background to-muted p-2 lg:p-3 w-12 h-12 lg:w-14 lg:h-14 mx-auto mb-3 lg:mb-4 flex items-center justify-center shadow-lg shadow-primary/5 border border-border/50">
          <Server className="h-5 w-5 lg:h-6 lg:w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm lg:text-base font-semibold">{t('welcome.title')}</h3>
        <p className="text-xs lg:text-sm text-muted-foreground mt-1 max-w-xs">
          {t('welcome.description')}
        </p>
        <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground/70">
          <Plus className="h-3 w-3" />
          <span>{t('sidebar.addServer')}</span>
        </div>
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
      {servers.map((server, index) => (
        <div
          key={server.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
        >
          <ServerCard
            server={server}
            isSelected={selectedServerId === server.id}
            onSelect={() => onSelectServer?.(server.id)}
            onStart={() => onStartServer?.(server.id)}
            onStop={() => onStopServer?.(server.id)}
          />
        </div>
      ))}
    </div>
  );
}
