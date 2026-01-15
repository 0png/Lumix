/**
 * Sidebar 元件 - 側邊欄導航
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計：小視窗時收縮為圖示模式
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
  showText: boolean;
}

/** 伺服器導航項目 */
function ServerNavItem({ server, isSelected, onSelect, isCollapsed, showText }: ServerNavItemProps) {
  const isRunning = server.status === 'running';
  
  const content = (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center rounded-md transition-all duration-200',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
        isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2 text-sm',
        'group'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0 transition-all duration-300',
          isRunning ? 'status-glow-running' : 'bg-muted-foreground',
          isCollapsed ? 'h-2.5 w-2.5' : 'h-2 w-2'
        )}
      />
      {showText && (
        <span className="truncate group-hover:text-foreground transition-colors">
          {server.name}
        </span>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isRunning ? 'bg-green-500' : 'bg-muted-foreground'
            )}
          />
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
  showText,
}: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  isCollapsed: boolean;
  isActive?: boolean;
  showText: boolean;
}) {
  const content = (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        'w-full justify-start overflow-hidden',
        isCollapsed ? 'h-10 w-10 p-0 justify-center' : 'h-9 px-3 text-sm'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4 shrink-0', !isCollapsed && 'mr-2.5')} />
      {showText && <span className="truncate">{label}</span>}
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
  // 追蹤動畫是否完成，用於延遲顯示內容
  const [isFullyExpanded, setIsFullyExpanded] = useState(true);

  // 監聽視窗大小變化
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1024;
      if (isSmall && !isCollapsed) {
        setIsCollapsed(true);
        setIsFullyExpanded(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 處理展開/收縮動畫完成後的狀態
  useEffect(() => {
    if (isCollapsed) {
      // 收縮時立即隱藏內容
      setIsFullyExpanded(false);
    } else {
      // 展開時等待動畫完成後才顯示內容
      const timer = setTimeout(() => {
        setIsFullyExpanded(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  // 是否顯示展開狀態的內容
  const showExpandedContent = !isCollapsed && isFullyExpanded;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-muted/10 backdrop-blur-sm shrink-0 transition-[width] duration-300 ease-in-out',
          'border-border/50',
          isCollapsed ? 'w-16' : 'w-52 lg:w-64'
        )}
      >
        {/* Logo 區域 + 摺疊按鈕 */}
        <div className={cn('flex items-center justify-between border-b overflow-hidden', isCollapsed ? 'p-2' : 'px-4 py-3')}>
          <h1
            className={cn(
              'font-bold tracking-tight flex items-center whitespace-nowrap min-w-0',
              isCollapsed ? 'justify-center w-full' : 'gap-2.5 text-lg'
            )}
          >
            <Server className="h-5 w-5 text-primary shrink-0" />
            {showExpandedContent && <span className="truncate">Lumix</span>}
          </h1>
          {showExpandedContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleCollapse}>
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.collapse')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* 展開按鈕（收縮時顯示） */}
        {isCollapsed && (
          <div className="p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full h-10" onClick={toggleCollapse}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.expand')}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* 伺服器列表 */}
        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden min-h-0', isCollapsed ? 'px-2 pt-2' : 'px-3 pt-3')}>
          <div
            className={cn(
              'mb-2 flex items-center',
              isCollapsed ? 'justify-center' : 'justify-between px-1'
            )}
          >
            {showExpandedContent && (
              <span className="text-sm font-medium text-muted-foreground truncate">
                {t('sidebar.servers')}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onCreateServer}
                >
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
                showText={showExpandedContent}
              />
            ))}

            {servers.length === 0 && showExpandedContent && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('welcome.description')}
              </div>
            )}
          </nav>
        </div>

        {/* 底部功能按鈕 */}
        <div className={cn('border-t space-y-1', isCollapsed ? 'p-2' : 'p-3')}>
          <SidebarButton
            icon={Settings}
            label={t('sidebar.settings')}
            onClick={onOpenSettings}
            isCollapsed={isCollapsed}
            isActive={currentView === 'settings'}
            showText={showExpandedContent}
          />
          <SidebarButton
            icon={Info}
            label={t('sidebar.about')}
            onClick={onOpenAbout}
            isCollapsed={isCollapsed}
            isActive={currentView === 'about'}
            showText={showExpandedContent}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
