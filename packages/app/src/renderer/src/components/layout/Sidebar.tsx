/**
 * Sidebar 元件 - 側邊欄導航
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計：小視窗時收縮為圖示模式
 */

import { Server, Plus, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
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

/**
 * 伺服器導航項目
 */
function ServerNavItem({ server, isSelected, onSelect, isCollapsed }: ServerNavItemProps) {
  const content = (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
        isCollapsed ? 'justify-center p-2' : 'gap-2 px-2 py-1.5 text-xs'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          server.status === 'running' ? 'bg-green-500' : 'bg-muted-foreground',
          isCollapsed ? 'h-2 w-2' : 'h-1.5 w-1.5'
        )}
      />
      {!isCollapsed && <span className="truncate">{server.name}</span>}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{server.name}</TooltipContent>
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
}

export function Sidebar({
  servers = [],
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
}: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // 監聽視窗大小變化
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1024;
      setIsSmallScreen(isSmall);
      // 小螢幕時自動收縮
      if (isSmall && !isCollapsed) {
        setIsCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-muted/20 shrink-0 transition-all duration-200',
          isCollapsed ? 'w-14' : 'w-44 lg:w-56'
        )}
      >
        {/* Logo 區域 */}
        <div className={cn('mb-2 pt-2', isCollapsed ? 'px-2' : 'px-3 lg:mb-3 lg:pt-3')}>
          <div className="flex items-center justify-between">
            <h1
              className={cn(
                'font-bold tracking-tight flex items-center',
                isCollapsed ? 'justify-center w-full' : 'gap-2 text-sm lg:text-base'
              )}
            >
              <Server className="h-4 w-4 text-primary shrink-0" />
              {!isCollapsed && 'Lumix'}
            </h1>
          </div>
        </div>

        {/* 伺服器列表 */}
        <div className={cn('flex-1 overflow-auto', isCollapsed ? 'px-1' : 'px-2')}>
          <div
            className={cn(
              'mb-1 flex items-center',
              isCollapsed ? 'justify-center' : 'justify-between px-2'
            )}
          >
            {!isCollapsed && (
              <span className="text-xs font-medium text-muted-foreground">
                {t('sidebar.servers')}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onCreateServer}
                  title={t('sidebar.addServer')}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.addServer')}</TooltipContent>
            </Tooltip>
          </div>

          <nav className="flex flex-col gap-0.5">
            {servers.map((server) => (
              <ServerNavItem
                key={server.id}
                server={server}
                isSelected={selectedServerId === server.id}
                onSelect={() => onSelectServer?.(server.id)}
                isCollapsed={isCollapsed}
              />
            ))}

            {servers.length === 0 && !isCollapsed && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground lg:py-6">
                {t('welcome.description')}
              </div>
            )}
          </nav>
        </div>

        {/* 底部區域 */}
        <div className="border-t p-1.5 space-y-1">
          {/* 收縮/展開按鈕 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-full', isCollapsed ? 'justify-center' : 'justify-start px-2')}
                onClick={toggleCollapse}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">{t('sidebar.collapse') || '收縮'}</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">{t('sidebar.expand') || '展開'}</TooltipContent>}
          </Tooltip>

          {/* 設定按鈕 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn('w-full h-7 text-xs', isCollapsed ? 'justify-center px-0' : 'justify-start px-2')}
                onClick={() => onOpenSettings?.()}
              >
                <Settings className={cn('h-3.5 w-3.5', !isCollapsed && 'mr-1.5')} />
                {!isCollapsed && t('sidebar.settings')}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">{t('sidebar.settings')}</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
