import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FolderInput, HardDrive, Loader2 } from 'lucide-react';
import type { CoreType, ImportCandidateDto, ImportServerRequest } from '../../../../shared/ipc-types';
import type { CreateServerError } from '@/hooks/use-servers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ImportServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  existingNames: string[];
  onDetect: (directory: string) => Promise<ImportCandidateDto | null>;
  onImport: (data: ImportServerRequest) => Promise<CreateServerError | null>;
}

const CORE_TYPES: CoreType[] = ['vanilla', 'paper', 'fabric', 'forge'];

type Step = 'select' | 'review';

export function ImportServerDialog({
  open,
  onOpenChange,
  disabled = false,
  existingNames,
  onDetect,
  onImport,
}: ImportServerDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('select');
  const [candidate, setCandidate] = useState<ImportCandidateDto | null>(null);
  const [directory, setDirectory] = useState('');
  const [name, setName] = useState('');
  const [coreType, setCoreType] = useState<CoreType | ''>('');
  const [mcVersion, setMcVersion] = useState('');
  const [launchJarPath, setLaunchJarPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setCandidate(null);
      setDirectory('');
      setName('');
      setCoreType('');
      setMcVersion('');
      setLaunchJarPath('');
      setError(null);
      setIsScanning(false);
      setIsSubmitting(false);
    }
  }, [open]);

  const canSubmit = Boolean(
    candidate &&
    name.trim() &&
    coreType &&
    mcVersion.trim() &&
    launchJarPath &&
    !existingNames.includes(name.trim())
  );

  const infoRows = useMemo(() => {
    if (!candidate) return [];
    return [
      { label: t('serverImport.review.directory'), value: candidate.directory },
      { label: t('serverImport.review.eula'), value: candidate.eulaAccepted ? t('common.yes') : t('common.no') },
      { label: t('serverImport.review.properties'), value: candidate.hasServerProperties ? t('common.yes') : t('common.no') },
      { label: t('serverImport.review.worldData'), value: candidate.hasWorldData ? t('common.yes') : t('common.no') },
      { label: t('serverImport.review.playerData'), value: candidate.hasUserCache || candidate.hasOpsFile || candidate.hasWhitelistFile ? t('common.yes') : t('common.no') },
    ];
  }, [candidate, t]);

  const handlePickDirectory = async () => {
    setError(null);
    const result = await window.electronAPI.app.selectDirectory();
    if (!result.success) {
      setError(result.error || t('serverImport.errors.selectDirectory'));
      return;
    }
    if (result.data) {
      setDirectory(result.data);
    }
  };

  const handleScan = async () => {
    if (!directory.trim()) {
      setError(t('serverImport.errors.directoryRequired'));
      return;
    }

    setIsScanning(true);
    setError(null);
    try {
      const result = await onDetect(directory.trim());
      if (!result) {
        setError(t('serverImport.errors.scanFailed'));
        return;
      }

      setCandidate(result);
      setDirectory(result.directory);
      setName(result.suggestedName);
      setCoreType(result.detectedCoreType ?? '');
      setMcVersion(result.detectedMcVersion ?? '');
      setLaunchJarPath(result.serverJarPath ?? result.jarCandidates[0] ?? '');
      setStep('review');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async () => {
    if (!candidate || !coreType) return;
    if (existingNames.includes(name.trim())) {
      setError(t('serverImport.errors.duplicateName'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const importError = await onImport({
        directory: candidate.directory,
        name: name.trim(),
        coreType,
        mcVersion: mcVersion.trim(),
        launchJarPath,
        eulaAccepted: candidate.eulaAccepted,
      });

      if (importError) {
        setError(importError.message);
        return;
      }

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" aria-hidden="true" />
            {t('serverImport.title')}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' ? t('serverImport.selectDescription') : t('serverImport.reviewDescription')}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="import-directory">{t('serverImport.directory')}</Label>
              <div className="flex gap-2">
                <Input
                  id="import-directory"
                  value={directory}
                  onChange={(event) => setDirectory(event.target.value)}
                  placeholder={t('serverImport.directoryPlaceholder')}
                />
                <Button variant="outline" onClick={handlePickDirectory} disabled={disabled || isScanning}>
                  {t('serverImport.browse')}
                </Button>
              </div>
            </div>
          </div>
        ) : candidate ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="import-name">{t('server.name')}</Label>
                <Input id="import-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('server.coreType')}</Label>
                <Select value={coreType} onValueChange={(value) => setCoreType(value as CoreType)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('serverImport.review.selectCoreType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CORE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`coreType.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-mc-version">{t('server.version')}</Label>
                <Input id="import-mc-version" value={mcVersion} onChange={(event) => setMcVersion(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('serverImport.review.launchJar')}</Label>
                <Select value={launchJarPath} onValueChange={setLaunchJarPath}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('serverImport.review.selectJar')} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidate.jarCandidates.map((jarPath) => (
                      <SelectItem key={jarPath} value={jarPath}>
                        {jarPath}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card className="bg-secondary/30">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {t('serverImport.review.detectedInfo')}
                  </div>
                  {infoRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="text-right">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant={candidate.hasPluginsFolder ? 'secondary' : 'outline'}>{t('serverImport.review.plugins')}</Badge>
                    <Badge variant={candidate.hasModsFolder ? 'secondary' : 'outline'}>{t('serverImport.review.mods')}</Badge>
                    <Badge variant={candidate.hasLibrariesFolder ? 'secondary' : 'outline'}>{t('serverImport.review.libraries')}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary/20">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {candidate.warnings.length === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    )}
                    {t('serverImport.review.warnings')}
                  </div>
                  {candidate.warnings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('serverImport.review.noWarnings')}</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {candidate.warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2">
          {step === 'review' ? (
            <Button variant="outline" onClick={() => setStep('select')} disabled={isSubmitting}>
              {t('common.back')}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isScanning || isSubmitting}>
            {t('common.cancel')}
          </Button>
          {step === 'select' ? (
            <Button onClick={handleScan} disabled={disabled || isScanning}>
              {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t('serverImport.scan')}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={disabled || isSubmitting || !canSubmit}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t('serverImport.confirmImport')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
