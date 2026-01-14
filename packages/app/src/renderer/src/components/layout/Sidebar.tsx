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
      className="w-full justify-start h-8 text-xs"
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
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
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
    <aside className="flex h-full w-56 flex-col border-r bg-muted/20 shrink-0">
      {/* Logo 區域 */}
      <div className="mb-3 px-3 pt-3">
        <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          Lumix
        </h1>
      </div>

      {/* 伺服器列表 */}
      <div className="flex-1 overflow-auto px-2">
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t('sidebar.servers')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onCreateServer}
            title={t('sidebar.addServer')}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {servers.map((server) => (
            <ServerNavItem
              key={server.id}
              server={server}
              isSelected={selectedServerId === server.id}
              onSelect={() => onSelectServer?.(server.id)}
            />
          ))}

          {servers.length === 0 && (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
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
          icon={<Settings className="mr-2 h-3.5 w-3.5" />}
          label={t('sidebar.settings')}
        />
      </div>
    </aside>
  );
}
