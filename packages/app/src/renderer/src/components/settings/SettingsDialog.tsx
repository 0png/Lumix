/**
 * SettingsDialog 元件 - 設定對話框
 * 設計語言與 Lumix 保持一致，優化 1000x600 視窗
 */

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

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

const themeOptions: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
  { value: 'system', labelKey: 'theme.system' },
];

const languageOptions: { value: Language; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
];

function JavaItem({ java, onRemove }: { java: JavaInstallation; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
      <div className="flex items-center gap-2 min-w-0">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium">Java {java.majorVersion}</p>
          <p className="text-[10px] text-muted-foreground truncate">{java.path}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-6 w-6 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[500px] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">{t('settings.appearance')}</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('settings.theme')}</Label>
              <div className="flex gap-1.5">
                {themeOptions.map((option) => {
                  const Icon = themeIcons[option.value];
                  return (
                    <Button
                      key={option.value}
                      variant={theme === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme(option.value)}
                      className="flex-1 h-8 text-xs"
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {t(option.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('settings.language')}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">{t('settings.defaults')}</h3>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('settings.defaultRam')}</Label>
                <span className="text-xs text-muted-foreground">{ramMax} MB</span>
              </div>
              <Slider
                value={[ramMax]}
                onValueChange={handleRamChange}
                min={512}
                max={16384}
                step={512}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>512 MB</span>
                <span>16 GB</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">{t('settings.java')}</h3>
              <Button variant="outline" size="sm" onClick={onAddJavaPath} className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" />
                {t('common.detect')}
              </Button>
            </div>

            {javaInstallations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {t('settings.javaPath')}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {javaInstallations.map((java) => (
                  <JavaItem
                    key={java.path}
                    java={java}
                    onRemove={() => onRemoveJavaPath?.(java.path)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
