import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Check,
  Circle,
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { WorkspaceDialogBody, WorkspaceDialogContent, WorkspaceDialogFooter, WorkspaceDialogHeader } from '@/components/ui/workspace-dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { findNextOnboardingStep, ONBOARDING_STEP_ORDER } from '@/lib/onboarding';
import type { BackupInfoDto, OnboardingState, OnboardingStepId } from '../../../../shared/ipc-types';
import type { ServerInstance } from './ServerList';
import { ConnectionInfoCard } from './ConnectionInfoCard';

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
  onOpenFolder?: () => Promise<void> | void;
  onOpenSettingsSection: (section: ServerSettingsSection) => void;
  onStart?: () => Promise<void> | void;
  onUpdateOnboardingState: (state: OnboardingState) => Promise<void> | void;
}

const STEP_ICONS = {
  'review-folder-core': FolderOpen,
  'review-memory-java': Settings2,
  'start-server': Play,
  'review-properties': ServerCog,
  'review-connection': Compass,
  'create-backup': Archive,
} satisfies Record<OnboardingStepId, typeof Archive>;

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
  const [selectedStepId, setSelectedStepId] = useState<OnboardingStepId>('review-folder-core');
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

  const completedSteps = useMemo(() => onboardingState?.completedSteps ?? [], [onboardingState]);
  const isDismissed = Boolean(onboardingState?.dismissedAt);

  const refreshProperties = useCallback(async () => {
    const result = await window.electronAPI.server.getPropertiesRaw(server.id);
    if (!result.success || !result.data) {
      setPort(null);
      return;
    }
    const parsedPort = Number(result.data['server-port']);
    setPort(Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : null);
  }, [server.id]);

  const refreshBackups = useCallback(async () => {
    const result = await window.electronAPI.server.listBackups(server.id);
    if (result.success && result.data) setBackups(result.data);
  }, [server.id]);

  useEffect(() => {
    if (!onboardingState) return;
    void refreshProperties().catch(() => setPort(null));
    void refreshBackups().catch(() => setBackups([]));
  }, [onboardingState, refreshBackups, refreshProperties]);

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
    await persistState({ dismissedAt: new Date().toISOString(), completedSteps });
    setIsOpen(false);
  }, [completedSteps, onboardingState, persistState]);

  useEffect(() => {
    if (!onboardingState || server.status !== 'running' || completedSteps.includes('start-server')) return;
    void persistState({
      dismissedAt: onboardingState.dismissedAt,
      completedSteps: [...completedSteps, 'start-server'],
    });
  }, [completedSteps, onboardingState, persistState, server.status]);

  useEffect(() => {
    if (!onboardingState || backups.length === 0 || completedSteps.includes('create-backup')) return;
    void persistState({
      dismissedAt: onboardingState.dismissedAt,
      completedSteps: [...completedSteps, 'create-backup'],
    });
  }, [backups.length, completedSteps, onboardingState, persistState]);

  const stepStatuses = useMemo<Record<OnboardingStepId, StepStatus>>(() => {
    const isCompleted = (stepId: OnboardingStepId) => completedSteps.includes(stepId);
    const statuses: Record<OnboardingStepId, StepStatus> = {
      'review-folder-core': { stepId: 'review-folder-core', state: isCompleted('review-folder-core') ? 'completed' : 'ready' },
      'review-memory-java': {
        stepId: 'review-memory-java',
        state: isCompleted('review-memory-java') ? 'completed' : server.javaPath ? 'ready' : 'blocked',
        blockedReason: server.javaPath ? undefined : t('onboarding.steps.review-memory-java.blockedReason'),
      },
      'start-server': {
        stepId: 'start-server',
        state: isCompleted('start-server') ? 'completed' : server.isReady === false ? 'blocked' : 'ready',
        blockedReason: server.isReady === false ? t('onboarding.steps.start-server.blockedReason') : undefined,
      },
      'review-properties': {
        stepId: 'review-properties',
        state: isCompleted('review-properties') ? 'completed' : server.hasServerProperties ? 'ready' : 'blocked',
        blockedReason: server.hasServerProperties ? undefined : t('onboarding.steps.review-properties.blockedReason'),
      },
      'review-connection': {
        stepId: 'review-connection',
        state: isCompleted('review-connection') ? 'completed' : port ? 'ready' : 'blocked',
        blockedReason: port ? undefined : t('onboarding.steps.review-connection.blockedReason'),
      },
      'create-backup': { stepId: 'create-backup', state: isCompleted('create-backup') ? 'completed' : 'ready' },
    };
    const nextStep = ONBOARDING_STEP_ORDER.find((stepId) => statuses[stepId].state === 'ready');
    if (nextStep) statuses[nextStep] = { ...statuses[nextStep], state: 'recommended' };
    return statuses;
  }, [completedSteps, port, server.hasServerProperties, server.isReady, server.javaPath, t]);

  const completedCount = ONBOARDING_STEP_ORDER.filter((stepId) => completedSteps.includes(stepId)).length;
  const totalCount = ONBOARDING_STEP_ORDER.length;
  const hasPendingSteps = completedCount < totalCount;
  const nextStepId = findNextOnboardingStep(stepStatuses);

  useEffect(() => {
    if (!onboardingState || !autoOpen || onboardingState.dismissedAt) return;
    setSelectedStepId(nextStepId);
    setIsOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpen, nextStepId, onboardingState, onAutoOpenHandled]);

  const openChecklist = useCallback(() => {
    setSelectedStepId(nextStepId);
    setIsOpen(true);
  }, [nextStepId]);

  const handleCreateBackup = useCallback(async () => {
    setIsCreatingBackup(true);
    try {
      const result = await window.electronAPI.server.createBackup({ serverId: server.id, trigger: 'manual' });
      if (!result.success) throw new Error(result.error || t('onboarding.backupFailed'));
      await refreshBackups();
      toast.add({ title: t('onboarding.backupCreated'), type: 'success' });
    } catch (error) {
      toast.add({
        title: t('onboarding.backupFailed'),
        description: (error as Error).message,
        type: 'error',
      });
    } finally {
      setIsCreatingBackup(false);
    }
  }, [refreshBackups, server.id, t]);

  const performPrimaryAction = useCallback(async (stepId: OnboardingStepId) => {
    const step = stepStatuses[stepId];
    switch (stepId) {
      case 'review-folder-core':
        await onOpenFolder?.();
        await completeStep(stepId);
        break;
      case 'review-memory-java':
        if (step.state !== 'blocked') await completeStep(stepId);
        setIsOpen(false);
        onOpenSettingsSection('basic');
        break;
      case 'start-server':
        await onStart?.();
        break;
      case 'review-properties':
        if (step.state !== 'blocked') await completeStep(stepId);
        setIsOpen(false);
        onOpenSettingsSection('gameplay');
        break;
      case 'review-connection':
        setIsConnectionHelpOpen(true);
        break;
      case 'create-backup':
        await handleCreateBackup();
        break;
    }
  }, [completeStep, handleCreateBackup, onOpenFolder, onOpenSettingsSection, onStart, stepStatuses]);

  const isStepActionDisabled = (stepId: OnboardingStepId) => {
    const step = stepStatuses[stepId];
    if (step.state === 'completed') return true;
    if (stepId === 'review-folder-core') return !onOpenFolder;
    if (stepId === 'start-server') return step.state === 'blocked' || !onStart;
    if (stepId === 'review-properties' || stepId === 'review-connection') return step.state === 'blocked';
    if (stepId === 'create-backup') return isCreatingBackup;
    return false;
  };

  const actionLabel = (stepId: OnboardingStepId) => {
    if (stepId === 'review-memory-java' && stepStatuses[stepId].state === 'blocked') return t('onboarding.resolve');
    if (stepId === 'review-properties') return t('onboarding.steps.review-properties.openGameplay');
    return t(`onboarding.steps.${stepId}.action`);
  };

  const renderStateIndicator = (step: StepStatus) => {
    if (step.state === 'completed') return <Check className="h-3.5 w-3.5" aria-hidden="true" />;
    if (step.state === 'blocked') return <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />;
    return <Circle className="h-3 w-3" aria-hidden="true" />;
  };

  if (!onboardingState) return null;
  const nextStep = stepStatuses[nextStepId];
  const NextIcon = STEP_ICONS[nextStepId];
  const selectedStep = stepStatuses[selectedStepId];
  const SelectedIcon = STEP_ICONS[selectedStepId];

  return (
    <>
      {hasPendingSteps ? (
        <section className="overflow-hidden rounded-xl border border-border/60 bg-card/35">
          <header className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40">
                <Compass className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-medium">{t('onboarding.title')}</h2>
                <p className="text-[10px] text-muted-foreground">{t('onboarding.progress', { completed: completedCount, total: totalCount })}</p>
              </div>
            </div>
            <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground/65 transition-[width] duration-200 ease-out" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
            </div>
          </header>
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/55 text-muted-foreground">
                <NextIcon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('onboarding.next')}</p>
                <p className="mt-0.5 text-sm font-medium">{t(`onboarding.steps.${nextStepId}.title`)}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {nextStep.blockedReason || t(`onboarding.steps.${nextStepId}.description`)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={openChecklist}>
                {isDismissed ? t('onboarding.reopen') : t('onboarding.viewChecklist')}
              </Button>
              <Button size="sm" className="h-8 px-3 text-xs" onClick={() => void performPrimaryAction(nextStepId)} disabled={isStepActionDisabled(nextStepId)}>
                {nextStepId === 'create-backup' && isCreatingBackup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {actionLabel(nextStepId)}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="settings-workspace-modal grid h-[min(600px,90vh)] w-[min(860px,94vw)] max-w-[860px] grid-cols-[184px_minmax(0,1fr)] grid-rows-[56px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:rounded-xl"
          overlayClassName="settings-workspace-overlay"
        >
          <header className="col-span-2 flex h-14 items-center border-b border-border/60 px-5 pr-14">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-muted/50">
                <Compass className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </div>
              <DialogTitle className="truncate text-sm font-semibold tracking-[-0.01em]">{t('onboarding.modalTitle', { server: server.name })}</DialogTitle>
              <DialogDescription className="hidden truncate text-xs sm:block">{t('onboarding.modalDescription')}</DialogDescription>
            </div>
          </header>

          <aside className="flex min-h-0 flex-col border-r border-border/60 bg-muted/20 p-2.5">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">{t('onboarding.setup')}</p>
            <nav className="modal-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {ONBOARDING_STEP_ORDER.map((stepId, index) => {
                const step = stepStatuses[stepId];
                const active = stepId === selectedStepId;
                return (
                  <button
                    key={stepId}
                    type="button"
                    onClick={() => setSelectedStepId(stepId)}
                    className={cn(
                      'settings-nav-item flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none',
                      active ? 'bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)]' : 'text-muted-foreground hover:bg-accent/55 hover:text-foreground'
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] tabular-nums', step.state === 'completed' && 'border-foreground/25 bg-foreground text-background', step.state === 'blocked' && 'border-border text-muted-foreground/55')}>
                      {step.state === 'completed' ? renderStateIndicator(step) : index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(`onboarding.steps.${stepId}.title`)}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-border/60 px-2 pt-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{t('onboarding.progressLabel')}</span><span>{completedCount}/{totalCount}</span></div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/60" style={{ width: `${(completedCount / totalCount) * 100}%` }} /></div>
              <Button variant="ghost" size="sm" className="mt-2 h-7 w-full justify-start px-1.5 text-[10px] text-muted-foreground" onClick={() => void dismissChecklist()} disabled={isPersisting}>
                <X className="h-3 w-3" />{t('onboarding.dismiss')}
              </Button>
            </div>
          </aside>

          <main className="modal-scrollbar min-h-0 min-w-0 overflow-y-auto bg-background">
            <div key={selectedStepId} className="settings-panel-enter mx-auto max-w-[620px] px-8 py-7">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{t('onboarding.stepNumber', { current: ONBOARDING_STEP_ORDER.indexOf(selectedStepId) + 1, total: totalCount })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t(`onboarding.state.${selectedStep.state}`)}</span>
                </div>
                {selectedStep.state === 'completed' ? <Badge variant="secondary" className="h-5 text-[9px]">{t('onboarding.done')}</Badge> : null}
              </div>
              <div className="mt-5 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/35">
                  <SelectedIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em]">{t(`onboarding.steps.${selectedStepId}.title`)}</h2>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{t(`onboarding.steps.${selectedStepId}.description`)}</p>
                </div>
              </div>

              {selectedStep.blockedReason ? (
                <div className="mt-6 rounded-md border border-border/70 bg-muted/25 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('onboarding.blocked')}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedStep.blockedReason}</p>
                </div>
              ) : null}

              <div className="mt-7 border-t border-border/60 pt-5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('onboarding.action')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={() => void performPrimaryAction(selectedStepId)} disabled={isStepActionDisabled(selectedStepId)}>
                    {selectedStepId === 'create-backup' && isCreatingBackup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectedIcon className="h-3.5 w-3.5" />}
                    {selectedStep.state === 'completed' ? t('onboarding.done') : actionLabel(selectedStepId)}
                  </Button>
                  {selectedStepId === 'review-properties' ? (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setIsOpen(false); onOpenSettingsSection('network'); }} disabled={selectedStep.state === 'blocked'}>
                      {t('onboarding.steps.review-properties.openNetwork')}
                    </Button>
                  ) : null}
                  {selectedStepId === 'create-backup' ? (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setIsOpen(false); onOpenSettingsSection('backup'); }}>
                      {t('onboarding.steps.create-backup.openSettings')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </main>
        </DialogContent>
      </Dialog>

      <Dialog open={isConnectionHelpOpen} onOpenChange={setIsConnectionHelpOpen}>
        <WorkspaceDialogContent className="sm:max-w-3xl">
          <WorkspaceDialogHeader title={t('onboarding.connection.title')} description={t('onboarding.connection.description')} />
          <WorkspaceDialogBody>
            <ConnectionInfoCard serverId={server.id} serverStatus={server.status} hasServerProperties={server.hasServerProperties === true} embedded />
          </WorkspaceDialogBody>
          <WorkspaceDialogFooter className="flex-row justify-end">
            <Button variant="outline" onClick={() => setIsConnectionHelpOpen(false)}>{t('common.close')}</Button>
            <Button onClick={async () => { await completeStep('review-connection'); setIsConnectionHelpOpen(false); }} disabled={!port}>{t('onboarding.markComplete')}</Button>
          </WorkspaceDialogFooter>
        </WorkspaceDialogContent>
      </Dialog>
    </>
  );
}
