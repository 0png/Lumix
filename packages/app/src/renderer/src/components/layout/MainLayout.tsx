/**
 * MainLayout 元件 - 主要佈局容器
 * 支援響應式設計：動態適應全螢幕和小視窗 (1000x650)
 */

import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ServerItem {
  id: string;
  name: string;
  status: 'stopped' | 'running';
}

interface MainLayoutProps {
  children: ReactNode;
  overlay?: ReactNode;
  servers?: ServerItem[];
  selectedServerId?: string;
  onSelectServer?: (id: string) => void;
  onGoHome?: () => void;
  onCreateServer?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  currentView?: 'servers' | 'server-settings' | 'settings' | 'about';
}

export function MainLayout({
  children,
  overlay,
  servers = [],
  selectedServerId,
  onSelectServer,
  onGoHome,
  onCreateServer,
  onOpenSettings,
  onOpenAbout,
  currentView = 'servers',
}: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 1024);
  const contentViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const collapseAtCompactWidth = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };

    collapseAtCompactWidth();
    window.addEventListener('resize', collapseAtCompactWidth);
    return () => window.removeEventListener('resize', collapseAtCompactWidth);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(previous => !previous);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // 各主視圖共用同一個 ScrollArea。切頁前重設位置，避免沿用長頁面的
  // scrollTop 後，新頁面停在內容之外而呈現空白畫面。
  useLayoutEffect(() => {
    contentViewportRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentView, selectedServerId]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={onSelectServer}
        onGoHome={onGoHome}
        onCreateServer={onCreateServer}
        onOpenSettings={onOpenSettings}
        onOpenAbout={onOpenAbout}
        currentView={currentView}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TitleBar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full" viewportRef={contentViewportRef}>
            <main className="p-4 lg:p-6">
              {children}
            </main>
          </ScrollArea>
          {overlay ? (
            <div className="absolute inset-0 z-40 bg-background">
              {overlay}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
