/**
 * MainLayout 元件 - 主要佈局容器
 * 支援響應式設計：動態適應全螢幕和小視窗 (1000x650)
 */

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ServerItem {
  id: string;
  name: string;
  status: 'stopped' | 'running';
}

interface MainLayoutProps {
  children: ReactNode;
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  currentView?: 'servers' | 'settings' | 'about';
}

export function MainLayout({
  children,
  servers = [],
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
  onOpenAbout,
  currentView = 'servers',
}: MainLayoutProps) {
  const { t } = useTranslation();

  const getTitle = () => {
    switch (currentView) {
      case 'servers':
        return t('sidebar.servers');
      case 'settings':
        return t('settings.title');
      case 'about':
        return t('about.title');
      default:
        return '';
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={onSelectServer}
        onCreateServer={onCreateServer}
        onOpenSettings={onOpenSettings}
        onOpenAbout={onOpenAbout}
        currentView={currentView}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* 標題區域 - 與 Sidebar Logo 區域對齊 */}
        <header className="h-12 border-b border-border/50 flex items-center px-4 lg:px-6 shrink-0">
          <h2 className="text-lg font-semibold truncate">{getTitle()}</h2>
        </header>
        <ScrollArea className="flex-1">
          <main className="p-4 lg:p-6">
            {children}
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
