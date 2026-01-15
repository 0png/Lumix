import { useState, useEffect } from 'react';
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
import { VersionCombobox } from '@/components/ui/version-combobox';
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
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Fetch versions when core type changes
  useEffect(() => {
    async function fetchVersions() {
      setIsLoadingVersions(true);
      setVersions([]);
      setMcVersion('');
      
      try {
        const result = await window.electronAPI.getVersions(coreType);
        if (result.success && result.data) {
          setVersions(result.data);
          // Auto-select first version
          if (result.data.length > 0) {
            setMcVersion(result.data[0]!);
          }
        } else {
          console.error('Failed to fetch versions:', result.error);
        }
      } catch (error) {
        console.error('Failed to fetch versions:', error);
      } finally {
        setIsLoadingVersions(false);
      }
    }

    if (open) {
      fetchVersions();
    }
  }, [coreType, open]);

  const handleSubmit = () => {
    if (!name.trim() || !mcVersion) return;
    onSubmit({
      name: name.trim(),
      coreType,
      mcVersion,
      ramMin: Math.floor(ramMax / 2),
      ramMax,
    });
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName('');
    setCoreType('paper');
    setMcVersion('');
    setRamMax(2048);
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
            <Select value={coreType} onValueChange={(v) => setCoreType(v as CoreType)}>
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
              emptyText={t('createServer.noVersionFound')}
              loading={isLoadingVersions}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !mcVersion || isLoadingVersions}>
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
