import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  isReady?: boolean;
}): ServerInstance {
  return {
    id: dto.id,
    name: dto.name,
    coreType: dto.coreType as ServerInstance['coreType'],
    mcVersion: dto.mcVersion,
    status: dto.status as ServerInstance['status'],
    ramMax: dto.ramMax,
    isReady: dto.isReady,
  };
}

function AppContent() {
  const { t } = useTranslation();
  const {
    servers: serverDtos,
    loading,
    error,
    logs: serverLogs,
    createServer,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
    sendCommand,
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
      // 1. 先偵測系統 Java
      const javaResult = await window.electronAPI.java.detect();
      if (!javaResult.success || !javaResult.data || javaResult.data.length === 0) {
        toast.error(t('toast.noJavaFound'));
        return { code: 'JAVA_NOT_FOUND' as const, message: t('toast.noJavaFound') };
      }

      // 2. 選擇適合此 MC 版本的 Java
      const selectResult = await window.electronAPI.java.selectForMc(data.mcVersion);
      if (!selectResult.success || !selectResult.data) {
        toast.error(t('toast.noCompatibleJava'));
        return { code: 'JAVA_NOT_FOUND' as const, message: t('toast.noCompatibleJava') };
      }

      const selectedJava = selectResult.data;

      // 3. 顯示下載中提示
      toast.info(t('toast.downloadingServer'));

      // 4. 建立伺服器實例（包含下載 server.jar）
      const { server, error: createError } = await createServer({
        name: data.name,
        coreType: data.coreType,
        mcVersion: data.mcVersion,
        ramMin: data.ramMin,
        ramMax: data.ramMax,
        javaPath: selectedJava.path,
      });

      if (createError) {
        // 回傳錯誤讓 Dialog 處理
        return createError;
      }

      if (server) {
        toast.success(t('toast.serverReady'));
      }
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [createServer, t]);

  const handleStartServer = useCallback(async (id: string) => {
    // 檢查伺服器是否有 Java 路徑，如果沒有則嘗試自動設定
    const serverDto = serverDtos.find(s => s.id === id);
    if (serverDto && !serverDto.javaPath) {
      // 嘗試自動偵測並設定 Java
      const javaResult = await window.electronAPI.java.detect();
      if (!javaResult.success || !javaResult.data || javaResult.data.length === 0) {
        toast.error(t('toast.noJavaFound'));
        return;
      }

      const selectResult = await window.electronAPI.java.selectForMc(serverDto.mcVersion);
      if (!selectResult.success || !selectResult.data) {
        toast.error(t('toast.noCompatibleJava'));
        return;
      }

      // 更新伺服器的 Java 路徑
      await updateServer({ id, javaPath: selectResult.data.path });
    }

    const success = await startServer(id);
    if (success) {
      toast.success(t('toast.serverStarted'));
    } else {
      toast.error(t('toast.startFailed'), error || undefined);
    }
  }, [startServer, t, error, serverDtos, updateServer]);

  const handleStopServer = useCallback(async (id: string) => {
    const success = await stopServer(id);
    if (success) {
      toast.success(t('toast.serverStopped'));
    } else {
      toast.error(t('toast.stopFailed'));
    }
  }, [stopServer, t]);

  const handleDeleteServer = useCallback(async (id: string) => {
    const success = await deleteServer(id);
    if (success) {
      setSelectedServerId(undefined);
      toast.success(t('toast.serverDeleted'));
    } else {
      toast.error(t('toast.deleteFailed'));
    }
  }, [deleteServer, t]);

  const handleUpdateServer = useCallback(async (updates: Partial<ServerInstance>) => {
    if (!selectedServerId) return;
    const result = await updateServer({ id: selectedServerId, ...updates });
    if (result) {
      toast.success(t('toast.settingsSaved'));
    }
  }, [selectedServerId, updateServer, t]);

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
                  <ServerConsole
                    logs={currentLogs}
                    onClear={() => {}}
                    onSendCommand={(cmd) => sendCommand(selectedServer.id, cmd)}
                  />
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

  // 轉換為 Sidebar 需要的格式
  const sidebarServers = servers.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status as 'stopped' | 'running',
  }));

  return (
    <MainLayout
      servers={sidebarServers}
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
        existingNames={servers.map((s) => s.name)}
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
