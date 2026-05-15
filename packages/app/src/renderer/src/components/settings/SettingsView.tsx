/**
 * SettingsView 元件 - 設定頁面
 * 完整頁面視圖，包含外觀、語言、預設值和 Java 管理
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Cpu,
  FolderOpen,
  Languages,
  Monitor,
  Moon,
  Plus,
  Settings2,
  Sun,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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

interface SettingsViewProps {
  onBack: () => void;
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

function formatMemory(value: number) {
  return value >= 1024 ? `${Math.round(value / 1024)} GB` : `${value} MB`;
}

/** Java 安裝項目元件 */
function JavaItem({ java, onRemove }: { java: JavaInstallation; onRemove: () => void }) {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3 transition-all duration-200 hover:bg-secondary/50 hover:shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors group-hover:bg-primary/15">
          <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Java {java.majorVersion}</p>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {java.version}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{java.path}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** 設定頁面元件 */
export function SettingsView({
  onBack,
  defaultRamMax = 4096,
  javaInstallations = [],
  onDefaultRamChange,
  onAddJavaPath,
  onRemoveJavaPath,
}: SettingsViewProps) {
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

  const activeTheme = themeOptions.find((option) => option.value === theme);
  const activeLanguage = languageOptions.find((option) => option.value === language);
  const ActiveThemeIcon = activeTheme ? themeIcons[activeTheme.value] : Monitor;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('settings.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('settings.description')}</p>
        </div>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="grid gap-0 divide-y divide-border/50 p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <ActiveThemeIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('settings.currentTheme')}</p>
              <p className="truncate text-sm font-semibold">{activeTheme ? t(activeTheme.labelKey) : t('theme.system')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Languages className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('settings.currentLanguage')}</p>
              <p className="truncate text-sm font-semibold">{activeLanguage?.label ?? language}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Cpu className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('settings.runtimeProfile')}</p>
              <p className="truncate text-sm font-semibold">{formatMemory(ramMax)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t('settings.appearance')}
                </CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">{t('settings.appearanceDescription')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 pt-0">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t('settings.theme')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => {
                  const Icon = themeIcons[option.value];
                  const isActive = theme === option.value;

                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setTheme(option.value)}
                      className="h-20 flex-col gap-2 px-2 text-xs"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{t(option.labelKey)}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t('settings.language')}</Label>
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
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t('settings.defaults')}
                </CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">{t('settings.defaultsDescription')}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {formatMemory(ramMax)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 pt-0">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label>{t('settings.defaultRam')}</Label>
                  <p className="text-xs leading-5 text-muted-foreground">{t('settings.defaultRamDescription')}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{ramMax} MB</span>
              </div>
              <Slider
                value={[ramMax]}
                onValueChange={handleRamChange}
                min={512}
                max={16384}
                step={512}
              />
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>512 MB</span>
                <span>16 GB</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                {t('settings.java')}
              </CardTitle>
              <p className="text-xs leading-5 text-muted-foreground">{t('settings.javaDescription')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddJavaPath}
              className="shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-colors"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('common.detect')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {javaInstallations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/20 px-4 py-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">{t('settings.noJavaTitle')}</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                {t('settings.noJavaDescription')}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {javaInstallations.map((java) => (
                <JavaItem
                  key={java.path}
                  java={java}
                  onRemove={() => onRemoveJavaPath?.(java.path)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
