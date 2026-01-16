/**
 * ServerList 元件 - 伺服器列表
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計、骨架屏載入、交錯動畫
 */

import { useTranslation } from 'react-i18next';
import { Server, Plus, Sparkles } from 'lucide-react';
import { ServerCard } from './ServerCard';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';
export type CoreType = 'vanilla' | 'paper' | 'fabric' | 'forge';

export interface ServerInstance {
  id: string;
  name: string;
  coreType: CoreType;
  mcVersion: string;
  status: ServerStatus;
  ramMax: number;
  isReady?: boolean;
}

interface ServerListProps {
  servers: ServerInstance[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onStartServer?: (id: string) => void;
  onStopServer?: (id: string) => void;
  onCreateServer?: () => void;
  /** 是否正在載入 */
  loading?: boolean;
  /** 各伺服器的下載進度 */
  downloadProgress?: Map<string, number>;
}

/**
 * 空狀態元件 - 帶動畫效果和引導
 */
function EmptyState({ onCreateServer }: { onCreateServer?: () => void }) {
  const { t } = useTranslation();

  return (
    <div 
      className="flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center border-muted-foreground/25 bg-gradient-subtle min-h-[280px] animate-fade-in"
      role="region"
      aria-label={t('welcome.title')}
    >
      <div className="text-center p-6 lg:p-8 max-w-md">
        {/* 圖示區域 */}
        <div className="relative mx-auto mb-6">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 w-20 h-20 mx-auto flex items-center justify-center shadow-lg shadow-primary/5 border border-primary/10">
            <Server className="h-10 w-10 text-primary/70" aria-hidden="true" />
          </div>
          <div className="absolute -top-1 -right-1 rounded-full bg-primary/20 p-1.5 animate-pulse">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
        </div>

        {/* 文字區域 */}
        <h3 className="text-lg lg:text-xl font-semibold mb-2">{t('welcome.title')}</h3>
        <p className="text-sm lg:text-base text-muted-foreground mb-6 leading-relaxed">
          {t('welcome.description')}
        </p>

        {/* CTA 按鈕 */}
        <Button 
          onClick={onCreateServer}
          className="gap-2 ripple"
          aria-label={t('sidebar.addServer')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('sidebar.addServer')}
        </Button>
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
  loading = false,
  downloadProgress,
}: ServerListProps) {
  // 載入中顯示骨架屏
  if (loading) {
    return <ListSkeleton count={3} />;
  }

  // 空狀態
  if (servers.length === 0) {
    return <EmptyState onCreateServer={onCreateServer} />;
  }

  return (
    <div 
      className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
      role="list"
      aria-label="伺服器列表"
    >
      {servers.map((server, index) => (
        <div
          key={server.id}
          className="animate-fade-in-up"
          style={{ 
            animationDelay: `${index * 50}ms`, 
            animationFillMode: 'backwards' 
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
  );
}
