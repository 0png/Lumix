import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Cpu,
  Folder,
  HardDrive,
  Layers3,
  ScrollText,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { VersionCombobox } from '@/components/ui/version-combobox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useJava } from '@/hooks/use-java';
import { cn } from '@/lib/utils';
import type { CoreType } from './ServerList';
import { ServerCoreIcon } from './ServerCoreIcon';
import type { CreateServerError } from '@/hooks/use-servers';
import { IpcErrorCode, type SystemInfo } from '../../../../shared/ipc-types';

const MOJANG_EULA_URL = 'https://aka.ms/MinecraftEULA';

export interface CreateServerData {
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin: number;
  ramMax: number;
  javaPath?: string;
}

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateServerData) => Promise<CreateServerError | null>;
  disabled?: boolean;
  existingNames?: string[];
  presentation?: 'modal' | 'overlay';
}

type WizardStep = 0 | 1 | 2 | 3 | 4;

const CORE_TYPES: CoreType[] = ['vanilla', 'paper', 'fabric', 'forge'];

function getInstallableJavaVersion(requiredJava: number): 8 | 17 | 21 | 25 {
  if (requiredJava >= 25) return 25;
  if (requiredJava >= 21) return 21;
  if (requiredJava >= 16) return 17;
  return 8;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getFolderPreview(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[\\/]+/).filter(Boolean);
  const basename = parts[parts.length - 1] ?? '';
  if (!basename || basename === '.' || basename === '..') return '';
  return basename;
}

function getSafeMaxRamMb(systemInfo: SystemInfo | null): number {
  if (!systemInfo) return 8192;

  const reserveForWindows = systemInfo.totalMemoryMb <= 8192 ? 2048 : 3072;
  const ceiling = Math.min(
    systemInfo.totalMemoryMb - reserveForWindows,
    Math.floor(systemInfo.totalMemoryMb * 0.6)
  );

  return clamp(roundToStep(ceiling, 512), 2048, 16384);
}

function getRecommendedRamMb(coreType: CoreType, systemInfo: SystemInfo | null): number {
  const safeMax = getSafeMaxRamMb(systemInfo);
  const cpuThreads = systemInfo?.cpuThreads ?? 4;

  let base = 2048;
  switch (coreType) {
    case 'vanilla':
      base = 2048;
      break;
    case 'paper':
      base = 3072;
      break;
    case 'fabric':
      base = 4096;
      break;
    case 'forge':
      base = 6144;
      break;
  }

  if (cpuThreads >= 12) base += 1024;
  if (cpuThreads <= 4) base -= 512;

  return clamp(roundToStep(base, 512), 1024, safeMax);
}

function getRamTier(ramMb: number, recommendedMb: number): 'safe' | 'warning' {
  return ramMb <= recommendedMb ? 'safe' : 'warning';
}

export function CreateServerDialog({
  open,
  onOpenChange,
  onSubmit,
  disabled = false,
  existingNames = [],
  presentation = 'modal',
}: CreateServerDialogProps) {
  const { t } = useTranslation();
  const { installations, getRequiredVersion, install, installProgress, selectForMc } = useJava();
  const [step, setStep] = useState<WizardStep>(0);
  const [name, setName] = useState('');
  const [coreType, setCoreType] = useState<CoreType>('paper');
  const [mcVersion, setMcVersion] = useState('');
  const [ramMax, setRamMax] = useState(3072);
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [ramTouched, setRamTouched] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  const [requiredJava, setRequiredJava] = useState<number | null>(null);
  const [javaCompatible, setJavaCompatible] = useState(true);
  const [isInstallingJava, setIsInstallingJava] = useState(false);
  const [javaInstallRetries, setJavaInstallRetries] = useState(0);
  const MAX_JAVA_INSTALL_RETRIES = 3;

  const steps = useMemo(
    () => [
      {
        title: t('createServer.steps.name.title'),
        description: t('createServer.steps.name.description'),
      },
      {
        title: t('createServer.steps.core.title'),
        description: t('createServer.steps.core.description'),
      },
      {
        title: t('createServer.steps.ram.title'),
        description: t('createServer.steps.ram.description'),
      },
      {
        title: t('createServer.steps.eula.title'),
        description: t('createServer.steps.eula.description'),
      },
      {
        title: t('createServer.steps.review.title'),
        description: t('createServer.steps.review.description'),
      },
    ],
    [t]
  );

  const safeMaxRam = useMemo(() => getSafeMaxRamMb(systemInfo), [systemInfo]);
  const recommendedRam = useMemo(
    () => getRecommendedRamMb(coreType, systemInfo),
    [coreType, systemInfo]
  );
  const folderPreview = useMemo(() => getFolderPreview(name), [name]);
  const installableJava = requiredJava ? getInstallableJavaVersion(requiredJava) : null;
  const ramTier = getRamTier(ramMax, recommendedRam);
  const progressValue = ((step + 1) / steps.length) * 100;
  const currentStepMeta = steps[step]!;

  const resetForm = useCallback(() => {
    setStep(0);
    setName('');
    setCoreType('paper');
    setMcVersion('');
    setRamMax(3072);
    setVersions([]);
    setLoading(false);
    setError(null);
    setNameError(null);
    setIsSubmitting(false);
    setEulaAccepted(false);
    setRamTouched(false);
    setRequiredJava(null);
    setJavaCompatible(true);
    setIsInstallingJava(false);
    setJavaInstallRetries(0);
  }, []);

  const fetchVersions = useCallback(async (type: CoreType) => {
    setLoading(true);
    setError(null);
    setVersions([]);
    setMcVersion('');

    try {
      const result = await window.electronAPI.download.fetchVersions(type);
      if (result.success && result.data) {
        setVersions(result.data.versions);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSystemInfo = useCallback(async () => {
    try {
      const result = await window.electronAPI.app.getSystemInfo();
      if (result.success && result.data) {
        setSystemInfo(result.data);
      }
    } catch (err) {
      console.error('Failed to load system info:', err);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchVersions(coreType);
    fetchSystemInfo();
  }, [open, coreType, fetchSystemInfo, fetchVersions]);

  useEffect(() => {
    if (!open) return;
    if (!ramTouched) {
      setRamMax(recommendedRam);
    }
  }, [open, recommendedRam, ramTouched]);

  useEffect(() => {
    if (!mcVersion) {
      setRequiredJava(null);
      setJavaCompatible(true);
      return;
    }

    getRequiredVersion(mcVersion).then((result) => {
      if (!result) return;
      setRequiredJava(result.requiredMajor);

      let hasCompatible = false;
      if (result.requiredMajor === 8) {
        hasCompatible = installations.some((java) => java.majorVersion === 8);
      } else {
        hasCompatible = installations.some((java) => java.majorVersion >= result.requiredMajor);
      }
      setJavaCompatible(hasCompatible);
    });
  }, [getRequiredVersion, installations, mcVersion]);

  const validateName = useCallback(
    (inputName: string) => {
      const trimmed = inputName.trim();
      if (!trimmed) {
        setNameError(null);
        return;
      }

      if (!getFolderPreview(trimmed)) {
        setNameError(t('toast.invalidServerName'));
        return;
      }

      if (existingNames.some((existingName) => existingName.toLowerCase() === trimmed.toLowerCase())) {
        setNameError(t('toast.duplicateServerName'));
        return;
      }

      setNameError(null);
    },
    [existingNames, t]
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    validateName(value);
  };

  const handleInstallJava = async () => {
    if (!requiredJava || isInstallingJava) return;
    if (javaInstallRetries >= MAX_JAVA_INSTALL_RETRIES) {
      setError(t('createServer.javaInstallMaxRetries', { max: MAX_JAVA_INSTALL_RETRIES }));
      return;
    }

    setIsInstallingJava(true);
    try {
      const version = getInstallableJavaVersion(requiredJava);
      const success = await install(version);
      if (!success) {
        setJavaInstallRetries((prev) => prev + 1);
        setError(t('createServer.javaInstallFailed'));
      } else {
        setJavaInstallRetries(0);
        setError(null);
      }
    } catch (err) {
      setJavaInstallRetries((prev) => prev + 1);
      setError(err instanceof Error ? err.message : t('createServer.javaInstallFailed'));
    } finally {
      setIsInstallingJava(false);
    }
  };

  const canGoNext = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(name.trim()) && !nameError && Boolean(folderPreview);
      case 1:
        return Boolean(mcVersion) && !loading;
      case 2:
        return ramMax >= 1024 && ramMax <= safeMaxRam;
      case 3:
        return eulaAccepted;
      default:
        return true;
    }
  }, [eulaAccepted, folderPreview, loading, mcVersion, name, nameError, ramMax, safeMaxRam, step]);

  const handleSubmit = async () => {
    if (!name.trim() || !mcVersion || nameError || !eulaAccepted) return;

    setIsSubmitting(true);
    setError(null);

    const selectedJava = await selectForMc(mcVersion);
    const requiredVersion = await getRequiredVersion(mcVersion);
    if (requiredVersion?.requiredMajor === 8 && !selectedJava) {
      setError(t('createServer.java8Required'));
      setIsSubmitting(false);
      return;
    }

    const submitError = await onSubmit({
      name: name.trim(),
      coreType,
      mcVersion,
      ramMin: Math.max(1024, Math.floor(ramMax / 2)),
      ramMax,
      javaPath: selectedJava?.path,
    });

    if (submitError) {
      if (submitError.code === IpcErrorCode.SERVER_DUPLICATE_NAME) {
        setNameError(t('toast.duplicateServerName'));
        setStep(0);
      } else if (submitError.code === IpcErrorCode.SERVER_INVALID_NAME) {
        setNameError(t('toast.invalidServerName'));
        setStep(0);
      } else {
        setError(submitError.message);
      }
      setIsSubmitting(false);
      return;
    }

    resetForm();
    onOpenChange(false);
  };

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const renderNameStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="server-name">{t('server.name')}</Label>
        <Input
          id="server-name"
          value={name}
          onChange={handleNameChange}
          placeholder={t('createServer.namePlaceholder')}
          className={nameError ? 'border-destructive' : ''}
        />
        {nameError ? (
          <p className="text-sm text-destructive">{nameError}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('createServer.nameHint')}</p>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Folder className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">{t('createServer.folderPreview')}</p>
            <p className="break-all font-mono text-sm text-foreground">
              {folderPreview || t('createServer.folderPreviewEmpty')}
            </p>
            <p className="text-xs text-muted-foreground">{t('createServer.folderPreviewHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCoreStep = () => (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CORE_TYPES.map((type) => {
          const selected = coreType === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => setCoreType(type)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border/60 bg-background hover:border-primary/40 hover:bg-muted/20'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <ServerCoreIcon coreType={type} />
                {selected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-1">
                <p className="font-medium">{t(`coreType.${type}`)}</p>
                <p className="text-sm text-muted-foreground">{t(`createServer.core.${type}.description`)}</p>
                <p className="text-xs text-muted-foreground">{t(`createServer.core.${type}.usage`)}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label>{t('server.version')}</Label>
        <VersionCombobox
          versions={versions}
          value={mcVersion}
          onValueChange={setMcVersion}
          placeholder={t('createServer.selectVersion')}
          searchPlaceholder={t('createServer.searchVersion')}
          emptyText={error || t('createServer.noVersionFound')}
          loading={loading}
        />
      </div>

      {mcVersion && requiredJava && (
        <div
          className={cn(
            'rounded-lg border p-4 text-sm',
            javaCompatible
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          )}
        >
          {javaCompatible ? (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{t('createServer.javaRequired', { version: requiredJava })}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                <span>{t('createServer.javaNotFound', { version: requiredJava })}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInstallJava}
                disabled={isInstallingJava}
              >
                {isInstallingJava
                  ? `${t('createServer.installingJava')} ${installProgress.get(installableJava!) || 0}%`
                  : t('createServer.installJava', { version: installableJava })}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRamStep = () => (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('createServer.systemRam')}</p>
              <p className="text-lg font-semibold">
                {systemInfo ? t('createServer.memoryValue', { value: (systemInfo.totalMemoryMb / 1024).toFixed(1) }) : '--'}
              </p>
              <p className="text-xs text-muted-foreground">{t('createServer.safeRamLimit', { value: safeMaxRam / 1024 })}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Cpu className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('createServer.systemCpu')}</p>
              <p className="text-lg font-semibold">
                {systemInfo ? t('createServer.cpuValue', { value: systemInfo.cpuThreads }) : '--'}
              </p>
              <p className="text-xs text-muted-foreground">{t(`createServer.ramProfiles.${coreType}`)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('createServer.recommendedRam')}</p>
            <p className="text-xs text-muted-foreground">{t('createServer.ramRecommendationHint')}</p>
          </div>
          <Badge variant="secondary">{recommendedRam / 1024} GB</Badge>
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('createServer.maxRam')}</Label>
            <span className="text-sm font-medium">{(ramMax / 1024).toFixed(ramMax % 1024 === 0 ? 0 : 1)} GB</span>
          </div>
          <Slider
            value={[ramMax]}
            onValueChange={(values) => {
              if (values[0] === undefined) return;
              setRamTouched(true);
              setRamMax(values[0]);
            }}
            min={1024}
            max={safeMaxRam}
            step={512}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 GB</span>
            <span>{safeMaxRam / 1024} GB</span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'rounded-lg border p-4 text-sm',
          ramTier === 'safe'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        )}
      >
        <div className="flex items-start gap-2">
          {ramTier === 'safe' ? (
            <Sparkles className="mt-0.5 h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          )}
          <div className="space-y-1">
            <p className="font-medium">
              {ramTier === 'safe'
                ? t('createServer.ramRecommendationSafe')
                : t('createServer.ramRecommendationWarning')}
            </p>
            <p>{t('createServer.ramRecommendationMessage', { recommended: recommendedRam / 1024, safeMax: safeMaxRam / 1024 })}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEulaStep = () => (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ScrollText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="font-medium">{t('createServer.eulaTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('createServer.eulaDescriptionLong')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await window.electronAPI.app.openExternal(MOJANG_EULA_URL);
                } catch (err) {
                  console.error('Failed to open external URL:', err);
                }
              }}
            >
              {t('createServer.openEula')}
            </Button>
          </div>
        </div>
      </div>

      <label
        htmlFor="eula"
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-4 transition-colors hover:bg-muted/20"
      >
        <Checkbox
          id="eula"
          checked={eulaAccepted}
          onCheckedChange={(checked) => setEulaAccepted(checked === true)}
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('createServer.eulaAgree')}</p>
          <p className="text-xs text-muted-foreground">{t('createServer.eulaManualConfirm')}</p>
        </div>
      </label>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { label: t('server.name'), value: name.trim() || '--', icon: Folder },
          { label: t('server.coreType'), value: t(`coreType.${coreType}`), icon: Wrench },
          { label: t('server.version'), value: mcVersion || '--', icon: Layers3 },
          { label: t('server.ram'), value: `${ramMax / 1024} GB`, icon: HardDrive },
          {
            label: t('createServer.review.javaRequirement'),
            value: requiredJava ? t('createServer.review.javaRequirementValue', { version: requiredJava }) : t('createServer.review.javaRequirementPending'),
            icon: Cpu,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!javaCompatible && requiredJava && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          {t('createServer.review.javaCompatibilityWarning', { version: requiredJava })}
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderNameStep();
      case 1:
        return renderCoreStep();
      case 2:
        return renderRamStep();
      case 3:
        return renderEulaStep();
      case 4:
        return renderReviewStep();
    }
  };

  const isOverlay = presentation === 'overlay';
  const shell = (
    <div
      className={cn(
        'grid h-full min-h-0 overflow-hidden bg-background',
        isOverlay ? 'grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[300px_minmax(0,1fr)] md:grid-rows-1' : 'max-h-[94vh] md:grid-cols-[260px_minmax(0,1fr)]'
      )}
    >
      <aside className="modal-scrollbar max-h-[32vh] overflow-y-auto border-b border-border/60 bg-muted/20 p-4 pr-3 sm:p-5 md:max-h-none md:border-b-0 md:border-r md:p-6">
        <div className="space-y-2 text-left">
          <h1 className="text-lg font-semibold leading-none tracking-tight">{t('createServer.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('createServer.wizardDescription')}</p>
        </div>

        <div className="mt-6 space-y-3">
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {t('createServer.progressLabel', { current: step + 1, total: steps.length })}
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {steps.map((item, index) => {
            const isActive = index === step;
            const isComplete = index < step;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  if (index <= step) {
                    setStep(index as WizardStep);
                  }
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                  isActive ? 'bg-background shadow-sm' : 'hover:bg-background/60',
                  index > step && 'cursor-default opacity-75'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isComplete
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground'
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="modal-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 md:px-6">
          <div className={cn('mx-auto space-y-6', isOverlay ? 'max-w-4xl' : 'max-w-3xl')}>
            <div className="space-y-2">
              <Badge variant="secondary">{currentStepMeta.title}</Badge>
              <div>
                <h2 className="text-xl font-semibold">{currentStepMeta.title}</h2>
                <p className="text-sm text-muted-foreground">{currentStepMeta.description}</p>
              </div>
            </div>

            <Separator />

            {renderCurrentStep()}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse border-t border-border/60 px-4 py-3 sm:flex-row sm:justify-between sm:space-x-0 sm:px-5 sm:py-4 md:px-6">
          <div className="hidden items-center text-xs text-muted-foreground md:flex">
            {step === 4
              ? t('createServer.reviewHint')
              : t('createServer.stepHint', { step: currentStepMeta.title })}
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-full sm:flex-row sm:justify-end md:w-auto">
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              {t('common.cancel')}
            </Button>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((prev) => (prev - 1) as WizardStep)}>
                {t('common.back')}
              </Button>
            )}
            {step < 4 ? (
              <Button
                onClick={() => setStep((prev) => (prev + 1) as WizardStep)}
                disabled={!canGoNext}
              >
                {t('createServer.next')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={disabled || isSubmitting || !eulaAccepted}>
                {t('createServer.createServer')}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  if (!open) return null;

  if (isOverlay) {
    return <div className="h-full w-full">{shell}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-5xl">
        {shell}
      </DialogContent>
    </Dialog>
  );
}
