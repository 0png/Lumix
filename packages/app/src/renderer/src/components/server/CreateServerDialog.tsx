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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { CoreType } from './ServerList';

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
  onSubmit: (data: CreateServerData) => void;
}

const CORE_TYPES: CoreType[] = ['vanilla', 'paper', 'fabric', 'forge'];

export function CreateServerDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateServerDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [coreType, setCoreType] = useState<CoreType>('paper');
  const [mcVersion, setMcVersion] = useState('');
  const [ramMax, setRamMax] = useState(2048);
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async (type: CoreType) => {
    setLoading(true);
    setError(null);
    setVersions([]);
    setMcVersion('');

    try {
      // Use IPC to fetch versions from main process (bypasses CSP)
      const result = await window.electronAPI.fetchVersions(type);
      
      if (result.success && result.versions) {
        console.log(`Fetched ${result.versions.length} versions for ${type}`);
        setVersions(result.versions);
        if (result.versions.length > 0) {
          setMcVersion(result.versions[0]!);
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

  const handleSubmit = () => {
    if (!name.trim() || !mcVersion) return;
    onSubmit({
      name: name.trim(),
      coreType,
      mcVersion,
      ramMin: Math.floor(ramMax / 2),
      ramMax,
    });
    // Reset form
    setName('');
    setCoreType('paper');
    setMcVersion('');
    setRamMax(2048);
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
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createServer.namePlaceholder')}
            />
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
            {loading ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">載入中...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-destructive p-2 border border-destructive rounded-md">
                載入失敗: {error}
              </div>
            ) : (
              <Select value={mcVersion} onValueChange={setMcVersion}>
                <SelectTrigger>
                  <SelectValue placeholder={t('createServer.selectVersion')} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {versions.map((version) => (
                    <SelectItem key={version} value={version}>
                      {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !mcVersion || loading}>
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
