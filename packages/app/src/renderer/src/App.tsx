import { useState } from 'react';
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
import { SettingsDialog, AboutDialog } from '@/components/settings';
import { toast } from '@/lib/toast';
import '@/i18n';

// Mock data for development
const mockServers: ServerInstance[] = [
  { id: '1', name: 'Survival Server', coreType: 'paper', mcVersion: '1.20.4', status: 'running', ramMax: 4096 },
  { id: '2', name: 'Creative World', coreType: 'vanilla', mcVersion: '1.20.4', status: 'stopped', ramMax: 2048 },
  { id: '3', name: 'Modded Server', coreType: 'forge', mcVersion: '1.19.4', status: 'stopped', ramMax: 8192 },
];

const mockLogs: LogEntry[] = [
  { id: '1', timestamp: new Date(), level: 'info', message: '[Server] Starting minecraft server version 1.20.4' },
  { id: '2', timestamp: new Date(), level: 'info', message: '[Server] Loading properties' },
  { id: '3', timestamp: new Date(), level: 'warn', message: '[Server] server.properties does not exist' },
  { id: '4', timestamp: new Date(), level: 'info', message: '[Server] Generating new properties file' },
  { id: '5', timestamp: new Date(), level: 'info', message: '[Server] Done (2.5s)! For help, type "help"' },
];

function AppContent() {
  const [servers, setServers] = useState<ServerInstance[]>(mockServers);
  const [selectedServerId, setSelectedServerId] = useState<string | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  const handleCreateServer = (data: CreateServerData) => {
    const newServer: ServerInstance = {
      id: Date.now().toString(),
      name: data.name,
      coreType: data.coreType,
      mcVersion: data.mcVersion,
      status: 'stopped',
      ramMax: data.ramMax,
    };
    setServers([...servers, newServer]);
    toast.success('toast.serverCreated');
  };

  const handleStartServer = (id: string) => {
    setServers(servers.map((s) => (s.id === id ? { ...s, status: 'running' } : s)));
    toast.success('toast.serverStarted');
  };

  const handleStopServer = (id: string) => {
    setServers(servers.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)));
    toast.success('toast.serverStopped');
  };

  const handleDeleteServer = (id: string) => {
    setServers(servers.filter((s) => s.id !== id));
    setSelectedServerId(undefined);
    toast.success('toast.serverDeleted');
  };

  const handleUpdateServer = (updates: Partial<ServerInstance>) => {
    if (!selectedServerId) return;
    setServers(servers.map((s) => (s.id === selectedServerId ? { ...s, ...updates } : s)));
    toast.success('toast.settingsSaved');
  };

  return (
    <MainLayout
      onCreateServer={() => setShowCreateDialog(true)}
      onOpenSettings={() => setShowSettingsDialog(true)}
      onOpenAbout={() => setShowAboutDialog(true)}
      selectedServerId={selectedServerId}
      onSelectServer={setSelectedServerId}
    >
      <div className="h-full">
        {selectedServer ? (
          <div className="space-y-6">
            <ServerDetail
              server={selectedServer}
              onStart={() => handleStartServer(selectedServer.id)}
              onStop={() => handleStopServer(selectedServer.id)}
              onDelete={() => handleDeleteServer(selectedServer.id)}
              onUpdate={handleUpdateServer}
            />
            {selectedServer.status === 'running' && (
              <ServerConsole
                logs={logs}
                onClear={() => setLogs([])}
              />
            )}
          </div>
        ) : (
          <ServerList
            servers={servers}
            selectedServerId={selectedServerId}
            onSelectServer={setSelectedServerId}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
          />
        )}
      </div>

      <CreateServerDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateServer}
      />

      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />

      <AboutDialog
        open={showAboutDialog}
        onOpenChange={setShowAboutDialog}
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
