import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, FolderOpen, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme, type Theme } from '@/contexts';
import { useLanguage, type Language } from '@/contexts';
import { cn } from '@/lib/utils';

interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRamMax?: number;
  javaInstallations?: JavaInstallation[];
  onDefaultRamChange?: (min: number, max: number) => void;
  onAddJavaPath?: () => void;
  onRemoveJavaPath?: (path: string) => void;
}

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};


export function SettingsDialog({
  open,
  onOpenChange,
  defaultRamMax = 4096,
  javaInstallations = [],
  onDefaultRamChange,
  onAddJavaPath,
  onRemoveJavaPath,
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [ramMax, setRamMax] = useState(defaultRamMax);

  const handleRamChange = (values: number[]) => {
    const value = values[0];
    if (value !== undefined) {
      setRamMax(value);
      onDefaultRamChange?.(Math.floor(value / 2), value);
    }
  };

  const themeOptions: { value: Theme; labelKey: string }[] = [
    { value: 'light', labelKey: 'theme.light' },
    { value: 'dark', labelKey: 'theme.dark' },
    { value: 'system', labelKey: 'theme.system' },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'en', label: 'English' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Appearance Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('settings.appearance')}</h3>
            
            {/* Theme Selection */}
            <div className="space-y-2">
              <Label>{t('settings.theme')}</Label>
              <div className="flex gap-2">
                {themeOptions.map((option) => {
                  const Icon = themeIcons[option.value];
                  return (
                    <Button
                      key={option.value}
                      variant={theme === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme(option.value)}
                      className="flex-1"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {t(option.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <Label>{t('settings.language')}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Defaults Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('settings.defaults')}</h3>
            
            {/* Default RAM */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('settings.defaultRam')}</Label>
                <span className="text-sm text-muted-foreground">{ramMax} MB</span>
              </div>
              <Slider
                value={[ramMax]}
                onValueChange={handleRamChange}
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

          <Separator />

          {/* Java Management Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t('settings.java')}</h3>
              <Button variant="outline" size="sm" onClick={onAddJavaPath}>
                <Plus className="h-4 w-4 mr-1" />
                {t('common.create')}
              </Button>
            </div>
            
            {javaInstallations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('settings.javaPath')}
              </p>
            ) : (
              <div className="space-y-2">
                {javaInstallations.map((java) => (
                  <div
                    key={java.path}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-md',
                      'bg-secondary/50'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Java {java.majorVersion}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {java.path}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => onRemoveJavaPath?.(java.path)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
