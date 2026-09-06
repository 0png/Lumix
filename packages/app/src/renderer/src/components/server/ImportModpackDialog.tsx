import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileArchive, FileCheck2, Loader2, UploadCloud } from 'lucide-react';
import type {
  ImportModpackRequest,
  ImportModpackResult,
  ModpackCandidateDto,
  ModpackInstallProgressEvent,
  ModpackWarning,
} from '../../../../shared/ipc-types';
import type { CreateServerError } from '@/hooks/use-servers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { WorkspaceDialogBody, WorkspaceDialogContent, WorkspaceDialogFooter, WorkspaceDialogHeader } from '@/components/ui/workspace-dialog';

interface ImportModpackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
  onScan: (archivePath: string) => Promise<{ candidate: ModpackCandidateDto | null; error: CreateServerError | null }>;
  onImport: (data: ImportModpackRequest) => Promise<{ result: ImportModpackResult | null; error: CreateServerError | null }>;
  onImported: (result: ImportModpackResult) => void;
  embedded?: boolean;
  onBackToChoice?: () => void;
  onCloseBlockedChange?: (blocked: boolean) => void;
}

type Step = 'select' | 'review';

export function ImportModpackDialog({
  open,
  onOpenChange,
  existingNames,
  onScan,
  onImport,
  onImported,
  embedded = false,
  onBackToChoice,
  onCloseBlockedChange,
}: ImportModpackDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('select');
  const [archivePath, setArchivePath] = useState('');
  const [candidate, setCandidate] = useState<ModpackCandidateDto | null>(null);
  const [name, setName] = useState('');
  const [ramMax, setRamMax] = useState(4096);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ModpackInstallProgressEvent | null>(null);

  useEffect(() => {
    onCloseBlockedChange?.(isInstalling);
    return () => onCloseBlockedChange?.(false);
  }, [isInstalling, onCloseBlockedChange]);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setArchivePath('');
      setCandidate(null);
      setName('');
      setRamMax(4096);
      setEulaAccepted(false);
      setAllowIncomplete(false);
      setIsScanning(false);
      setIsDragging(false);
      setIsInstalling(false);
      setError(null);
      setProgress(null);
      return;
    }

    return window.electronAPI.modpack.onProgress(setProgress);
  }, [open]);

  const duplicateName = existingNames.includes(name.trim());
  const canInstall = Boolean(
    candidate?.coreType &&
    name.trim() &&
    !duplicateName &&
    eulaAccepted &&
    (candidate.canInstall || allowIncomplete)
  );

  const contentBadges = useMemo(() => {
    if (!candidate) return [];
    return [
      ['mods', candidate.content.mods],
      ['configs', candidate.content.configs],
      ['scripts', candidate.content.scripts],
      ['resourcePacks', candidate.content.resourcePacks],
      ['other', candidate.content.other],
    ] as const;
  }, [candidate]);

  const handlePickFile = async () => {
    setError(null);
    const result = await window.electronAPI.app.selectModpackFile();
    if (!result.success) {
      setError(result.error || t('modpackImport.errors.selectFile'));
      return;
    }
    if (result.data) setArchivePath(result.data);
  };

  const handleDroppedFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const filePath = file.path;
    if (!filePath || !isSupportedModpackPath(filePath)) {
      setError(t('modpackImport.errors.unsupportedFile'));
      return;
    }
    setArchivePath(filePath);
    setError(null);
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void handlePickFile();
    }
  };

  const handleScan = async () => {
    if (!archivePath.trim()) {
      setError(t('modpackImport.errors.fileRequired'));
      return;
    }
    setIsScanning(true);
    setError(null);
    try {
      const result = await onScan(archivePath.trim());
      if (!result.candidate) {
        setError(result.error ? localizeError(result.error, t) : t('modpackImport.errors.scanFailed'));
        return;
      }
      setCandidate(result.candidate);
      setName(result.candidate.name);
      setStep('review');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async () => {
    if (!candidate || !canInstall) return;
    setIsInstalling(true);
    setError(null);
    setProgress({ stage: 'preparing', completed: 0, total: 1, percentage: 0, message: '' });
    try {
      const response = await onImport({
        archivePath: candidate.archivePath,
        name: name.trim(),
        eulaAccepted,
        ramMin: 1024,
        ramMax,
        allowIncomplete,
      });
      if (!response.result) {
        setError(response.error ? localizeError(response.error, t) : t('modpackImport.errors.installFailed'));
        return;
      }
      onImported(response.result);
      onCloseBlockedChange?.(false);
      onOpenChange(false);
    } finally {
      setIsInstalling(false);
    }
  };

  const shell = (
    <div className="grid max-h-[94vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-background">
        <WorkspaceDialogHeader
          title={t('modpackImport.title')}
          description={step === 'select' ? t('modpackImport.selectDescription') : t('modpackImport.reviewDescription')}
          onBack={embedded && !isInstalling ? onBackToChoice : undefined}
          backLabel={t('addServerChoice.backToMethods')}
        />

        <WorkspaceDialogBody>
        {step === 'select' ? (
          <div className="space-y-3 py-2">
            <Label>{t('modpackImport.file')}</Label>
            <div
              data-flow-autofocus
              role="button"
              tabIndex={0}
              aria-label={t('modpackImport.dropzoneLabel')}
              onClick={() => void handlePickFile()}
              onKeyDown={handleDropzoneKeyDown}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
              }}
              onDrop={handleDroppedFile}
              className={cn(
                'group relative flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-6 py-8 text-center transition-[background-color,border-color,box-shadow,transform] [transition-duration:var(--motion-panel)] [transition-timing-function:var(--ease-interface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none',
                isDragging
                  ? 'scale-[1.01] border-primary bg-primary/10 shadow-lg shadow-primary/10'
                  : archivePath
                    ? 'border-emerald-500/40 bg-emerald-500/[0.06] hover:border-emerald-500/60'
                    : 'border-border bg-secondary/20 hover:border-primary/45 hover:bg-primary/[0.04]'
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
              <div className={cn(
                'relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-[background-color,border-color] [transition-duration:var(--motion-standard)]',
                archivePath
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-primary/20 bg-primary/10 text-primary'
              )}>
                {archivePath ? <FileCheck2 className="h-7 w-7" aria-hidden="true" /> : <UploadCloud className="h-7 w-7" aria-hidden="true" />}
              </div>

              {archivePath ? (
                <div className="relative max-w-full space-y-1">
                  <p className="truncate font-semibold">{getFileName(archivePath)}</p>
                  <p className="max-w-lg truncate text-xs text-muted-foreground">{archivePath}</p>
                  <span className="mt-3 inline-flex rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {t('modpackImport.changeFile')}
                  </span>
                </div>
              ) : (
                <div className="relative space-y-2">
                  <p className="font-semibold">{isDragging ? t('modpackImport.dropNow') : t('modpackImport.dropTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('modpackImport.dropDescription')}</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Badge variant="outline">.mrpack</Badge>
                    <Badge variant="outline">.zip</Badge>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{t('modpackImport.dropHint')}</p>
          </div>
        ) : candidate ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="modpack-server-name">{t('server.name')}</Label>
                <Input id="modpack-server-name" value={name} onChange={(event) => setName(event.target.value)} disabled={isInstalling} />
                {duplicateName ? <p className="text-xs text-destructive">{t('modpackImport.errors.duplicateName')}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="modpack-ram">{t('modpackImport.ram')}</Label>
                <Input
                  id="modpack-ram"
                  type="number"
                  min={2048}
                  step={512}
                  value={ramMax}
                  onChange={(event) => setRamMax(Math.max(2048, Number(event.target.value) || 2048))}
                  disabled={isInstalling}
                />
              </div>
            </div>

            <Card className="bg-secondary/30">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileArchive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {candidate.name}
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <InfoRow label={t('modpackImport.format')} value={t(`modpackImport.formats.${candidate.format}`)} />
                  <InfoRow label={t('server.version')} value={candidate.mcVersion} />
                  <InfoRow label={t('server.coreType')} value={candidate.coreType ? t(`coreType.${candidate.coreType}`) : t('modpackImport.unsupported')} />
                  <InfoRow label={t('modpackImport.loaderVersion')} value={candidate.loaderVersion || '—'} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {contentBadges.map(([key, count]) => (
                    <Badge key={key} variant={count > 0 ? 'secondary' : 'outline'}>
                      {t(`modpackImport.content.${key}`)} {count}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('modpackImport.fileSummary', {
                    downloadable: candidate.downloadableFiles,
                    included: candidate.includedFiles,
                    clientOnly: candidate.clientOnlyFiles,
                  })}
                </p>
              </CardContent>
            </Card>

            {candidate.warnings.length > 0 ? (
              <Card className="border-amber-500/35 bg-amber-500/5">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    {t('modpackImport.warnings')}
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {candidate.warnings.map((warning, index) => (
                      <li key={`${warning.code}-${index}`}>• {formatWarning(warning, t)}</li>
                    ))}
                  </ul>
                  {candidate.unresolvedFiles > 0 ? (
                    <label className="flex items-start gap-2 pt-2 text-sm">
                      <Checkbox
                        checked={allowIncomplete}
                        onCheckedChange={(checked) => setAllowIncomplete(checked === true)}
                        disabled={isInstalling}
                      />
                      <span>{t('modpackImport.allowIncomplete')}</span>
                    </label>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t('modpackImport.ready')}
              </div>
            )}

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={eulaAccepted}
                onCheckedChange={(checked) => setEulaAccepted(checked === true)}
                disabled={isInstalling}
              />
              <span>{t('modpackImport.acceptEula')}</span>
            </label>

            {isInstalling && progress ? (
              <div className="space-y-2 rounded-lg border bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{t(`modpackImport.progress.${progress.stage}`)}</span>
                  <span className="text-muted-foreground">{progress.percentage}%</span>
                </div>
                <Progress value={progress.percentage} />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </WorkspaceDialogBody>

        <WorkspaceDialogFooter>
          {step === 'review' && !isInstalling ? (
            <Button variant="outline" onClick={() => setStep('select')}>{t('common.back')}</Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isScanning || isInstalling}>
            {t('common.cancel')}
          </Button>
          {step === 'select' ? (
            <Button onClick={handleScan} disabled={isScanning}>
              {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t('modpackImport.scan')}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={!canInstall || isInstalling}>
              {isInstalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t('modpackImport.install')}
            </Button>
          )}
        </WorkspaceDialogFooter>
    </div>
  );

  if (embedded) {
    return open ? shell : null;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isInstalling && onOpenChange(next)}>
      <WorkspaceDialogContent className="max-w-[92vw] sm:max-w-3xl">
        {shell}
      </WorkspaceDialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function formatWarning(warning: ModpackWarning, t: ReturnType<typeof useTranslation>['t']): string {
  return t(`modpackImport.warningMessages.${warning.code}`, {
    count: warning.count,
    loader: warning.loader,
  });
}

function localizeError(error: CreateServerError, t: ReturnType<typeof useTranslation>['t']): string {
  const keys: Partial<Record<CreateServerError['code'], string>> = {
    MODPACK_INVALID_ARCHIVE: 'invalidArchive',
    MODPACK_UNSUPPORTED_FORMAT: 'unsupportedFormat',
    MODPACK_UNSUPPORTED_LOADER: 'unsupportedLoader',
    MODPACK_INCOMPLETE: 'incomplete',
    MODPACK_INSTALL_FAILED: 'installFailed',
    JAVA_NOT_FOUND: 'noJava',
    SERVER_DUPLICATE_NAME: 'duplicateName',
  };
  const key = keys[error.code];
  return key ? t(`modpackImport.errors.${key}`) : error.message;
}

function isSupportedModpackPath(filePath: string): boolean {
  return /\.(mrpack|zip)$/i.test(filePath);
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}
