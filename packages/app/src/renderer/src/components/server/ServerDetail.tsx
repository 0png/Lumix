/**
 * ServerDetail 元件 - 伺服器詳細資訊
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計、無障礙、Loading 狀態
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Play, Square, Trash2, Settings2, MemoryStick, 
  ArrowLeft, FolderOpen, AlertTriangle, SlidersHorizontal,
  Activity, Cpu, Database, Gauge, HardDrive, ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ServerInstance, ServerStatus } from './ServerList';
import { ConnectionInfoCard } from './ConnectionInfoCard';
import { ServerFirstRunChecklist } from './ServerFirstRunChecklist';

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

/**
 * 狀態徽章元件 - 帶光暈效果和無障礙支援
 */
function StatusBadge({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  const statusConfig = {
    stopped: { color: 'bg-muted-foreground', label: t('server.stopped'), variant: 'ghost' as const },
    starting: { color: 'status-glow-transitioning', label: t('server.starting'), variant: 'warning' as const },
    running: { color: 'status-glow-running', label: t('server.running'), variant: 'success' as const },
    stopping: { color: 'status-glow-transitioning', label: t('server.stopping'), variant: 'warning' as const },
  };

  const config = statusConfig[status];

  return (
    <Badge 
      variant={config.variant}
      className="gap-1.5 px-2 lg:px-3 py-0.5 lg:py-1"
      role="status"
      aria-label={`${t('server.status')}: ${config.label}`}
    >
      <span className={cn('h-1.5 w-1.5 lg:h-2 lg:w-2 rounded-full transition-all duration-300', config.color)} aria-hidden="true" />
      <span className="text-xs lg:text-sm font-medium">{config.label}</span>
    </Badge>
  );
}

/**
 * 伺服器詳細資訊元件
 */
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
  const isImported = server.origin === 'imported';
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
    <div className="space-y-3 lg:space-y-4 animate-fade-in">
      {/* 返回按鈕 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-7 lg:h-8 text-xs lg:text-sm -ml-2 focus-ring"
        aria-label={t('common.back')}
      >
        <ArrowLeft className="mr-1 h-3 w-3 lg:h-4 lg:w-4" aria-hidden="true" />
        {t('common.back')}
      </Button>

      {/* 標題區域 */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg lg:text-xl font-bold tracking-tight truncate">{server.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] lg:text-xs">
              {t(`coreType.${server.coreType}`)}
            </Badge>
            <span className="text-xs lg:text-sm text-muted-foreground">{server.mcVersion}</span>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-1.5 lg:gap-2" role="toolbar" aria-label={t('server.actions', '伺服器操作')}>
        {isRunning ? (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onStop} 
            disabled={isTransitioning} 
            className="h-8 text-xs ripple"
            aria-label={t('server.stop')}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('server.stop')}
          </Button>
        ) : (
          <Button 
            size="sm" 
            onClick={onStart} 
            disabled={isTransitioning || !isReady} 
            className="h-8 text-xs ripple"
            aria-label={!isReady ? t('server.downloading') : t('server.start')}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {!isReady ? t('server.downloading') : t('server.start')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          disabled={isRunning}
          className="h-8 text-xs"
          aria-label={t('common.edit')}
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('common.edit')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="h-8 text-xs"
          aria-label={t('server.settingsTitle')}
        >
          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('server.settingsTitle')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFolder}
          className="h-8 text-xs"
          aria-label={t('server.openFolder')}
        >
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('server.openFolder')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive h-8 text-xs"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isRunning}
          aria-label={t('common.delete')}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('common.delete')}
        </Button>
      </div>

      <Separator />

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

      <div className="space-y-3 lg:space-y-4">
        <Card className="glass overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-subtle p-4 lg:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('server.overview')}
                  </p>
                  <h3 className="text-lg font-semibold">{t('server.launchPanel')}</h3>
                  <p className="max-w-xl text-sm text-muted-foreground">{readinessDescription}</p>
                </div>
                <Badge variant={isReady ? 'success' : 'warning'} className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {readinessLabel}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="rounded-lg border border-border/60 bg-card/55 p-3">
                  <Activity className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Label className="text-[10px] text-muted-foreground">{t('server.status')}</Label>
                  <p className="mt-0.5 text-sm font-semibold">{t(`server.${server.status}`)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/55 p-3">
                  <Cpu className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Label className="text-[10px] text-muted-foreground">{t('server.coreType')}</Label>
                  <p className="mt-0.5 text-sm font-semibold">{t(`coreType.${server.coreType}`)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/55 p-3">
                  <Database className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Label className="text-[10px] text-muted-foreground">{t('server.version')}</Label>
                  <p className="mt-0.5 text-sm font-semibold">{server.mcVersion}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/55 p-3">
                  <MemoryStick className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Label className="text-[10px] text-muted-foreground">{t('server.ram')}</Label>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{server.ramMax} MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 lg:p-5">
              <div className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium">{t('server.runtimeState')}</p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {isRunning
                    ? t('server.runtimeRunningDescription')
                    : isTransitioning
                      ? t('server.runtimeTransitionDescription')
                      : t('server.runtimeStoppedDescription')}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium">{t('server.storage')}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground" title={directory}>
                  {directory || t('server.storageUnavailable')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-2">
          <Card className="glass flex flex-col">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {t('server.settingsTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4 p-4 pt-1">
              <div className="space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  {hasServerProperties
                    ? t('server.settingsPreviewDescription')
                    : t('server.settingsPreviewPendingDescription')}
                </p>
                {hasServerProperties ? (
                  <div className="grid gap-2">
                    {settingsSections.map((section) => (
                      <div key={section.label} className="rounded-lg border border-border/60 bg-card/45 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">{section.label}</p>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {section.fields.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {section.fields.map((key) => (
                            <Badge key={key} variant="outline" className="text-[10px]">
                              {key}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-card/45 p-3 text-xs leading-5 text-muted-foreground">
                    {t('server.serverPropertiesPending')}
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenSettings}
                className="w-full h-8 text-xs"
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t('server.openServerSettings')}
              </Button>
            </CardContent>
          </Card>
          <ConnectionInfoCard
            serverId={server.id}
            serverStatus={server.status}
            hasServerProperties={hasServerProperties}
          />
        </div>
      </div>

      {/* 編輯對話框 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-lg">{t('common.edit')} {server.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 lg:space-y-4 py-3 lg:py-4">
            <div className="space-y-1.5 lg:space-y-2">
              <Label htmlFor="edit-name" className="text-xs lg:text-sm">{t('server.name')}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 lg:h-9 text-xs lg:text-sm"
              />
            </div>
            <div className="space-y-1.5 lg:space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs lg:text-sm">{t('createServer.maxRam')}</Label>
                <span className="text-xs lg:text-sm text-muted-foreground">{editRamMax} MB</span>
              </div>
              <Slider
                value={[editRamMax]}
                onValueChange={(values) => values[0] !== undefined && setEditRamMax(values[0])}
                min={512}
                max={16384}
                step={512}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel} className="h-8 lg:h-9 text-xs lg:text-sm">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="h-8 lg:h-9 text-xs lg:text-sm ripple">{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 - 加入警告文字 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              {t('server.delete')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs lg:text-sm space-y-2 text-muted-foreground">
                <p>{t('server.deleteConfirm', '確定要刪除此伺服器嗎？')}</p>
                <p className="font-medium text-foreground">{t('server.name')}: {server.name}</p>
                <p className="text-destructive">
                  {isImported
                    ? t('serverImport.deleteWarning')
                    : t('server.deleteWarning', '此操作無法復原，所有伺服器資料將被永久刪除。')}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="h-8 lg:h-9 text-xs lg:text-sm">
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.();
                setShowDeleteDialog(false);
              }}
              className="h-8 lg:h-9 text-xs lg:text-sm ripple"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
