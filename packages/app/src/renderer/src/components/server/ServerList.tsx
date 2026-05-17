/**
 * ServerList 元件 - 伺服器列表
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計、骨架屏載入、交錯動畫
 */

import { useTranslation } from 'react-i18next';
import {
  Plus,
  FolderInput,
  Server,
  Settings,
  Sparkles,
} from 'lucide-react';
import { ServerCard } from './ServerCard';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  onImportServer?: () => void;
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
  onImportServer,
  onOpenSettings,
}: {
  onCreateServer?: () => void;
  onImportServer?: () => void;
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onCreateServer} className="gap-2 ripple" aria-label={t('sidebar.addServer')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('sidebar.addServer')}
            </Button>
            <Button variant="outline" onClick={onImportServer} className="gap-2">
              <FolderInput className="h-4 w-4" aria-hidden="true" />
              {t('serverImport.importServer')}
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
  onImportServer,
  onOpenSettings,
  loading = false,
  downloadProgress,
}: ServerListProps) {
  const { t } = useTranslation();

  // 載入中顯示骨架屏
  if (loading) {
    return <ListSkeleton count={3} />;
  }

  // 空狀態
  if (servers.length === 0) {
    return <EmptyState onCreateServer={onCreateServer} onImportServer={onImportServer} onOpenSettings={onOpenSettings} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{t('header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onOpenSettings} className="gap-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            {t('settings.title')}
          </Button>
          <Button variant="outline" onClick={onImportServer} className="gap-2">
            <FolderInput className="h-4 w-4" aria-hidden="true" />
            {t('serverImport.importServer')}
          </Button>
          <Button onClick={onCreateServer} className="gap-2 ripple">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('sidebar.addServer')}
          </Button>
        </div>
      </div>

      <div
        className={cn('grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}
        role="list"
        aria-label={t('dashboard.serverList')}
      >
        {servers.map((server, index) => (
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
      </div>
    </div>
  );
}
