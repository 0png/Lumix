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
        isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2 text-sm'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          server.status === 'running' ? 'bg-green-500' : 'bg-muted-foreground',
          isCollapsed ? 'h-2.5 w-2.5' : 'h-2 w-2'
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

/** 側邊欄按鈕元件 */
function SidebarButton({
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
      className={cn(
        'w-full justify-start',
        isCollapsed ? 'h-10 w-10 p-0 justify-center' : 'h-9 px-3 text-sm'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-2.5')} />
      {!isCollapsed && label}
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
  const themeLabel = t(`theme.${theme}`);
  const languageLabel = language === 'zh-TW' ? '繁體中文' : 'English';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-muted/20 shrink-0 transition-all duration-200',
          isCollapsed ? 'w-16' : 'w-52 lg:w-64'
        )}
      >
        {/* Logo 區域 + 摺疊按鈕 */}
        <div className={cn('flex items-center justify-between border-b', isCollapsed ? 'p-2' : 'px-4 py-3')}>
          <h1
            className={cn(
              'font-bold tracking-tight flex items-center',
              isCollapsed ? 'justify-center w-full' : 'gap-2.5 text-lg'
            )}
          >
            <Server className="h-5 w-5 text-primary shrink-0" />
            {!isCollapsed && 'Lumix'}
          </h1>
          {!isCollapsed && (
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
        <div className={cn('flex-1 overflow-auto', isCollapsed ? 'px-2 pt-2' : 'px-3 pt-3')}>
          <div
            className={cn(
              'mb-2 flex items-center',
              isCollapsed ? 'justify-center' : 'justify-between px-1'
            )}
          >
            {!isCollapsed && (
              <span className="text-sm font-medium text-muted-foreground">
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
                isSelected={selectedServerId === server.id}
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
        <div className={cn('border-t space-y-1', isCollapsed ? 'p-2' : 'p-3')}>
          <SidebarButton
            icon={ThemeIcon}
            label={themeLabel}
            onClick={toggleTheme}
            isCollapsed={isCollapsed}
          />
          <SidebarButton
            icon={Globe}
            label={languageLabel}
            onClick={toggleLanguage}
            isCollapsed={isCollapsed}
          />
          <SidebarButton
            icon={Settings}
            label={t('sidebar.settings')}
            onClick={onOpenSettings}
            isCollapsed={isCollapsed}
          />
          <SidebarButton
            icon={Info}
            label={t('sidebar.about')}
            onClick={onOpenAbout}
            isCollapsed={isCollapsed}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
