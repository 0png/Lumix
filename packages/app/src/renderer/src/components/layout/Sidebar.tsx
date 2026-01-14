import { Server, Plus, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ServerItem {
  id: string;
  name: string;
  status: 'stopped' | 'running';
}

// Mock data for development
const mockServers: ServerItem[] = [
  { id: '1', name: 'Survival Server', status: 'running' },
  { id: '2', name: 'Creative World', status: 'stopped' },
  { id: '3', name: 'Modded Server', status: 'stopped' },
];

interface SidebarProps {
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
}

export function Sidebar({
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <Server className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Lumix</h1>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t('sidebar.servers')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreateServer}
            title={t('sidebar.addServer')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <nav className="space-y-1">
          {mockServers.map((server) => (
            <button
              key={server.id}
              onClick={() => onSelectServer?.(server.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                selectedServerId === server.id && 'bg-accent text-accent-foreground'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  server.status === 'running' ? 'bg-green-500' : 'bg-muted-foreground'
                )}
              />
              <span className="truncate">{server.name}</span>
            </button>
          ))}

          {mockServers.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('welcome.description')}
            </div>
          )}
        </nav>
      </div>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
          {t('sidebar.settings')}
        </Button>
      </div>
    </aside>
  );
}
