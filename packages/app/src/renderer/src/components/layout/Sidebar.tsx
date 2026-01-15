/**
 * Sidebar 元件 - 側邊欄導航
 * 支援平滑的摺疊/展開動畫
 */

import { Server, Plus, Settings, PanelLeftClose, PanelLeft, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ServerItem {
  id: string;
  name: string;
  status: 'stopped' | 'running';
}

interface ServerNavItemProps {
  server: ServerItem;
  isSelected: boolean;
  onSelect: () => void;
  isCollapsed: boolean;
}

/** 伺服器導航項目 */
function ServerNavItem({ server, isSelected, onSelect, isCollapsed }: ServerNavItemProps) {
  const isRunning = server.status === 'running';

  const content = (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center rounded-md transition-all duration-200',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
        isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2 text-sm'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          isRunning ? 'bg-green-500' : 'bg-muted-foreground',
          isCollapsed ? 'h-2.5 w-2.5' : 'h-2 w-2'
        )}
      />
      <span
        className={cn(
          'truncate transition-all duration-200',
          isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        )}
      >
        {server.name}
      </span>
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', isRunning ? 'bg-green-500' : 'bg-muted-foreground')} />
          {server.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

/** 側邊欄按鈕元件 */
function SidebarButton({
  icon: Icon,
  label,
  onClick,
  isCollapsed,
  isActive,
}: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  isCollapsed: boolean;
  isActive?: boolean;
}) {
  const content = (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        'w-full h-9 overflow-hidden transition-all duration-300 ease-out',
        isCollapsed ? 'px-0 justify-center' : 'px-3 justify-start'
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span
        className={cn(
          'truncate transition-all duration-300 ease-out overflow-hidden',
          isCollapsed ? 'w-0 ml-0 opacity-0' : 'w-auto ml-2.5 opacity-100'
        )}
      >
        {label}
      </span>
    </Button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface SidebarProps {
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  currentView?: 'servers' | 'settings' | 'about';
}

export function Sidebar({
  servers = [],
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
  onOpenAbout,
  currentView = 'servers',
}: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 監聽視窗大小變化
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-muted/10 backdrop-blur-sm shrink-0',
          'border-border/50 transition-all duration-300 ease-out',
          isCollapsed ? 'w-14' : 'w-56'
        )}
      >
        {/* Logo 區域 */}
        <div
          className={cn(
            'flex items-center border-b h-12 transition-all duration-300',
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          )}
        >
          {isCollapsed ? (
            // 摺疊時：只顯示展開按鈕
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleCollapse}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.expand')}</TooltipContent>
            </Tooltip>
          ) : (
            // 展開時：顯示 Logo 和摺疊按鈕
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <Server className="h-5 w-5 text-primary shrink-0" />
                <span className="font-bold text-lg truncate">Lumix</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleCollapse}>
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('sidebar.collapse')}</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* 伺服器列表 */}
        <div
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden min-h-0 transition-all duration-300',
            isCollapsed ? 'px-1.5 pt-1' : 'px-3 pt-3'
          )}
        >
          <div
            className={cn(
              'mb-2 flex items-center transition-all duration-200',
              isCollapsed ? 'justify-center' : 'justify-between px-1'
            )}
          >
            <span
              className={cn(
                'text-sm font-medium text-muted-foreground truncate transition-all duration-200',
                isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              )}
            >
              {t('sidebar.servers')}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCreateServer}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.addServer')}</TooltipContent>
            </Tooltip>
          </div>

          <nav className="flex flex-col gap-1">
            {servers.map((server) => (
              <ServerNavItem
                key={server.id}
                server={server}
                isSelected={selectedServerId === server.id && currentView === 'servers'}
                onSelect={() => onSelectServer?.(server.id)}
                isCollapsed={isCollapsed}
              />
            ))}

            {servers.length === 0 && !isCollapsed && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('welcome.description')}
              </div>
            )}
          </nav>
        </div>

        {/* 底部功能按鈕 */}
        <div className={cn('border-t space-y-1 transition-all duration-300 ease-out', isCollapsed ? 'p-2' : 'p-3')}>
          <SidebarButton
            icon={Settings}
            label={t('sidebar.settings')}
            onClick={onOpenSettings}
            isCollapsed={isCollapsed}
            isActive={currentView === 'settings'}
          />
          <SidebarButton
            icon={Info}
            label={t('sidebar.about')}
            onClick={onOpenAbout}
            isCollapsed={isCollapsed}
            isActive={currentView === 'about'}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
