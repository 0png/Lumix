import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VersionCombobox } from '@/components/ui/version-combobox';
import type { CoreType } from './ServerList';
import type { CreateServerError } from '@/hooks/use-servers';
import { IpcErrorCode } from '../../../../shared/ipc-types';

const MOJANG_EULA_URL = 'https://aka.ms/MinecraftEULA';

export interface CreateServerData {
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin: number;
  ramMax: number;
}

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateServerData) => Promise<CreateServerError | null>;
  disabled?: boolean;
  existingNames?: string[];
}

const CORE_TYPES: CoreType[] = ['vanilla', 'paper', 'fabric', 'forge'];

export function CreateServerDialog({
  open,
  onOpenChange,
  onSubmit,
  disabled = false,
  existingNames = [],
}: CreateServerDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [coreType, setCoreType] = useState<CoreType>('paper');
  const [mcVersion, setMcVersion] = useState('');
  const [ramMax, setRamMax] = useState(2048);
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);

  const fetchVersions = useCallback(async (type: CoreType) => {
    setLoading(true);
    setError(null);
    setVersions([]);
    setMcVersion('');

    try {
      // Use IPC to fetch versions from main process (bypasses CSP)
      const result = await window.electronAPI.download.fetchVersions(type);
      
      if (result.success && result.data) {
        console.log(`Fetched ${result.data.versions.length} versions for ${type}`);
        setVersions(result.data.versions);
        if (result.data.versions.length > 0) {
          setMcVersion(result.data.versions[0]!);
        }
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

  // Fetch versions when dialog opens or core type changes
  useEffect(() => {
    if (open) {
      console.log('Dialog opened, fetching versions for:', coreType);
      fetchVersions(coreType);
    }
  }, [open, coreType, fetchVersions]);

  const handleCoreTypeChange = (value: string) => {
    const newType = value as CoreType;
    setCoreType(newType);
  };

  // 驗證名稱是否重複（前端即時驗證）
  const validateName = useCallback((inputName: string) => {
    const trimmed = inputName.trim();
    if (!trimmed) {
      setNameError(null);
      return;
    }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setNameError(t('toast.duplicateServerName'));
    } else {
      setNameError(null);
    }
  }, [existingNames, t]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    validateName(value);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !mcVersion || nameError) return;
    
    setIsSubmitting(true);
    const submitError = await onSubmit({
      name: name.trim(),
      coreType,
      mcVersion,
      ramMin: Math.floor(ramMax / 2),
      ramMax,
    });

    if (submitError) {
      // 處理後端回傳的錯誤
      if (submitError.code === IpcErrorCode.SERVER_DUPLICATE_NAME) {
        setNameError(t('toast.duplicateServerName'));
      } else if (submitError.code === IpcErrorCode.SERVER_INVALID_NAME) {
        setNameError(t('toast.invalidServerName'));
      }
      setIsSubmitting(false);
      return;
    }

    // 成功，重置表單
    setName('');
    setCoreType('paper');
    setMcVersion('');
    setRamMax(2048);
    setNameError(null);
    setEulaAccepted(false);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createServer.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('server.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder={t('createServer.namePlaceholder')}
              className={nameError ? 'border-destructive' : ''}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('server.coreType')}</Label>
            <Select value={coreType} onValueChange={handleCoreTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('createServer.selectCore')} />
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('createServer.maxRam')}</Label>
              <span className="text-sm text-muted-foreground">{ramMax} MB</span>
            </div>
            <Slider
              value={[ramMax]}
              onValueChange={(values) => values[0] !== undefined && setRamMax(values[0])}
              min={512}
              max={16384}
              step={512}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>512 MB</span>
              <span>16 GB</span>
            </div>
          </div>

          {/* EULA Agreement */}
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="eula"
              checked={eulaAccepted}
              onCheckedChange={(checked) => setEulaAccepted(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="eula"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t('createServer.eulaAgree')}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('createServer.eulaDescription')}{' '}
                <a
                  href={MOJANG_EULA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                  onClick={(e) => {
                    e.preventDefault();
                    window.electronAPI.app.openExternal(MOJANG_EULA_URL);
                  }}
                >
                  Minecraft EULA
                </a>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name.trim() || !mcVersion || loading || disabled || !!nameError || isSubmitting || !eulaAccepted}
          >
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
