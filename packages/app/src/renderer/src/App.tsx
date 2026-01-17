import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layout';
import { ThemeProvider, LanguageProvider } from '@/contexts';
import {
  ServerList,
  ServerDetail,
  ServerConsole,
  CreateServerDialog,
  EnableTunnelDialog,
  type ServerInstance,
  type LogEntry,
  type CreateServerData,
} from '@/components/server';
import { TunnelClaimDialog } from '@/components/server/TunnelClaimDialog';
import { SettingsView, AboutView } from '@/components/settings';
import { useServers } from '@/hooks/use-servers';
import { useSettings } from '@/hooks/use-settings';
import { toast } from '@/lib/toast';
import '@/i18n';
import type { ServerReadyEvent } from '../../../shared/ipc-types';

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
  const [showTunnelDialog, setShowTunnelDialog] = useState(false);
  const [tunnelDialogServerId, setTunnelDialogServerId] = useState<string | null>(null);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [claimDialogData, setClaimDialogData] = useState<{ url: string; code: string; serverId: string } | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('servers');
  const [isCreating, setIsCreating] = useState(false);
  const { settings } = useSettings();

  // 轉換 DTO 為前端格式
  const servers = serverDtos.map(toServerInstance);
  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const selectedServerDto = serverDtos.find((s) => s.id === selectedServerId);

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

    const result = await startServer(id);
    if (result.success) {
      toast.success(t('toast.serverStarted'));
    } else {
      toast.error(t('toast.startFailed'), result.error);
    }
  }, [startServer, t, serverDtos, updateServer]);

  const handleStopServer = useCallback(async (id: string) => {
    // 先停止隧道（如果正在運行）
    try {
      const tunnelStatus = await window.electronAPI.tunnel.getStatus(id);
      if (tunnelStatus.success && tunnelStatus.data && tunnelStatus.data !== 'stopped') {
        await window.electronAPI.tunnel.stop(id);
      }
    } catch (error) {
      console.error('Failed to stop tunnel:', error);
      // 繼續停止伺服器，即使隧道停止失敗
    }

    // 停止伺服器
    const result = await stopServer(id);
    if (result.success) {
      toast.success(t('toast.serverStopped'));
    } else {
      toast.error(t('toast.stopFailed'), result.error);
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

  const handleOpenFolder = useCallback(async (directory: string) => {
    await window.electronAPI.app.openFolder(directory);
  }, []);

  // 處理啟用隧道
  const handleEnableTunnel = useCallback(async (serverId: string, dontAskAgain: boolean) => {
    try {
      // 讀取 server.properties 獲取端口
      const propsResult = await window.electronAPI.server.getPropertiesRaw(serverId);
      const localPort = propsResult.success && propsResult.data
        ? parseInt(propsResult.data['server-port'] || '25565', 10)
        : 25565;

      // 創建並啟動隧道
      const tunnelResult = await window.electronAPI.tunnel.create({
        serverId,
        localPort,
        autoStart: true,
      });

      if (tunnelResult.success && tunnelResult.data) {
        toast.success(t('tunnel.enabled'));
        
        // 如果用戶選擇"不再詢問"，保存設置
        if (dontAskAgain) {
          await window.electronAPI.settings.save({
            tunnel: {
              dontAskAgain: true,
              autoEnable: false,
            },
          });
        }
      } else {
        toast.error(tunnelResult.error || t('toast.error'));
      }
    } catch (error) {
      console.error('Failed to enable tunnel:', error);
      toast.error(t('toast.error'));
    }
  }, [t]);

  // 監聽服務器就緒事件
  useEffect(() => {
    const unsubscribe = window.electronAPI.server.onReady(async (event: ServerReadyEvent) => {
      // 檢查用戶設置，如果選擇了"不再詢問"或"自動啟用"，則不顯示對話框
      if (settings?.tunnel?.dontAskAgain || settings?.tunnel?.autoEnable) {
        if (settings.tunnel.autoEnable) {
          // 自動啟用隧道
          await handleEnableTunnel(event.serverId, false);
        }
        return;
      }

      // 顯示對話框
      setTunnelDialogServerId(event.serverId);
      setShowTunnelDialog(true);
    });

    return () => {
      unsubscribe();
    };
  }, [settings, handleEnableTunnel]);

  // 監聽隧道 claim 需求事件
  useEffect(() => {
    const unsubscribe = window.electronAPI.tunnel.onClaimRequired((event) => {
      console.log('Claim required event received:', event);
      setClaimDialogData({ url: event.claimUrl, code: event.claimCode, serverId: event.serverId });
      setShowClaimDialog(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 處理儲存 Playit IP
  const handleSavePlayitIp = async (serverId: string, ip: string) => {
    try {
      // 解析 IP 和 port
      // 支援兩種格式：
      // 1. 付費版：example.playit.gg:25565（有 port）
      // 2. 免費版：file-european.gl.joinmc.link（沒有 port，使用預設 25565）
      
      let address: string;
      let port: number;
      
      if (ip.includes(':')) {
        // 付費版格式
        const [addr, portStr] = ip.split(':');
        
        if (!addr || !portStr) {
          throw new Error('Invalid IP format');
        }
        
        address = addr;
        port = parseInt(portStr, 10);

        if (!port || isNaN(port)) {
          throw new Error('Invalid port number');
        }
      } else {
        // 免費版格式（沒有 port，使用預設 25565）
        address = ip;
        port = 25565;
      }

      // 更新 tunnel info（這裡可以呼叫 IPC 來儲存）
      // 暫時先在前端更新，實際應該透過 IPC 儲存到後端
      console.log(`Saving Playit IP for server ${serverId}: ${address}:${port}`);
      
      // TODO: 呼叫 IPC 來儲存 IP 到 tunnel info
      // await window.electronAPI.tunnel.saveCustomIp(serverId, address, port);
    } catch (error) {
      console.error('Failed to save Playit IP:', error);
      throw error;
    }
  };

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
                  onOpenFolder={() => selectedServerDto && handleOpenFolder(selectedServerDto.directory)}
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

      {tunnelDialogServerId && (
        <EnableTunnelDialog
          open={showTunnelDialog}
          onOpenChange={setShowTunnelDialog}
          serverId={tunnelDialogServerId}
          onEnable={handleEnableTunnel}
        />
      )}

      {claimDialogData && (
        <TunnelClaimDialog
          open={showClaimDialog}
          onOpenChange={setShowClaimDialog}
          claimUrl={claimDialogData.url}
          claimCode={claimDialogData.code}
          serverId={claimDialogData.serverId}
          onSaveIp={handleSavePlayitIp}
        />
      )}

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
