/**
 * Sidebar 元件 - 側邊欄導航
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計：小視窗時收縮為圖示模式
 */

import { Server, Plus, Settings, PanelLeftClose, PanelLeft, Info, Sun, Moon, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/contexts';
import { useLanguage } from '@/contexts';
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

/** 圖示按鈕元件 */
function IconButton({
  icon: Icon,
  label,
  onClick,
  isCollapsed,
}: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  isCollapsed: boolean;
}) {
  const content = (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

interface SidebarProps {
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
}

export function Sidebar({
  servers = [],
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
  onOpenAbout,
}: SidebarProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 監聽視窗大小變化
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1024;
      if (isSmall && !isCollapsed) {
        setIsCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'zh-TW' ? 'en' : 'zh-TW');
  };

  const ThemeIcon = theme === 'light' ? Sun : Moon;

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

        {/* 底部工具列 */}
        <div className="border-t p-2">
          <div className={cn(
            'flex items-center',
            isCollapsed ? 'flex-col gap-1' : 'justify-between'
          )}>
            {/* 左側：收縮按鈕 */}
            <IconButton
              icon={isCollapsed ? PanelLeft : PanelLeftClose}
              label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
              onClick={toggleCollapse}
              isCollapsed={isCollapsed}
            />

            {!isCollapsed && <Separator orientation="vertical" className="h-6" />}

            {/* 中間：主題和語言 */}
            <div className={cn('flex', isCollapsed ? 'flex-col gap-1' : 'gap-0.5')}>
              <IconButton
                icon={ThemeIcon}
                label={t(`theme.${theme}`)}
                onClick={toggleTheme}
                isCollapsed={isCollapsed}
              />
              <IconButton
                icon={Globe}
                label={language === 'zh-TW' ? '繁體中文' : 'English'}
                onClick={toggleLanguage}
                isCollapsed={isCollapsed}
              />
            </div>

            {!isCollapsed && <Separator orientation="vertical" className="h-6" />}

            {/* 右側：設定和關於 */}
            <div className={cn('flex', isCollapsed ? 'flex-col gap-1' : 'gap-0.5')}>
              <IconButton
                icon={Settings}
                label={t('sidebar.settings')}
                onClick={onOpenSettings}
                isCollapsed={isCollapsed}
              />
              <IconButton
                icon={Info}
                label={t('sidebar.about')}
                onClick={onOpenAbout}
                isCollapsed={isCollapsed}
              />
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
