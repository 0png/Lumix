/**
 * Sidebar 元件 - 側邊欄導航
 * 重新組織品牌、主操作與伺服器導覽層級，維持既有配色系統
 */

import { LayoutGrid, Plus, Settings, PanelLeftClose, PanelLeft, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import appIcon from '@/assets/icon.png';

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
  showLabel: boolean;
}

/** 伺服器導航項目 */
function ServerNavItem({ server, isSelected, onSelect, isCollapsed, showLabel }: ServerNavItemProps) {
  const { t } = useTranslation();
  const isRunning = server.status === 'running';
  const statusLabel = isRunning ? t('server.running') : t('server.stopped');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  const content = (
    <button
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full items-center rounded-xl border transition-all duration-200 focus-ring',
        'border-transparent hover:border-border/80 hover:bg-accent/40',
        isSelected && 'border-border bg-accent/60 text-accent-foreground shadow-sm',
        isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-3 text-left'
      )}
      role="menuitem"
      aria-selected={isSelected}
      aria-label={`${server.name} - ${statusLabel}`}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80'
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'rounded-full transition-all duration-300',
            isRunning ? 'h-2.5 w-2.5 bg-green-500 status-glow-running' : 'h-2.5 w-2.5 bg-muted-foreground'
          )}
        />
      </div>
      {showLabel && (
        <>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{server.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{statusLabel}</p>
          </div>
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full transition-opacity',
              isSelected ? 'bg-primary opacity-100' : 'bg-border opacity-0 group-hover:opacity-100'
            )}
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', isRunning ? 'bg-green-500' : 'bg-muted-foreground')} aria-hidden="true" />
          {server.name}
          <span className="text-muted-foreground">({statusLabel})</span>
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
  isCompact,
  isActive,
  showLabel,
  shortcut,
}: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  isCompact: boolean;
  isActive?: boolean;
  showLabel: boolean;
  shortcut?: string;
}) {
  const content = (
    <Button
      variant="ghost"
      size={isCompact ? 'icon' : 'default'}
      className={cn(
        'border transition-all duration-200 ease-out focus-ring',
        isCompact ? 'mx-auto h-10 w-10 rounded-xl border-transparent' : 'h-10 w-full justify-start rounded-xl border-transparent px-3',
        isActive ? 'border-border bg-accent/60 text-foreground shadow-sm' : 'hover:border-border/80 hover:bg-accent/30'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {showLabel && <span className="ml-2.5 flex-1 truncate whitespace-nowrap text-left">{label}</span>}
    </Button>
  );

  if (isCompact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {shortcut && <kbd className="text-[10px] bg-muted px-1 py-0.5 rounded">{shortcut}</kbd>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface SidebarProps {
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onGoHome?: () => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  currentView?: 'servers' | 'server-settings' | 'settings' | 'about';
}

export function Sidebar({
  servers = [],
  selectedServerId,
  onSelectServer,
  onGoHome,
  onCreateServer,
  onOpenSettings,
  onOpenAbout,
  currentView = 'servers',
}: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showExpandedSections, setShowExpandedSections] = useState(true);

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

  const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), []);

  useEffect(() => {
    if (isCollapsed) {
      setShowLabels(false);
      const timeoutId = window.setTimeout(() => setShowExpandedSections(false), 170);
      return () => window.clearTimeout(timeoutId);
    }

    setShowExpandedSections(true);
    setShowLabels(true);
  }, [isCollapsed]);

  const sidebarWidthClass = isCollapsed ? 'w-[88px]' : 'w-[296px]';
  const shellPaddingClass = isCollapsed ? 'p-2' : 'p-3';
  const panelPaddingClass = isCollapsed ? 'p-2' : 'p-3';
  const labelVisibilityClass = isCollapsed
    ? 'pointer-events-none opacity-0 translate-y-1'
    : 'opacity-100 translate-y-0';
  const brandTextClass = showExpandedSections
    ? 'max-w-[160px] opacity-100 translate-x-0'
    : 'pointer-events-none max-w-0 opacity-0 -translate-x-2';
  const sectionVisibilityClass = showExpandedSections
    ? 'max-h-40 opacity-100 translate-y-0'
    : 'pointer-events-none max-h-0 opacity-0 -translate-y-2';
  const badgeVisibilityClass = showExpandedSections
    ? 'scale-100 opacity-100'
    : 'pointer-events-none scale-95 opacity-0';
  const compactActions = isCollapsed && !showExpandedSections;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + B 切換側邊欄
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
      // Ctrl/Cmd + N 新增伺服器
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        onCreateServer?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse, onCreateServer]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-background/96 shrink-0',
          'transition-[width] duration-300 ease-out',
          sidebarWidthClass
        )}
        role="navigation"
        aria-label={t('sidebar.navigation', '主要導航')}
      >
        <div className={cn('flex h-full flex-col transition-[padding] duration-300 ease-out', shellPaddingClass)}>
          <div
            className={cn(
              'rounded-2xl border border-border/60 bg-card/70 transition-[padding,border-radius] duration-300 ease-out',
              panelPaddingClass
            )}
          >
            <div className={cn('overflow-hidden', isCollapsed ? 'space-y-2' : 'space-y-3')}>
              <div
                className={cn(
                  'gap-3',
                  isCollapsed
                    ? 'flex flex-col items-center justify-center'
                    : 'flex items-start justify-between'
                )}
              >
                <button
                  type="button"
                  onClick={onGoHome}
                  className={cn(
                    'overflow-hidden rounded-xl transition-colors focus-ring',
                    'hover:bg-accent/30',
                    isCollapsed
                      ? 'flex w-full flex-col items-center justify-center p-1'
                      : 'flex min-w-0 flex-1 items-center gap-3 p-1.5 text-left'
                  )}
                  aria-label="Go to home"
                >
                  <img
                    src={appIcon}
                    alt="Lumix"
                    className={cn(
                      'shrink-0 self-start border border-border/60 object-cover shadow-sm transition-all duration-300 ease-out',
                      isCollapsed
                        ? 'h-11 w-11 min-h-[44px] min-w-[44px] self-center rounded-2xl'
                        : 'h-11 w-11 min-h-[44px] min-w-[44px] rounded-2xl'
                    )}
                  />
                  <div className={cn('min-w-0 overflow-hidden transition-all duration-200 ease-out', brandTextClass)}>
                    <p className="truncate text-base font-semibold tracking-tight">Lumix</p>
                    <p className="truncate text-xs text-muted-foreground">{t('about.description')}</p>
                  </div>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'shrink-0 rounded-xl border border-transparent hover:border-border/80',
                        isCollapsed ? 'h-10 w-10' : 'h-9 w-9'
                      )}
                      onClick={toggleCollapse}
                      aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? (
                      <PanelLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    {isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                    <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">Ctrl+B</kbd>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div
                className={cn(
                  'overflow-hidden transition-all duration-200 ease-out',
                  sectionVisibilityClass
                )}
                aria-hidden={!showExpandedSections}
              >
                <div
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-3 transition-all duration-200 ease-out',
                    currentView === 'servers' && !selectedServerId
                      ? 'border-border bg-accent/50'
                      : 'border-border/60 bg-card/50'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80">
                      <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <div className={cn('min-w-0 overflow-hidden transition-all duration-150 ease-out', labelVisibilityClass)}>
                      <p className="truncate text-sm font-medium">{t('header.title')}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{t('dashboard.description')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={cn('pt-3', isCollapsed ? 'space-y-2' : 'space-y-3')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onCreateServer}
                  className={cn(
                    'w-full rounded-xl focus-ring transition-[padding] duration-300 ease-out',
                    isCollapsed ? 'h-11 px-0' : 'h-11 justify-start px-4'
                  )}
                  aria-label={t('sidebar.addServer')}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {showLabels && (
                    <span className={cn('overflow-hidden whitespace-nowrap transition-all duration-150 ease-out', labelVisibilityClass)}>
                      {t('sidebar.addServer')}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="flex items-center gap-2">
                  {t('sidebar.addServer')}
                  <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">Ctrl+N</kbd>
                </TooltipContent>
              )}
            </Tooltip>

          </div>

          <div className="min-h-0 flex-1 pt-3">
            <div
              className={cn(
                'flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-card/50 transition-[padding,border-radius] duration-300 ease-out',
                panelPaddingClass
              )}
            >
              <div
                className={cn(
                  'mb-3 flex items-center',
                  isCollapsed ? 'justify-center' : 'justify-between'
                )}
              >
                {showExpandedSections ? (
                  <div className={cn('overflow-hidden transition-all duration-150 ease-out', labelVisibilityClass)}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t('sidebar.servers')}
                    </p>
                  </div>
                ) : (
                  <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                    {servers.length}
                  </Badge>
                )}
                {showExpandedSections && (
                  <Badge variant="secondary" className={cn('shrink-0 transition-all duration-150 ease-out', badgeVisibilityClass)}>
                    {servers.length}
                  </Badge>
                )}
              </div>

              <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" role="menu" aria-label={t('sidebar.servers')}>
                {servers.map((server) => (
                  <ServerNavItem
                    key={server.id}
                    server={server}
                    isSelected={selectedServerId === server.id && (currentView === 'servers' || currentView === 'server-settings')}
                    onSelect={() => onSelectServer?.(server.id)}
                    isCollapsed={isCollapsed}
                    showLabel={showLabels}
                  />
                ))}

                {servers.length === 0 && showLabels && (
                  <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-6 text-center">
                    <p className="text-sm font-medium">{t('welcome.title')}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('welcome.description')}</p>
                  </div>
                )}
              </nav>
            </div>
          </div>

          <div
            className="pt-3"
            role="group"
            aria-label={t('sidebar.actions', '功能選單')}
          >
            <div
              className={cn(
                'rounded-2xl border border-border/60 bg-card/50 transition-[padding,border-radius] duration-300 ease-out',
                isCollapsed ? 'space-y-2 p-2 text-center' : 'space-y-2 p-3'
              )}
            >
              <SidebarButton
                icon={Settings}
                label={t('sidebar.settings')}
                onClick={onOpenSettings}
                isCompact={compactActions}
                isActive={currentView === 'settings'}
                showLabel={showLabels}
                shortcut="Ctrl+,"
              />
              <SidebarButton
                icon={Info}
                label={t('sidebar.about')}
                onClick={onOpenAbout}
                isCompact={compactActions}
                isActive={currentView === 'about'}
                showLabel={showLabels}
              />
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
