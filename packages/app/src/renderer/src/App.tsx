import { useState, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layout';
import { ThemeProvider, LanguageProvider } from '@/contexts';
import {
  ServerList,
  ServerDetail,
  ServerConsole,
  CreateServerDialog,
  type ServerInstance,
  type LogEntry,
  type CreateServerData,
} from '@/components/server';
import { SettingsView, AboutView } from '@/components/settings';
import { useServers } from '@/hooks/use-servers';
import { toast } from '@/lib/toast';
import '@/i18n';

type ViewType = 'servers' | 'settings' | 'about';

/**
 * 轉換 DTO 為前端 ServerInstance 格式
 */
function toServerInstance(dto: {
  id: string;
  name: string;
  coreType: string;
  mcVersion: string;
  status: string;
  ramMax: number;
}): ServerInstance {
  return {
    id: dto.id,
    name: dto.name,
    coreType: dto.coreType as ServerInstance['coreType'],
    mcVersion: dto.mcVersion,
    status: dto.status as ServerInstance['status'],
    ramMax: dto.ramMax,
  };
}

function AppContent() {
  const {
    servers: serverDtos,
    loading,
    logs: serverLogs,
    createServer,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
  } = useServers();

  const [selectedServerId, setSelectedServerId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('servers');
  const [isCreating, setIsCreating] = useState(false);

  // 轉換 DTO 為前端格式
  const servers = serverDtos.map(toServerInstance);
  const selectedServer = servers.find((s) => s.id === selectedServerId);

  // 取得選中伺服器的日誌
  const currentLogs: LogEntry[] = selectedServerId
    ? (serverLogs.get(selectedServerId) || []).map((log, index) => ({
        id: `${selectedServerId}-${index}`,
        timestamp: new Date(log.timestamp),
        level: log.level as LogEntry['level'],
        message: log.message,
      }))
    : [];

  const handleCreateServer = useCallback(async (data: CreateServerData) => {
    setIsCreating(true);
    try {
      // 1. 建立伺服器實例
      const result = await createServer({
        name: data.name,
        coreType: data.coreType,
        mcVersion: data.mcVersion,
        ramMin: data.ramMin,
        ramMax: data.ramMax,
      });

      if (result) {
        // 2. 下載伺服器 JAR（背景執行）
        toast.info('toast.downloadingServer');
        window.electronAPI.download.downloadServer({
          coreType: data.coreType,
          mcVersion: data.mcVersion,
          targetDir: result.directory,
        }).then((downloadResult) => {
          if (downloadResult.success) {
            toast.success('toast.serverReady');
          } else {
            toast.error('toast.downloadFailed');
          }
        });

        toast.success('toast.serverCreated');
      }
    } finally {
      setIsCreating(false);
    }
  }, [createServer]);

  const handleStartServer = useCallback(async (id: string) => {
    const success = await startServer(id);
    if (success) {
      toast.success('toast.serverStarted');
    } else {
      toast.error('toast.startFailed');
    }
  }, [startServer]);

  const handleStopServer = useCallback(async (id: string) => {
    const success = await stopServer(id);
    if (success) {
      toast.success('toast.serverStopped');
    } else {
      toast.error('toast.stopFailed');
    }
  }, [stopServer]);

  const handleDeleteServer = useCallback(async (id: string) => {
    const success = await deleteServer(id);
    if (success) {
      setSelectedServerId(undefined);
      toast.success('toast.serverDeleted');
    } else {
      toast.error('toast.deleteFailed');
    }
  }, [deleteServer]);

  const handleUpdateServer = useCallback(async (updates: Partial<ServerInstance>) => {
    if (!selectedServerId) return;
    const result = await updateServer({ id: selectedServerId, ...updates });
    if (result) {
      toast.success('toast.settingsSaved');
    }
  }, [selectedServerId, updateServer]);

  const handleSelectServer = useCallback((id: string) => {
    setSelectedServerId(id);
    setCurrentView('servers');
  }, []);

  const handleBackToServers = useCallback(() => {
    setCurrentView('servers');
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      );
    }

    switch (currentView) {
      case 'settings':
        return <SettingsView onBack={handleBackToServers} />;
      case 'about':
        return <AboutView onBack={handleBackToServers} />;
      default:
        return (
          <div className="h-full">
            {selectedServer ? (
              <div className="space-y-6">
                <ServerDetail
                  server={selectedServer}
                  onBack={() => setSelectedServerId(undefined)}
                  onStart={() => handleStartServer(selectedServer.id)}
                  onStop={() => handleStopServer(selectedServer.id)}
                  onDelete={() => handleDeleteServer(selectedServer.id)}
                  onUpdate={handleUpdateServer}
                />
                {selectedServer.status === 'running' && (
                  <ServerConsole logs={currentLogs} onClear={() => {}} />
                )}
              </div>
            ) : (
              <ServerList
                servers={servers}
                selectedServerId={selectedServerId}
                onSelectServer={handleSelectServer}
                onStartServer={handleStartServer}
                onStopServer={handleStopServer}
              />
            )}
          </div>
        );
    }
  };

  return (
    <MainLayout
      onCreateServer={() => setShowCreateDialog(true)}
      onOpenSettings={() => setCurrentView('settings')}
      onOpenAbout={() => setCurrentView('about')}
      selectedServerId={selectedServerId}
      onSelectServer={handleSelectServer}
      currentView={currentView}
    >
      {renderContent()}

      <CreateServerDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateServer}
        disabled={isCreating}
      />

      <Toaster position="bottom-right" richColors />
    </MainLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
