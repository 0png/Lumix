import { useState } from 'react';
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

// Mock versions for development - will be replaced with dynamic API calls after IPC integration
const MOCK_VERSIONS = [
  // 1.21.x
  '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  // 1.20.x
  '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
  // 1.19.x
  '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
  // 1.18.x
  '1.18.2', '1.18.1', '1.18',
  // 1.17.x
  '1.17.1', '1.17',
  // 1.16.x
  '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
  // Older popular versions
  '1.15.2', '1.14.4', '1.12.2', '1.8.9', '1.7.10',
];

export function CreateServerDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateServerDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [coreType, setCoreType] = useState<CoreType>('paper');
  const [mcVersion, setMcVersion] = useState('1.20.4');
  const [ramMax, setRamMax] = useState(2048);


  const handleSubmit = () => {
    if (!name.trim()) return;
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
    setMcVersion('1.20.4');
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
              versions={MOCK_VERSIONS}
              value={mcVersion}
              onValueChange={setMcVersion}
              placeholder={t('createServer.selectVersion')}
              searchPlaceholder={t('createServer.searchVersion')}
              emptyText={t('createServer.noVersionFound')}
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
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
