import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CheckCircle2,
  CircleDashed,
  Compass,
  FolderOpen,
  Loader2,
  Play,
  ServerCog,
  Settings2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BackupInfoDto, OnboardingState, OnboardingStepId } from '../../../../shared/ipc-types';
import type { ServerInstance } from './ServerList';
import { ServerQuickActions } from './ServerQuickActions';

type ServerSettingsSection = 'basic' | 'gameplay' | 'network' | 'backup';
type StepVisualState = 'completed' | 'blocked' | 'recommended' | 'ready';

interface StepStatus {
  stepId: OnboardingStepId;
  state: StepVisualState;
  blockedReason?: string;
}

interface ServerFirstRunChecklistProps {
  server: ServerInstance;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
  onOpenFolder?: () => void;
  onOpenSettingsSection: (section: ServerSettingsSection) => void;
  onStart?: () => Promise<void> | void;
  onUpdateOnboardingState: (state: OnboardingState) => Promise<void> | void;
}

const STEP_ORDER: OnboardingStepId[] = [
  'review-folder-core',
  'review-memory-java',
  'review-properties',
  'review-connection',
  'start-server',
  'create-backup',
];

function dedupeSteps(steps: OnboardingStepId[]): OnboardingStepId[] {
  return Array.from(new Set(steps));
}

export function ServerFirstRunChecklist({
  server,
  autoOpen = false,
  onAutoOpenHandled,
  onOpenFolder,
  onOpenSettingsSection,
  onStart,
  onUpdateOnboardingState,
}: ServerFirstRunChecklistProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnectionHelpOpen, setIsConnectionHelpOpen] = useState(false);
  const [port, setPort] = useState<number | null>(null);
  const [backups, setBackups] = useState<BackupInfoDto[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);

  const onboardingState = useMemo<OnboardingState | null>(() => {
    if (!server.onboardingState) return null;
    return {
      dismissedAt: server.onboardingState.dismissedAt,
      completedSteps: dedupeSteps(server.onboardingState.completedSteps ?? []),
    };
  }, [server.onboardingState]);

  const completedSteps = useMemo(
    () => onboardingState?.completedSteps ?? [],
    [onboardingState]
  );
  const isDismissed = Boolean(onboardingState?.dismissedAt);

  const refreshProperties = useCallback(async () => {
    const result = await window.electronAPI.server.getPropertiesRaw(server.id);
    if (!result.success || !result.data) {
      setPort(null);
      return;
    }

    const rawPort = result.data['server-port'];
    const parsedPort = rawPort ? Number(rawPort) : Number.NaN;
    setPort(Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : null);
  }, [server.id]);

  const refreshBackups = useCallback(async () => {
    const result = await window.electronAPI.server.listBackups(server.id);
    if (result.success && result.data) {
      setBackups(result.data);
    }
  }, [server.id]);

  useEffect(() => {
    if (!onboardingState) return;
    refreshProperties().catch(() => setPort(null));
    refreshBackups().catch(() => setBackups([]));
  }, [onboardingState, refreshBackups, refreshProperties]);

  useEffect(() => {
    if (!onboardingState || !autoOpen || onboardingState.dismissedAt) return;
    setIsOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpen, onboardingState, onAutoOpenHandled]);

  const persistState = useCallback(async (nextState: OnboardingState) => {
    setIsPersisting(true);
    try {
      await onUpdateOnboardingState({
        dismissedAt: nextState.dismissedAt,
        completedSteps: dedupeSteps(nextState.completedSteps),
      });
    } finally {
      setIsPersisting(false);
    }
  }, [onUpdateOnboardingState]);

  const completeStep = useCallback(async (stepId: OnboardingStepId) => {
    if (!onboardingState || completedSteps.includes(stepId)) return;
    await persistState({
      dismissedAt: onboardingState.dismissedAt,
      completedSteps: [...completedSteps, stepId],
    });
  }, [completedSteps, onboardingState, persistState]);

  const dismissChecklist = useCallback(async () => {
    if (!onboardingState) return;
    await persistState({
      dismissedAt: new Date().toISOString(),
      completedSteps,
    });
    setIsOpen(false);
  }, [completedSteps, onboardingState, persistState]);

  useEffect(() => {
    if (!onboardingState) return;

    if (server.status === 'running' && !completedSteps.includes('start-server')) {
      persistState({
        dismissedAt: onboardingState.dismissedAt,
        completedSteps: [...completedSteps, 'start-server'],
      }).catch(() => {});
    }
  }, [completedSteps, onboardingState, persistState, server.status]);

  useEffect(() => {
    if (!onboardingState) return;

    if (backups.length > 0 && !completedSteps.includes('create-backup')) {
      persistState({
        dismissedAt: onboardingState.dismissedAt,
        completedSteps: [...completedSteps, 'create-backup'],
      }).catch(() => {});
    }
  }, [backups.length, completedSteps, onboardingState, persistState]);

  const stepStatuses = useMemo<Record<OnboardingStepId, StepStatus>>(() => {
    const isCompleted = (stepId: OnboardingStepId) => completedSteps.includes(stepId);
    return {
      'review-folder-core': {
        stepId: 'review-folder-core',
        state: isCompleted('review-folder-core') ? 'completed' : 'recommended',
      },
      'review-memory-java': {
        stepId: 'review-memory-java',
        state: isCompleted('review-memory-java')
          ? 'completed'
          : server.javaPath
            ? 'recommended'
            : 'blocked',
        blockedReason: server.javaPath ? undefined : t('onboarding.steps.review-memory-java.blockedReason'),
      },
      'review-properties': {
        stepId: 'review-properties',
        state: isCompleted('review-properties') ? 'completed' : 'recommended',
      },
      'review-connection': {
        stepId: 'review-connection',
        state: isCompleted('review-connection')
          ? 'completed'
          : port
            ? 'recommended'
            : 'blocked',
        blockedReason: port ? undefined : t('onboarding.steps.review-connection.blockedReason'),
      },
      'start-server': {
        stepId: 'start-server',
        state: isCompleted('start-server')
          ? 'completed'
          : server.isReady === false
            ? 'blocked'
            : 'recommended',
        blockedReason: server.isReady === false ? t('onboarding.steps.start-server.blockedReason') : undefined,
      },
      'create-backup': {
        stepId: 'create-backup',
        state: isCompleted('create-backup') ? 'completed' : 'ready',
      },
    };
  }, [completedSteps, port, server.isReady, server.javaPath, t]);

  const completedCount = completedSteps.length;
  const totalCount = STEP_ORDER.length;
  const hasPendingSteps = completedCount < totalCount;

  const handleCreateBackup = useCallback(async () => {
    setIsCreatingBackup(true);
    try {
      await window.electronAPI.server.createBackup({ serverId: server.id, trigger: 'manual' });
      await refreshBackups();
    } finally {
      setIsCreatingBackup(false);
    }
  }, [refreshBackups, server.id]);

  const quickActions = useMemo(() => [
    {
      id: 'folder',
      label: t('onboarding.quickActions.folder.label'),
      description: t('onboarding.quickActions.folder.description'),
      icon: <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
      onClick: () => onOpenFolder?.(),
      disabled: !onOpenFolder,
    },
    {
      id: 'settings',
      label: t('onboarding.quickActions.settings.label'),
      description: t('onboarding.quickActions.settings.description'),
      icon: <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
      onClick: () => onOpenSettingsSection('basic'),
    },
    {
      id: 'start',
      label: t('onboarding.quickActions.start.label'),
      description: t('onboarding.quickActions.start.description'),
      icon: <Play className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
      onClick: async () => onStart?.(),
      disabled: server.isReady === false || server.status === 'running',
    },
  ], [onOpenFolder, onOpenSettingsSection, onStart, server.isReady, server.status, t]);

  const renderStateBadge = (step: StepStatus) => {
    const variant = step.state === 'completed'
      ? 'success'
      : step.state === 'blocked'
        ? 'warning'
        : step.state === 'recommended'
          ? 'secondary'
          : 'outline';

    return (
      <Badge variant={variant} className="shrink-0">
        {t(`onboarding.state.${step.state}`)}
      </Badge>
    );
  };

  if (!onboardingState) return null;

  return (
    <>
      <Card className="glass">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Compass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {t('onboarding.title')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t('onboarding.progress', { completed: completedCount, total: totalCount })}
              </p>
            </div>
            {hasPendingSteps ? renderStateBadge({ stepId: 'review-folder-core', state: isDismissed ? 'ready' : 'recommended' }) : (
              <Badge variant="success">{t('onboarding.done')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-1">
          <p className="text-sm text-muted-foreground">
            {hasPendingSteps
              ? isDismissed
                ? t('onboarding.dismissedDescription')
                : t('onboarding.description')
              : t('onboarding.completedDescription')}
          </p>

          {hasPendingSteps && (
            <ServerQuickActions actions={quickActions} />
          )}

          <div className="flex flex-wrap gap-2">
            {hasPendingSteps ? (
              <Button size="sm" onClick={() => setIsOpen(true)} className="h-8 text-xs">
                {isDismissed ? t('onboarding.reopen') : t('onboarding.continue')}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="h-8 text-xs">
              {t('onboarding.viewChecklist')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('onboarding.modalTitle', { server: server.name })}</DialogTitle>
            <DialogDescription>{t('onboarding.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {STEP_ORDER.map((stepId, index) => {
              const step = stepStatuses[stepId];
              const isManual = stepId === 'review-folder-core'
                || stepId === 'review-memory-java'
                || stepId === 'review-properties'
                || stepId === 'review-connection';

              return (
                <div key={stepId} className="rounded-lg border border-border/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {step.state === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        <p className="text-sm font-medium">
                          {index + 1}. {t(`onboarding.steps.${stepId}.title`)}
                        </p>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t(`onboarding.steps.${stepId}.description`)}
                      </p>
                      {step.blockedReason ? (
                        <p className="text-xs text-amber-600 dark:text-amber-300">{step.blockedReason}</p>
                      ) : null}
                    </div>
                    {renderStateBadge(step)}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {stepId === 'review-folder-core' ? (
                      <Button size="sm" variant="outline" onClick={() => onOpenFolder?.()} disabled={!onOpenFolder}>
                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {t('onboarding.steps.review-folder-core.action')}
                      </Button>
                    ) : null}

                    {stepId === 'review-memory-java' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenSettingsSection('basic')}
                        disabled={step.state === 'blocked'}
                      >
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {t('onboarding.steps.review-memory-java.action')}
                      </Button>
                    ) : null}

                    {stepId === 'review-properties' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onOpenSettingsSection('gameplay')}>
                          <ServerCog className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t('onboarding.steps.review-properties.openGameplay')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onOpenSettingsSection('network')}>
                          <ServerCog className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t('onboarding.steps.review-properties.openNetwork')}
                        </Button>
                      </>
                    ) : null}

                    {stepId === 'review-connection' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsConnectionHelpOpen(true)}
                        disabled={step.state === 'blocked'}
                      >
                        <Compass className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {t('onboarding.steps.review-connection.action')}
                      </Button>
                    ) : null}

                    {stepId === 'start-server' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStart?.()}
                        disabled={step.state === 'blocked' || step.state === 'completed'}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {t('onboarding.steps.start-server.action')}
                      </Button>
                    ) : null}

                    {stepId === 'create-backup' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCreateBackup}
                          disabled={step.state === 'completed' || isCreatingBackup}
                        >
                          {isCreatingBackup ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {t('onboarding.steps.create-backup.action')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onOpenSettingsSection('backup')}>
                          <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t('onboarding.steps.create-backup.openSettings')}
                        </Button>
                      </>
                    ) : null}

                    {isManual ? (
                      <Button
                        size="sm"
                        onClick={() => completeStep(stepId)}
                        disabled={step.state === 'completed' || step.state === 'blocked' || isPersisting}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {t('onboarding.markComplete')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('common.close')}
            </Button>
            {hasPendingSteps ? (
              <Button variant="ghost" onClick={dismissChecklist} disabled={isPersisting}>
                <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t('onboarding.dismiss')}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConnectionHelpOpen} onOpenChange={setIsConnectionHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('onboarding.connection.title')}</DialogTitle>
            <DialogDescription>{t('onboarding.connection.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">{t('onboarding.connection.localhost')}</p>
              <p className="mt-1 font-mono">localhost:{port ?? '—'}</p>
            </div>
            <p>{t('onboarding.connection.sameDevice')}</p>
            <p>{t('onboarding.connection.sameNetwork')}</p>
            <p>{t('onboarding.connection.wan')}</p>
            <p className="text-xs text-muted-foreground">{t('onboarding.connection.phaseNote')}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsConnectionHelpOpen(false)}>
              {t('common.close')}
            </Button>
            <Button
              onClick={async () => {
                await completeStep('review-connection');
                setIsConnectionHelpOpen(false);
              }}
              disabled={!port}
            >
              {t('onboarding.markComplete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
