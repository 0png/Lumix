/**
 * SettingsView 元件 - 設定頁面
 * 完整頁面視圖，包含外觀、語言、預設值和 Java 管理
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, FolderOpen, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

/** Java 安裝項目元件 */
function JavaItem({ java, onRemove }: { java: JavaInstallation; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-all duration-200 hover:shadow-sm group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Java {java.majorVersion}</p>
          <p className="text-xs text-muted-foreground truncate">{java.path}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 標題列 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('settings.title')}</h1>
      </div>

      <div className="grid gap-6">
        {/* 外觀設定 */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('settings.appearance')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.theme')}</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                {themeOptions.map((option) => {
                  const Icon = themeIcons[option.value];
                  return (
                    <Button
                      key={option.value}
                      variant={theme === option.value ? 'default' : 'outline'}
                      onClick={() => setTheme(option.value)}
                      className="flex-1"
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {t(option.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </div>

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
          </CardContent>
        </Card>

        {/* 預設值設定 */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('settings.defaults')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
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
          </CardContent>
        </Card>

        {/* Java 管理 */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('settings.java')}</CardTitle>
              <Button variant="outline" size="sm" onClick={onAddJavaPath} className="hover:bg-primary/10 hover:border-primary/50 transition-colors">
                <Plus className="mr-1.5 h-4 w-4" />
                {t('common.create')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {javaInstallations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('settings.javaPath')}
              </p>
            ) : (
              <div className="space-y-2">
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
    </div>
  );
}
