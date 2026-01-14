/**
 * Sidebar 元件 - 側邊欄導航
 * 設計語言與 Lumix 保持一致
 */

import { Server, Plus, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ServerItem {
  id: string;
  name: string;
  status: 'stopped' | 'running';
}

interface NavButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

/**
 * 導航按鈕元件
 */
function NavButton({ isActive, onClick, icon, label }: NavButtonProps) {
  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className="w-full justify-start"
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}

interface ServerNavItemProps {
  server: ServerItem;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * 伺服器導航項目
 */
function ServerNavItem({ server, isSelected, onSelect }: ServerNavItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground'
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
  );
}

interface SidebarProps {
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
}

export function Sidebar({
  servers = [],
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/20 shrink-0">
      {/* Logo 區域 */}
      <div className="mb-6 px-4 pt-4">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          {t('appName')}
        </h1>
      </div>

      {/* 伺服器列表 */}
      <div className="flex-1 overflow-auto px-2">
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

        <nav className="flex flex-col gap-1">
          {servers.map((server) => (
            <ServerNavItem
              key={server.id}
              server={server}
              isSelected={selectedServerId === server.id}
              onSelect={() => onSelectServer?.(server.id)}
            />
          ))}

          {servers.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('welcome.description')}
            </div>
          )}
        </nav>
      </div>

      {/* 底部設定按鈕 */}
      <div className="border-t p-2">
        <NavButton
          isActive={false}
          onClick={() => onOpenSettings?.()}
          icon={<Settings className="mr-2 h-4 w-4" />}
          label={t('sidebar.settings')}
        />
      </div>
    </aside>
  );
}
