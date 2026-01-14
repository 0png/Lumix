/**
 * MainLayout 元件 - 主要佈局容器
 * 支援響應式設計：動態適應全螢幕和小視窗 (1000x600)
 */

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
}

export function MainLayout({
  children,
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onOpenSettings,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        selectedServerId={selectedServerId}
        onSelectServer={onSelectServer}
        onCreateServer={onCreateServer}
        onOpenSettings={onOpenSettings}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-3 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
