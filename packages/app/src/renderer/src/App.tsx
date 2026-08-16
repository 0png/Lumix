import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { WorkspaceDialogContent, WorkspaceDialogFooter, WorkspaceDialogHeader } from '@/components/ui/workspace-dialog';
import { useTheme } from '@/contexts/theme-context';
import { MainLayout } from '@/components/layout';
import { ThemeProvider, LanguageProvider } from '@/contexts';
import { UpdateNotification } from '@/components/update/UpdateNotification';
import {
  ServerList,
  ServerDetail,
  ServerSettingsPage,
  ServerConsole,
  PlayerManagement,
  CreateServerDialog,
  AddServerDialog,
  ImportServerDialog,
  ImportModpackDialog,
  DownloadProgressToast,
  type ServerInstance,
  type LogEntry,
  type CreateServerData,
} from '@/components/server';
import { SettingsView, AboutView } from '@/components/settings';
import { useServers } from '@/hooks/use-servers';
import { useJava } from '@/hooks/use-java';
import { toast } from '@/lib/toast';
import type { ImportServerRequest } from '../../shared/ipc-types';
import '@/i18n';

type ViewType = 'servers' | 'server-settings' | 'settings' | 'about';
type ServerSettingsSection = 'basic' | 'gameplay' | 'network' | 'backup';
const POST_CREATE_ONBOARDING_PROMPT_KEY = 'lumix.postCreateOnboardingPrompt.enabled';
const HIDDEN_ONBOARDING_SERVER_IDS_KEY = 'lumix.postCreateOnboarding.hiddenServerIds';

function isFullscreenLike(): boolean {
  const widthDelta = Math.abs(window.screen.availWidth - window.innerWidth);
  const heightDelta = Math.abs(window.screen.availHeight - window.innerHeight);
  return widthDelta <= 24 && heightDelta <= 32;
}

/**
 * 轉換 DTO 為前端 ServerInstance 格式
 */
function toServerInstance(dto: {
  id: string;
  name: string;
  origin: 'managed' | 'imported';
  coreType: string;
  mcVersion: string;
  javaPath?: string;
  status: string;
  ramMax: number;
  isReady?: boolean;
  hasServerProperties?: boolean;
  backupSettings?: ServerInstance['backupSettings'];
  onboardingState?: ServerInstance['onboardingState'];
}): ServerInstance {
  return {
    id: dto.id,
    name: dto.name,
    origin: dto.origin,
    coreType: dto.coreType as ServerInstance['coreType'],
    mcVersion: dto.mcVersion,
    javaPath: dto.javaPath,
    status: dto.status as ServerInstance['status'],
    ramMax: dto.ramMax,
    isReady: dto.isReady,
    hasServerProperties: dto.hasServerProperties,
    backupSettings: dto.backupSettings,
    onboardingState: dto.onboardingState,
  };
}

function AppContent() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    servers: serverDtos,
    loading,
    logs: serverLogs,
    downloadProgress,
    createServer,
    detectImportCandidate,
    importExistingServer,
    scanModpack,
    importModpack,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
    sendCommand,
    clearLogs,
  } = useServers();
  const {
    installations: javaInstallations,
    detect: detectJava,
  } = useJava();

  const [selectedServerId, setSelectedServerId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddServerDialog, setShowAddServerDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportModpackDialog, setShowImportModpackDialog] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('servers');
  const [isCreating, setIsCreating] = useState(false);
  const [isConsoleFullscreen, setIsConsoleFullscreen] = useState(false);
  const [pendingOnboardingServerId, setPendingOnboardingServerId] = useState<string | null>(null);
  const [pendingOnboardingPromptServerId, setPendingOnboardingPromptServerId] = useState<string | null>(null);
  const [shouldPromptPostCreateOnboarding, setShouldPromptPostCreateOnboarding] = useState(true);
  const [hiddenOnboardingServerIds, setHiddenOnboardingServerIds] = useState<string[]>([]);
  const [serverSettingsSection, setServerSettingsSection] = useState<ServerSettingsSection>('basic');
  const [useCreateServerModal, setUseCreateServerModal] = useState(() => isFullscreenLike());
  const [activeCreateServerPresentation, setActiveCreateServerPresentation] = useState<'modal' | 'overlay'>(
    () => (isFullscreenLike() ? 'modal' : 'overlay')
  );

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

      // 3. 建立伺服器實例（包含下載 server.jar）
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
        setSelectedServerId(server.id);
        setCurrentView('servers');
        if (shouldPromptPostCreateOnboarding) {
          setPendingOnboardingPromptServerId(server.id);
        } else {
          setHiddenOnboardingServerIds((current) => {
            const next = current.includes(server.id) ? current : [...current, server.id];
            window.localStorage.setItem(HIDDEN_ONBOARDING_SERVER_IDS_KEY, JSON.stringify(next));
            return next;
          });
        }
        toast.success(t('toast.serverReady'));
      }
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [createServer, shouldPromptPostCreateOnboarding, t]);

  const handleImportServer = useCallback(async (data: ImportServerRequest) => {
    const { server, error } = await importExistingServer(data);
    if (error) {
      return error;
    }

    if (server) {
      setSelectedServerId(server.id);
      setCurrentView('servers');
      toast.success(t('serverImport.importSuccess'));
    }
    return null;
  }, [importExistingServer, t]);

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
    const result = await stopServer(id);
    if (result.success) {
      toast.success(t('toast.serverStopped'));
    } else {
      toast.error(t('toast.stopFailed'), result.error);
    }
  }, [stopServer, t]);

  const handleDeleteServer = useCallback(async (id: string) => {
    const target = serverDtos.find((server) => server.id === id);
    const success = await deleteServer(id);
    if (success) {
      setSelectedServerId(undefined);
      toast.success(target?.origin === 'imported' ? t('serverImport.removeSuccess') : t('toast.serverDeleted'));
    } else {
      toast.error(t('toast.deleteFailed'));
    }
  }, [deleteServer, serverDtos, t]);

  const handleUpdateServer = useCallback(async (updates: Partial<ServerInstance>) => {
    if (!selectedServerId) return;
    const result = await updateServer({ id: selectedServerId, ...updates });
    if (result) {
      toast.success(t('toast.settingsSaved'));
    }
    return result;
  }, [selectedServerId, updateServer, t]);

  const handleUpdateServerSilently = useCallback(async (updates: Partial<ServerInstance>) => {
    if (!selectedServerId) return;
    await updateServer({ id: selectedServerId, ...updates });
  }, [selectedServerId, updateServer]);

  const handleSelectServer = useCallback((id: string) => {
    setSelectedServerId(id);
    setCurrentView('servers');
    setIsConsoleFullscreen(false);
    setPendingOnboardingServerId(null);
    setPendingOnboardingPromptServerId(null);
  }, []);

  const handleBackToServers = useCallback(() => {
    setCurrentView('servers');
    setIsConsoleFullscreen(false);
  }, []);

  const handleGoHome = useCallback(() => {
    setSelectedServerId(undefined);
    setCurrentView('servers');
    setIsConsoleFullscreen(false);
    setPendingOnboardingServerId(null);
    setPendingOnboardingPromptServerId(null);
  }, []);

  const handleOpenServerSettingsSection = useCallback((section: ServerSettingsSection) => {
    setServerSettingsSection(section);
    setCurrentView('server-settings');
  }, []);

  const handleOpenFolder = useCallback(async (directory: string) => {
    await window.electronAPI.app.openFolder(directory);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.server.onStatusChanged((event) => {
      if (!event.unexpected) return;

      const openLatestLog = event.latestLogPath
        ? {
            label: t('toast.openLatestLog'),
            onClick: () => {
              void (async () => {
                const result = await window.electronAPI.app.openFolder(event.latestLogPath!);
                if (!result.success && event.serverDirectory) {
                  await window.electronAPI.app.openFolder(event.serverDirectory);
                }
              })();
            },
          }
        : undefined;

      sonnerToast.error(
        t('toast.serverUnexpectedExit', { name: event.serverName ?? t('server.name') }),
        {
          id: `server-unexpected-exit-${event.serverId}`,
          description: t('toast.serverUnexpectedExitDescription', {
            code: event.exitCode ?? t('common.unknown'),
          }),
          duration: 15000,
          action: openLatestLog,
        }
      );
    });

    return () => {
      unsubscribe();
    };
  }, [t]);

  const handleAddJavaPath = useCallback(async () => {
    toast.info(t('toast.detectingJava'));
    const detectedJava = await detectJava();
    if (detectedJava.length > 0) {
      toast.success(t('toast.javaDetected', { count: detectedJava.length }));
    } else {
      toast.error(t('toast.noJavaFound'));
    }
  }, [detectJava, t]);

  const handleRemoveJavaPath = useCallback(async (_path: string) => {
    // Java installations 是由系統偵測的，無法手動移除
    // 這個功能暫時不實作
    toast.info(t('toast.javaCannotRemove'));
  }, [t]);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(POST_CREATE_ONBOARDING_PROMPT_KEY);
    if (storedPreference === 'false') {
      setShouldPromptPostCreateOnboarding(false);
    }

    const hiddenServerIds = window.localStorage.getItem(HIDDEN_ONBOARDING_SERVER_IDS_KEY);
    if (!hiddenServerIds) return;

    try {
      const parsed = JSON.parse(hiddenServerIds);
      if (Array.isArray(parsed)) {
        setHiddenOnboardingServerIds(parsed.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      window.localStorage.removeItem(HIDDEN_ONBOARDING_SERVER_IDS_KEY);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setUseCreateServerModal(isFullscreenLike());
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!showCreateDialog) {
      setActiveCreateServerPresentation(useCreateServerModal ? 'modal' : 'overlay');
    }
  }, [showCreateDialog, useCreateServerModal]);

  const handleOpenCreateServer = useCallback(() => {
    setActiveCreateServerPresentation(useCreateServerModal ? 'modal' : 'overlay');
    setShowCreateDialog(true);
  }, [useCreateServerModal]);

  const handleOpenAddServer = useCallback(() => {
    setShowAddServerDialog(true);
  }, []);

  const handleOpenImportServer = useCallback(() => {
    setShowImportDialog(true);
  }, []);

  const handleOpenImportModpack = useCallback(() => {
    setShowImportModpackDialog(true);
  }, []);

  const handleConfirmPostCreateOnboarding = useCallback(() => {
    if (!pendingOnboardingPromptServerId) return;
    setPendingOnboardingServerId(pendingOnboardingPromptServerId);
    setPendingOnboardingPromptServerId(null);
  }, [pendingOnboardingPromptServerId]);

  const handleDisablePostCreateOnboardingPrompt = useCallback(() => {
    if (pendingOnboardingPromptServerId) {
      setHiddenOnboardingServerIds((current) => {
        const next = current.includes(pendingOnboardingPromptServerId)
          ? current
          : [...current, pendingOnboardingPromptServerId];
        window.localStorage.setItem(HIDDEN_ONBOARDING_SERVER_IDS_KEY, JSON.stringify(next));
        return next;
      });
    }
    window.localStorage.setItem(POST_CREATE_ONBOARDING_PROMPT_KEY, 'false');
    setShouldPromptPostCreateOnboarding(false);
    setPendingOnboardingPromptServerId(null);
  }, [pendingOnboardingPromptServerId]);

  const handleClosePostCreateOnboardingPrompt = useCallback(() => {
    if (pendingOnboardingPromptServerId) {
      setHiddenOnboardingServerIds((current) => {
        const next = current.includes(pendingOnboardingPromptServerId)
          ? current
          : [...current, pendingOnboardingPromptServerId];
        window.localStorage.setItem(HIDDEN_ONBOARDING_SERVER_IDS_KEY, JSON.stringify(next));
        return next;
      });
    }
    setPendingOnboardingPromptServerId(null);
  }, [pendingOnboardingPromptServerId]);

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
        return (
          <SettingsView
            onBack={handleBackToServers}
            javaInstallations={javaInstallations}
            onAddJavaPath={handleAddJavaPath}
            onRemoveJavaPath={handleRemoveJavaPath}
          />
        );
      case 'about':
        return <AboutView onBack={handleBackToServers} />;
      default:
        if (currentView === 'server-settings' && selectedServer) {
          return (
            <ServerSettingsPage
              server={selectedServer}
              onBack={() => setCurrentView('servers')}
              onUpdate={handleUpdateServer}
              initialSection={serverSettingsSection}
            />
          );
        }

        return (
          <div className="h-full">
            {selectedServer ? (
              <div className="space-y-6">
                {!(isConsoleFullscreen && selectedServer.status === 'running') && (
                  <ServerDetail
                    server={selectedServer}
                    onBack={() => {
                      setSelectedServerId(undefined);
                      setIsConsoleFullscreen(false);
                    }}
                    onStart={() => handleStartServer(selectedServer.id)}
                    onStop={() => handleStopServer(selectedServer.id)}
                    onDelete={() => handleDeleteServer(selectedServer.id)}
                    onUpdate={handleUpdateServer}
                    directory={selectedServerDto?.directory}
                    onOpenFolder={() => selectedServerDto && handleOpenFolder(selectedServerDto.directory)}
                    onOpenSettings={() => handleOpenServerSettingsSection('basic')}
                    onOpenSettingsSection={handleOpenServerSettingsSection}
                    onUpdateOnboardingState={handleUpdateServerSilently}
                    showOnboardingEntry={
                      shouldPromptPostCreateOnboarding &&
                      !hiddenOnboardingServerIds.includes(selectedServer.id)
                    }
                    autoOpenOnboarding={pendingOnboardingServerId === selectedServer.id}
                    onOnboardingAutoOpened={() => setPendingOnboardingServerId((current) => (
                      current === selectedServer.id ? null : current
                    ))}
                  />
                )}
                {selectedServer.status === 'running' && (
                  <>
                    {!isConsoleFullscreen && (
                      <PlayerManagement
                        serverId={selectedServer.id}
                        status={selectedServer.status}
                      />
                    )}
                    <ServerConsole
                      logs={currentLogs}
                      onClear={() => clearLogs(selectedServer.id)}
                      onSendCommand={(cmd) => sendCommand(selectedServer.id, cmd)}
                      isFullscreen={isConsoleFullscreen}
                      onToggleFullscreen={() => setIsConsoleFullscreen((prev) => !prev)}
                    />
                  </>
                )}
              </div>
            ) : (
              <ServerList
                servers={servers}
                selectedServerId={selectedServerId}
                onSelectServer={handleSelectServer}
                onStartServer={handleStartServer}
                onStopServer={handleStopServer}
                onCreateServer={handleOpenAddServer}
                onOpenSettings={() => setCurrentView('settings')}
                javaInstallationsCount={javaInstallations.length}
                downloadProgress={new Map(
                  Array.from(downloadProgress.entries()).map(([serverId, progress]) => [
                    serverId,
                    progress.percentage,
                  ])
                )}
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
      overlay={
        showCreateDialog && activeCreateServerPresentation === 'overlay' ? (
          <CreateServerDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSubmit={handleCreateServer}
            disabled={isCreating}
            existingNames={servers.map((s) => s.name)}
            presentation="overlay"
          />
        ) : undefined
      }
      servers={sidebarServers}
      onGoHome={handleGoHome}
      onCreateServer={handleOpenAddServer}
      onOpenSettings={() => setCurrentView('settings')}
      onOpenAbout={() => setCurrentView('about')}
      selectedServerId={selectedServerId}
      onSelectServer={handleSelectServer}
      currentView={currentView}
    >
      {renderContent()}

      <AddServerDialog
        open={showAddServerDialog}
        onOpenChange={setShowAddServerDialog}
        onCreateStandard={handleOpenCreateServer}
        onImportModpack={handleOpenImportModpack}
        onImportExisting={handleOpenImportServer}
      />

      {showCreateDialog && activeCreateServerPresentation === 'modal' ? (
        <CreateServerDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={handleCreateServer}
          disabled={isCreating}
          existingNames={servers.map((s) => s.name)}
          presentation="modal"
        />
      ) : null}

      <ImportServerDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        existingNames={servers.map((s) => s.name)}
        onDetect={async (directory) => detectImportCandidate({ directory })}
        onImport={handleImportServer}
      />

      <ImportModpackDialog
        open={showImportModpackDialog}
        onOpenChange={setShowImportModpackDialog}
        existingNames={servers.map((server) => server.name)}
        onScan={(archivePath) => scanModpack({ archivePath })}
        onImport={importModpack}
        onImported={(result) => {
          setSelectedServerId(result.server.id);
          setCurrentView('servers');
          if (result.unresolvedFiles > 0) {
            toast.warning(t('modpackImport.importedIncomplete', { count: result.unresolvedFiles }));
          } else {
            toast.success(t('modpackImport.importSuccess'));
          }
        }}
      />

      <Dialog open={Boolean(pendingOnboardingPromptServerId)} onOpenChange={(open) => {
        if (!open) {
          handleClosePostCreateOnboardingPrompt();
        }
      }}>
        <WorkspaceDialogContent className="sm:max-w-md">
          <WorkspaceDialogHeader
            icon={ClipboardCheck}
            eyebrow={t('modal.nextSteps')}
            title={t('onboardingPrompt.title')}
            description={t('onboardingPrompt.description')}
          />
          <WorkspaceDialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={handleDisablePostCreateOnboardingPrompt}>
              {t('onboardingPrompt.neverAskAgain')}
            </Button>
            <Button onClick={handleConfirmPostCreateOnboarding}>
              {t('onboardingPrompt.open')}
            </Button>
          </WorkspaceDialogFooter>
        </WorkspaceDialogContent>
      </Dialog>

      <Toaster position="bottom-right" theme={theme} />
      <DownloadProgressToast servers={servers} downloadProgress={downloadProgress} />
      <UpdateNotification />
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
