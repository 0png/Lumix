/**
 * Sidebar 元件 - 側邊欄導航
 * 重新組織品牌、主操作與伺服器導覽層級，維持既有配色系統
 */

import { Plus, Settings, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
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
}

/** 伺服器導航項目 */
function ServerNavItem({ server, isSelected, onSelect, isCollapsed }: ServerNavItemProps) {
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
        'group flex items-center rounded-xl border transition-[border-color,background-color,color,box-shadow] duration-200 focus-ring motion-reduce:transition-none',
        'border-transparent hover:border-border/80 hover:bg-accent/40',
        isSelected && 'border-border bg-accent/60 text-accent-foreground shadow-sm',
        isCollapsed
          ? 'mx-auto w-12 justify-center px-0 py-2.5'
          : 'w-full gap-3 px-3 py-3 text-left'
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
            'rounded-full transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none',
            isRunning ? 'h-2.5 w-2.5 bg-green-500 status-glow-running' : 'h-2.5 w-2.5 bg-muted-foreground'
          )}
        />
      </div>
      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          isCollapsed
            ? 'pointer-events-none max-w-0 -translate-x-2 opacity-0'
            : 'max-w-[180px] translate-x-0 opacity-100'
        )}
      >
        <p className="truncate text-sm font-medium">{server.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{statusLabel}</p>
      </div>
      {!isCollapsed && (
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full transition-opacity duration-200 motion-reduce:transition-none',
            isSelected ? 'bg-primary opacity-100' : 'bg-border opacity-0 group-hover:opacity-100'
          )}
          aria-hidden="true"
        />
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
  isCollapsed,
  isActive,
  shortcut,
}: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  isCollapsed: boolean;
  isActive?: boolean;
  shortcut?: string;
}) {
  const content = (
    <Button
      variant="ghost"
      size="default"
      className={cn(
        'relative h-10 w-full overflow-hidden rounded-xl border border-transparent p-0',
        'transition-[border-color,background-color,color,box-shadow] duration-200 ease-out focus-ring motion-reduce:transition-none',
        isActive ? 'border-border bg-accent/60 text-foreground shadow-sm' : 'hover:border-border/80 hover:bg-accent/30'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon
        className={cn(
          'absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2',
          'transition-transform duration-300 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
          isCollapsed ? 'translate-x-2' : 'translate-x-0'
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'pointer-events-none absolute inset-y-0 left-10 right-3 flex items-center overflow-hidden truncate whitespace-nowrap text-left',
          'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          isCollapsed
            ? '-translate-x-2 opacity-0'
            : 'translate-x-0 opacity-100'
        )}
      >
        {label}
      </span>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {shortcut && <kbd className="text-[10px] bg-muted px-1 py-0.5 rounded">{shortcut}</kbd>}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onGoHome?: () => void;
  onCreateServer?: (source?: 'pointer' | 'keyboard') => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  currentView?: 'servers' | 'server-settings' | 'settings' | 'about';
}

export function Sidebar({
  isCollapsed,
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

  const sidebarWidthClass = isCollapsed ? 'w-[88px]' : 'w-[296px]';
  const shellPaddingClass = isCollapsed ? 'p-2' : 'p-3';
  const panelPaddingClass = isCollapsed ? 'p-2' : 'p-3';
  const labelVisibilityClass = isCollapsed
    ? 'pointer-events-none max-w-0 -translate-x-2 opacity-0'
    : 'max-w-[180px] translate-x-0 opacity-100';
  const brandTextClass = isCollapsed
    ? 'pointer-events-none max-w-0 -translate-x-2 opacity-0'
    : 'max-w-[160px] translate-x-0 opacity-100';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N 新增伺服器
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        onCreateServer?.('keyboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateServer]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative flex h-full shrink-0 flex-col border-r bg-background/96',
          'transition-[width] duration-300 ease-out motion-reduce:transition-none',
          sidebarWidthClass
        )}
        data-collapsed={isCollapsed}
        role="navigation"
        aria-label={t('sidebar.navigation', '主要導航')}
      >
        <div className={cn('flex h-full flex-col transition-[padding] duration-300 ease-out motion-reduce:transition-none', shellPaddingClass)}>
          <div
            className={cn(
              'rounded-2xl border border-border/60 bg-card/70 transition-[padding,border-radius] duration-300 ease-out motion-reduce:transition-none',
              panelPaddingClass
            )}
          >
            <div className="overflow-hidden">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={onGoHome}
                  className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-xl p-1.5 text-left transition-colors hover:bg-accent/30 focus-ring motion-reduce:transition-none"
                  aria-label="Go to home"
                >
                  <img
                    src={appIcon}
                    alt="Lumix"
                    className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-2xl border border-border/60 object-cover shadow-sm"
                  />
                  <div className={cn('min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-150 ease-out motion-reduce:transition-none', brandTextClass)}>
                    <p className="truncate text-lg font-semibold tracking-tight">Lumix</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className={cn('pt-3', isCollapsed ? 'space-y-2' : 'space-y-3')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onCreateServer?.('pointer')}
                  className={cn(
                    'w-full rounded-xl focus-ring transition-[padding] duration-300 ease-out',
                    isCollapsed ? 'h-11 gap-0 px-0' : 'h-11 justify-start gap-2 px-4'
                  )}
                  aria-label={t('sidebar.addServer')}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={cn('overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none', labelVisibilityClass)}>
                    {t('sidebar.addServer')}
                  </span>
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
                {!isCollapsed ? (
                  <div className={cn('overflow-hidden transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none', labelVisibilityClass)}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t('sidebar.servers')}
                    </p>
                  </div>
                ) : (
                  <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                    {servers.length}
                  </Badge>
                )}
                {!isCollapsed && (
                  <Badge variant="secondary" className="shrink-0">
                    {servers.length}
                  </Badge>
                )}
              </div>

              <nav
                className={cn(
                  'sidebar-server-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1',
                  isCollapsed && 'sidebar-server-scroll-collapsed items-center pr-0'
                )}
                role="menu"
                aria-label={t('sidebar.servers')}
              >
                {servers.map((server) => (
                  <ServerNavItem
                    key={server.id}
                    server={server}
                    isSelected={selectedServerId === server.id && (currentView === 'servers' || currentView === 'server-settings')}
                    onSelect={() => onSelectServer?.(server.id)}
                    isCollapsed={isCollapsed}
                  />
                ))}

                {servers.length === 0 && !isCollapsed && (
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
                'overflow-hidden rounded-2xl border border-border/60 bg-card/50 transition-[padding,border-radius] duration-300 ease-out motion-reduce:transition-none',
                isCollapsed ? 'space-y-2 p-2 text-center' : 'space-y-2 p-3'
              )}
            >
              <SidebarButton
                icon={Settings}
                label={t('sidebar.settings')}
                onClick={onOpenSettings}
                isCollapsed={isCollapsed}
                isActive={currentView === 'settings'}
                shortcut="Ctrl+,"
              />
              <SidebarButton
                icon={Info}
                label={t('sidebar.about')}
                onClick={onOpenAbout}
                isCollapsed={isCollapsed}
                isActive={currentView === 'about'}
              />
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
