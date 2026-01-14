import { useTranslation } from 'react-i18next';
import { ServerCard } from './ServerCard';
import { Server } from 'lucide-react';

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

export function ServerList({
  servers,
  selectedServerId,
  onSelectServer,
  onStartServer,
  onStopServer,
}: ServerListProps) {
  const { t } = useTranslation();

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16">
        <Server className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('welcome.title')}</h3>
        <p className="text-muted-foreground max-w-sm">
          {t('welcome.description')}
        </p>
      </div>
    );
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
