/**
 * ServerList 元件 - 伺服器列表
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計、骨架屏載入、交錯動畫
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Server,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { ServerCard } from './ServerCard';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';
export type CoreType = 'vanilla' | 'paper' | 'spigot' | 'fabric' | 'forge';
export type ServerOrigin = 'managed' | 'imported';

export interface ServerInstance {
  id: string;
  name: string;
  origin: ServerOrigin;
  coreType: CoreType;
  mcVersion: string;
  javaPath?: string;
  status: ServerStatus;
  ramMax: number;
  isReady?: boolean;
  hasServerProperties?: boolean;
  backupSettings?: import('../../../../shared/ipc-types').BackupSettings;
  onboardingState?: import('../../../../shared/ipc-types').OnboardingState;
}

interface ServerListProps {
  servers: ServerInstance[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onStartServer?: (id: string) => void;
  onStopServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  javaInstallationsCount?: number;
  /** 是否正在載入 */
  loading?: boolean;
  /** 各伺服器的下載進度 */
  downloadProgress?: Map<string, number>;
}

/**
 * 空狀態元件 - 帶動畫效果和引導
 */
function EmptyState({
  onCreateServer,
  onOpenSettings,
}: {
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation();

  const steps = [
    t('dashboard.emptySteps.version'),
    t('dashboard.emptySteps.runtime'),
    t('dashboard.emptySteps.launch'),
  ];

  return (
    <div
      className="flex-1 rounded-xl border border-dashed border-muted-foreground/25 bg-gradient-subtle animate-fade-in"
      role="region"
      aria-label={t('welcome.title')}
    >
      <div className="grid min-h-[calc(100vh-8rem)] items-center gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="space-y-6">
          <div className="relative w-fit">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 shadow-lg shadow-primary/5">
              <Server className="h-10 w-10 text-primary/70" aria-hidden="true" />
            </div>
            <div className="absolute -right-1 -top-1 rounded-full bg-primary/20 p-1.5 animate-pulse">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
          </div>

          <div className="max-w-xl space-y-2">
            <Badge variant="secondary">{t('dashboard.emptyBadge')}</Badge>
            <h2 className="text-2xl font-semibold tracking-tight">{t('welcome.title')}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{t('dashboard.emptyDescription')}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={onCreateServer} className="gap-2 ripple" aria-label={t('sidebar.addServer')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('sidebar.addServer')}
            </Button>
            <Button variant="outline" onClick={onOpenSettings} className="gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t('settings.title')}
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/70 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <p className="text-sm font-medium">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 伺服器列表元件
 */
export function ServerList({
  servers,
  selectedServerId,
  onSelectServer,
  onStartServer,
  onStopServer,
  onCreateServer,
  onOpenSettings,
  loading = false,
  downloadProgress,
}: ServerListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredServers = useMemo(() => {
    if (!normalizedQuery) return servers;

    return servers.filter((server) => (
      server.name.toLocaleLowerCase().includes(normalizedQuery)
      || server.mcVersion.toLocaleLowerCase().includes(normalizedQuery)
      || server.coreType.toLocaleLowerCase().includes(normalizedQuery)
    ));
  }, [normalizedQuery, servers]);

  // 載入中顯示骨架屏
  if (loading) {
    return <ListSkeleton count={3} />;
  }

  // 空狀態
  if (servers.length === 0) {
    return <EmptyState onCreateServer={onCreateServer} onOpenSettings={onOpenSettings} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{t('header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={onOpenSettings} className="gap-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            {t('settings.title')}
          </Button>
          <Button onClick={onCreateServer} className="gap-2 ripple">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('sidebar.addServer')}
          </Button>
        </div>
      </div>

      <div className="group relative w-full">
        <Search
          className={cn(
            'pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-150 motion-reduce:transition-none',
            isSearchFocused && 'text-primary'
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          aria-hidden="true"
        />
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-[calc(100%-6rem)] -translate-x-1/2 -translate-y-1/2 truncate text-sm text-muted-foreground transition-[transform,opacity] duration-150 motion-reduce:transition-none',
            isSearchFocused && '-translate-x-[calc(50%+12px)] opacity-0'
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          aria-hidden="true"
        >
          {searchQuery || t('dashboard.searchPlaceholder')}
        </span>
        <Input
          type="text"
          role="searchbox"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder={t('dashboard.searchPlaceholder')}
          aria-label={t('dashboard.searchLabel')}
          className={cn(
            'h-11 rounded-xl border-border/60 bg-card/50 px-11 text-left shadow-sm transition-[background-color,border-color,box-shadow,color] duration-150 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 motion-reduce:transition-none',
            isSearchFocused
              ? 'text-foreground placeholder:text-muted-foreground'
              : 'text-transparent caret-transparent placeholder:text-transparent'
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        {searchQuery ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            aria-label={t('dashboard.clearSearch')}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div
        className={cn('grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}
        role="list"
        aria-label={t('dashboard.serverList')}
      >
        {filteredServers.map((server, index) => (
          <div
            key={server.id}
            className="animate-fade-in-up"
            style={{
              animationDelay: `${index * 50}ms`,
              animationFillMode: 'backwards',
            }}
            role="listitem"
          >
            <ServerCard
              server={server}
              isSelected={selectedServerId === server.id}
              onSelect={() => onSelectServer?.(server.id)}
              onStart={() => onStartServer?.(server.id)}
              onStop={() => onStopServer?.(server.id)}
              downloadProgress={downloadProgress?.get(server.id)}
            />
          </div>
        ))}

        {filteredServers.length === 0 ? (
          <div className="col-span-full flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 text-center animate-fade-in">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground shadow-sm">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-semibold">{t('dashboard.noSearchResults')}</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t('dashboard.noSearchResultsDescription', { query: searchQuery.trim() })}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery('')}>
              {t('dashboard.clearSearch')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
