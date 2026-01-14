/**
 * ServerList 元件 - 伺服器列表
 * 設計語言與 Lumix 保持一致
 */

import { useTranslation } from 'react-i18next';
import { Server, Upload } from 'lucide-react';
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
    <div className="flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center border-muted-foreground/25 bg-muted/50">
      <div className="text-center p-8">
        <div className="rounded-full bg-background p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-sm">
          <Server className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{t('welcome.title')}</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
