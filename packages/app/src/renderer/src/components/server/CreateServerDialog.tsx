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
import { useJava } from '@/hooks/use-java';
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
  const { installations, getRequiredVersion, install, installProgress } = useJava();
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
  
  // Java 版本需求狀態
  const [requiredJava, setRequiredJava] = useState<number | null>(null);
  const [javaCompatible, setJavaCompatible] = useState<boolean>(true);
  const [isInstallingJava, setIsInstallingJava] = useState(false);

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

  // 檢查 Java 版本需求
  useEffect(() => {
    if (!mcVersion) {
      setRequiredJava(null);
      setJavaCompatible(true);
      return;
    }
    
    getRequiredVersion(mcVersion).then((result) => {
      if (result) {
        setRequiredJava(result.requiredMajor);
        // 檢查是否有相容的 Java
        // 對於 Java 8 需求，必須有 Java 8（新版 Java 不相容舊版 MC）
        // 對於其他版本，可以使用更新的 Java
        let hasCompatible: boolean;
        if (result.requiredMajor === 8) {
          hasCompatible = installations.some((j) => j.majorVersion === 8);
        } else {
          hasCompatible = installations.some((j) => j.majorVersion >= result.requiredMajor);
        }
        setJavaCompatible(hasCompatible);
      }
    });
  }, [mcVersion, installations, getRequiredVersion]);

  // 安裝 Java
  const handleInstallJava = async () => {
    if (!requiredJava) return;
    setIsInstallingJava(true);
    const version = requiredJava >= 21 ? 21 : requiredJava >= 17 ? 17 : 8;
    await install(version as 8 | 17 | 21);
    setIsInstallingJava(false);
  };

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
            {/* Java 版本需求提示 */}
            {mcVersion && requiredJava && (
              <div className={`text-sm p-2 rounded ${javaCompatible ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'}`}>
                {javaCompatible ? (
                  <span>✓ {t('createServer.javaRequired', { version: requiredJava })}</span>
                ) : (
                  <div className="space-y-2">
                    <span>⚠ {t('createServer.javaNotFound', { version: requiredJava })}</span>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleInstallJava}
                        disabled={isInstallingJava}
                      >
                        {isInstallingJava 
                          ? `${t('createServer.installingJava')} ${installProgress.get(requiredJava >= 21 ? 21 : requiredJava >= 17 ? 17 : 8) || 0}%`
                          : t('createServer.installJava', { version: requiredJava >= 21 ? 21 : requiredJava >= 17 ? 17 : 8 })
                        }
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      await window.electronAPI.app.openExternal(MOJANG_EULA_URL);
                    } catch (err) {
                      console.error('Failed to open external URL:', err);
                    }
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
