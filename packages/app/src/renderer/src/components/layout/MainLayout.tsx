/**
 * MainLayout 元件 - 主要佈局容器
 * 支援響應式設計：動態適應全螢幕和小視窗 (1000x650)
 */

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MainLayoutProps {
  children: ReactNode;
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
}

export function MainLayout({
  children,
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
  onOpenAbout,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        selectedServerId={selectedServerId}
        onSelectServer={onSelectServer}
        onCreateServer={onCreateServer}
        onOpenSettings={onOpenSettings}
        onOpenAbout={onOpenAbout}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <ScrollArea className="flex-1">
          <main className="p-4 lg:p-6">
            {children}
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
