/**
 * ServerDetail - Linear-inspired operational bento for a single server.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowUpRight,
  Cpu,
  Database,
  FolderOpen,
  HardDrive,
  Loader2,
  MemoryStick,
  MoreHorizontal,
  Play,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
} from '@/components/ui/workspace-dialog';
import type { ServerInstance } from './ServerList';
import { ConnectionInfoCard } from './ConnectionInfoCard';
import { ServerFirstRunChecklist } from './ServerFirstRunChecklist';
import { ServerPerformanceChart } from './ServerPerformanceChart';

type ServerSettingsSection = 'basic' | 'gameplay' | 'network' | 'backup';

interface ServerDetailProps {
  server: ServerInstance;
  directory?: string;
  onBack?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  onDelete?: () => void;
  onUpdate?: (updates: Partial<ServerInstance>) => Promise<ServerInstance | null | void> | ServerInstance | null | void;
  onUpdateOnboardingState?: (updates: Partial<ServerInstance>) => Promise<void> | void;
  onOpenFolder?: () => void;
  onOpenSettings?: () => void;
  onOpenSettingsSection?: (section: ServerSettingsSection) => void;
  showOnboardingEntry?: boolean;
  autoOpenOnboarding?: boolean;
  onOnboardingAutoOpened?: () => void;
}

function ServerTelemetry() {
  return (
    <div className="server-telemetry" aria-hidden="true" />
  );
}

export function ServerDetail({
  server,
  directory,
  onBack,
  onStart,
  onStop,
  onDelete,
  onUpdate,
  onUpdateOnboardingState,
  onOpenFolder,
  onOpenSettings,
  onOpenSettingsSection,
  showOnboardingEntry = true,
  autoOpenOnboarding = false,
  onOnboardingAutoOpened,
}: ServerDetailProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(server.name);
  const [editRamMax, setEditRamMax] = useState(server.ramMax);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isRunning = server.status === 'running';
  const isTransitioning = server.status === 'starting' || server.status === 'stopping';
  const isReady = server.isReady !== false;
  const hasServerProperties = server.hasServerProperties === true;
  const readinessLabel = isReady ? t('server.ready') : t('server.downloading');
  const readinessDescription = isReady ? t('server.readyDescription') : t('server.downloadingDescription');
  const runtimeDescription = isRunning
    ? t('server.runtimeRunningDescription')
    : isTransitioning
      ? t('server.runtimeTransitionDescription')
      : t('server.runtimeStoppedDescription');
  const isImported = server.origin === 'imported';
  const primaryAction = isRunning
    ? 'stop'
    : isTransitioning
      ? 'transition'
      : isReady
        ? 'start'
        : 'download';
  const settingsSections = [
    {
      label: t('serverProperties.sections.gameplay'),
      fields: ['gamemode', 'difficulty', 'max-players', 'online-mode'],
    },
    {
      label: t('serverProperties.sections.world'),
      fields: ['level-name', 'level-seed', 'allow-nether', 'spawn-protection'],
    },
    {
      label: t('serverProperties.sections.advanced'),
      fields: ['view-distance', 'simulation-distance', 'enable-command-block', 'max-tick-time'],
    },
  ];

  const handleSave = () => {
    onUpdate?.({ name: editName, ramMax: editRamMax });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(server.name);
    setEditRamMax(server.ramMax);
    setIsEditing(false);
  };

  return (
    <div className="server-detail-linear space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="server-bento-pressable -ml-2 h-8 text-xs text-muted-foreground hover:text-foreground lg:text-sm"
        aria-label={t('common.back')}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {t('common.back')}
      </Button>

      <header className="flex flex-col gap-4 border-b border-border/45 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-[-0.025em] lg:text-2xl">{server.name}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-foreground/80">
              {t(`coreType.${server.coreType}`)}
            </span>
            <span className="tabular-nums">{server.mcVersion}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('server.actions', '伺服器操作')}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            disabled={isRunning}
            className="server-bento-pressable h-8 border-border/60 bg-transparent text-xs"
            aria-label={t('common.edit')}
          >
            <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.edit')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFolder}
            disabled={!onOpenFolder}
            className="server-bento-pressable h-8 border-border/60 bg-transparent text-xs"
            aria-label={t('server.openFolder')}
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('server.openFolder')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="server-bento-pressable h-8 w-8 border-border/60 bg-transparent"
                aria-label={t('server.moreActions')}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="server-detail-menu min-w-44">
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                disabled={isRunning}
                onSelect={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {showOnboardingEntry ? (
        <ServerFirstRunChecklist
          server={server}
          autoOpen={autoOpenOnboarding}
          onAutoOpenHandled={onOnboardingAutoOpened}
          onOpenFolder={onOpenFolder}
          onOpenSettingsSection={(section) => onOpenSettingsSection?.(section)}
          onStart={onStart}
          onUpdateOnboardingState={(onboardingState) => onUpdateOnboardingState?.({ onboardingState })}
        />
      ) : null}

      <div className="server-bento-grid">
        <section className="server-bento-tile server-bento-hero xl:col-span-8" data-status={server.status}>
          <ServerTelemetry />
          <div className="relative z-10 flex min-h-[248px] max-w-md flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="server-runtime-pill" data-status={server.status} role="status">
                <span className="server-runtime-dot" aria-hidden="true" />
                {t(`server.${server.status}`)}
              </span>
              <span className="server-readiness-pill" data-ready={isReady}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {readinessLabel}
              </span>
            </div>

            <div className="mt-auto pt-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {t('server.launchPanel')}
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-[-0.035em] lg:text-[2.35rem]">
                {t(`server.${server.status}`)}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                {isReady ? runtimeDescription : readinessDescription}
              </p>

              <Button
                variant={isRunning ? 'destructive' : 'default'}
                onClick={isRunning ? onStop : onStart}
                disabled={isTransitioning || (!isRunning && !isReady)}
                className="server-primary-action server-bento-pressable mt-6 h-9 min-w-36 px-4 text-xs"
                data-action={primaryAction}
                aria-label={isRunning ? t('server.stop') : !isReady ? t('server.downloading') : t('server.start')}
              >
                <span className="server-primary-action-content">
                  <span data-action-layer="start">
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('server.start')}
                  </span>
                  <span data-action-layer="stop">
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('server.stop')}
                  </span>
                  <span data-action-layer="transition">
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {t(`server.${server.status}`)}
                  </span>
                  <span data-action-layer="download">
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {t('server.downloading')}
                  </span>
                </span>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:col-span-4">
          <section className="server-bento-tile server-bento-identity">
            <div className="server-bento-heading">
              <Cpu className="h-4 w-4" aria-hidden="true" />
              <h3>{t('server.identity')}</h3>
            </div>
            <dl className="mt-5 divide-y divide-border/45">
              <div className="server-identity-row">
                <dt><Cpu className="h-3.5 w-3.5" aria-hidden="true" />{t('server.coreType')}</dt>
                <dd>{t(`coreType.${server.coreType}`)}</dd>
              </div>
              <div className="server-identity-row">
                <dt><Database className="h-3.5 w-3.5" aria-hidden="true" />{t('server.version')}</dt>
                <dd className="tabular-nums">{server.mcVersion}</dd>
              </div>
              <div className="server-identity-row">
                <dt><MemoryStick className="h-3.5 w-3.5" aria-hidden="true" />{t('server.ram')}</dt>
                <dd className="tabular-nums">{server.ramMax} MB</dd>
              </div>
            </dl>
          </section>

          <button
            type="button"
            onClick={onOpenFolder}
            disabled={!onOpenFolder}
            className="server-bento-tile server-bento-tile-interactive group text-left disabled:cursor-default disabled:opacity-65"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="server-bento-heading">
                  <HardDrive className="h-4 w-4" aria-hidden="true" />
                  <h3>{t('server.storage')}</h3>
                </div>
                <p className="mt-4 truncate font-mono text-xs text-muted-foreground" title={directory}>
                  {directory || t('server.storageUnavailable')}
                </p>
              </div>
              <ArrowUpRight className="server-bento-arrow mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </button>
        </div>

        <section className="server-bento-tile flex flex-col xl:col-span-5">
          <div className="server-bento-heading">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <h3>{t('server.settingsTitle')}</h3>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {hasServerProperties
              ? t('server.settingsPreviewDescription')
              : t('server.settingsPreviewPendingDescription')}
          </p>

          {hasServerProperties ? (
            <div className="mt-5 divide-y divide-border/45 border-y border-border/45">
              {settingsSections.map((section) => (
                <div key={section.label} className="server-settings-row">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-foreground/85">{section.label}</p>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{section.fields.length}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                    {section.fields.map((key) => (
                      <span key={key} className="font-mono text-[10px] text-muted-foreground">{key}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="server-bento-note mt-5 text-xs leading-5 text-muted-foreground">
              {t('server.serverPropertiesPending')}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="server-bento-link server-bento-pressable group mt-auto h-9 justify-between px-0 pt-5 text-xs"
          >
            <span>{t('server.openServerSettings')}</span>
            <ArrowUpRight className="server-bento-arrow h-4 w-4" aria-hidden="true" />
          </Button>
        </section>

        <ConnectionInfoCard
          serverId={server.id}
          serverStatus={server.status}
          hasServerProperties={hasServerProperties}
          appearance="bento"
        />

        <ServerPerformanceChart serverId={server.id} status={server.status} />
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <WorkspaceDialogContent className="max-w-[90vw] sm:max-w-md">
          <WorkspaceDialogHeader
            title={`${t('common.edit')} ${server.name}`}
          />
          <WorkspaceDialogBody className="space-y-3 lg:space-y-4">
            <div className="space-y-1.5 lg:space-y-2">
              <Label htmlFor="edit-name" className="text-xs lg:text-sm">{t('server.name')}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="h-8 text-xs lg:h-9 lg:text-sm"
              />
            </div>
            <div className="space-y-1.5 lg:space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs lg:text-sm">{t('createServer.maxRam')}</Label>
                <span className="text-xs text-muted-foreground lg:text-sm">{editRamMax} MB</span>
              </div>
              <Slider
                value={[editRamMax]}
                onValueChange={(values) => values[0] !== undefined && setEditRamMax(values[0])}
                min={512}
                max={16384}
                step={512}
              />
            </div>
          </WorkspaceDialogBody>
          <WorkspaceDialogFooter>
            <Button variant="outline" onClick={handleCancel} className="h-8 text-xs lg:h-9 lg:text-sm">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="h-8 text-xs lg:h-9 lg:text-sm">{t('common.save')}</Button>
          </WorkspaceDialogFooter>
        </WorkspaceDialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <WorkspaceDialogContent className="max-w-[90vw] sm:max-w-md">
          <WorkspaceDialogHeader
            title={t('server.delete')}
            description={
              <div className="space-y-2 text-xs text-muted-foreground lg:text-sm">
                <p>{t('server.deleteConfirm', '確定要刪除此伺服器嗎？')}</p>
                <p className="font-medium text-foreground">{t('server.name')}: {server.name}</p>
                <p className="text-destructive">
                  {isImported
                    ? t('serverImport.deleteWarning')
                    : t('server.deleteWarning', '此操作無法復原，所有伺服器資料將被永久刪除。')}
                </p>
              </div>
            }
          />
          <WorkspaceDialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="h-8 text-xs lg:h-9 lg:text-sm">
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.();
                setShowDeleteDialog(false);
              }}
              className="h-8 text-xs lg:h-9 lg:text-sm"
            >
              {t('common.delete')}
            </Button>
          </WorkspaceDialogFooter>
        </WorkspaceDialogContent>
      </Dialog>
    </div>
  );
}
