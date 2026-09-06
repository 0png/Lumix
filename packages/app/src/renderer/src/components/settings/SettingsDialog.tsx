import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronRight,
  Coffee,
  FolderOpen,
  HardDrive,
  Palette,
  Power,
  RefreshCw,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage, useTheme, type Language, type Theme } from '@/contexts';
import { cn } from '@/lib/utils';
import type { SaveSettingsRequest, SettingsDto } from '../../../../shared/ipc-types';

interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: SettingsDto | null;
  defaultRamMax?: number;
  javaInstallations?: JavaInstallation[];
  javaLoading?: boolean;
  onSaveSettings?: (data: SaveSettingsRequest) => Promise<boolean>;
  onDefaultRamChange?: (min: number, max: number) => void;
  onDetectJava?: () => void | Promise<void>;
}

type SettingsSection = 'general' | 'startup' | 'storage' | 'java';

const themeOptions: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
  { value: 'system', labelKey: 'theme.system' },
];

const languageOptions: { value: Language; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
];

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row flex min-h-16 items-center justify-between gap-8 border-b border-border/55 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        <p className="mt-0.5 max-w-md text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function JavaItem({ java }: { java: JavaInstallation }) {
  return (
    <div className="settings-java-item group flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3.5 py-3">
      <div className="settings-java-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/45">
        <Coffee className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium">Java {java.majorVersion}</p>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {java.version}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={java.path}>
          {java.path}
        </p>
      </div>
      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 opacity-75" aria-hidden="true" />
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  defaultRamMax = 4096,
  javaInstallations = [],
  javaLoading = false,
  onSaveSettings,
  onDefaultRamChange,
  onDetectJava,
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [section, setSection] = useState<SettingsSection>('general');
  const [ramMax, setRamMax] = useState(settings?.defaultRamMax ?? defaultRamMax);
  const [launchAtLogin, setLaunchAtLogin] = useState(settings?.launchAtLogin ?? false);
  const [startMinimized, setStartMinimized] = useState(settings?.startMinimized ?? true);
  const [restoreLastSession, setRestoreLastSession] = useState(settings?.restoreLastSession ?? true);
  const [closeBehavior, setCloseBehavior] = useState<SettingsDto['closeBehavior']>(
    settings?.closeBehavior ?? 'minimize-to-tray'
  );
  const [serversPath, setServersPath] = useState(settings?.defaultServersPath ?? '');
  const [regularRetention, setRegularRetention] = useState(settings?.defaultRegularBackupRetention ?? 3);
  const [preRestoreRetention, setPreRestoreRetention] = useState(settings?.defaultPreRestoreBackupRetention ?? 3);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setRamMax(settings.defaultRamMax);
    setLaunchAtLogin(settings.launchAtLogin);
    setStartMinimized(settings.startMinimized);
    setRestoreLastSession(settings.restoreLastSession);
    setCloseBehavior(settings.closeBehavior);
    setServersPath(settings.defaultServersPath);
    setRegularRetention(settings.defaultRegularBackupRetention);
    setPreRestoreRetention(settings.defaultPreRestoreBackupRetention);
  }, [settings]);

  const persist = useCallback(async (
    key: string,
    request: SaveSettingsRequest,
    rollback: () => void
  ): Promise<boolean> => {
    setSaveError(null);
    setSavingKey(key);
    try {
      const success = onSaveSettings ? await onSaveSettings(request) : true;
      if (!success) {
        rollback();
        setSaveError(t('settings.saveFailed'));
      }
      return success;
    } catch (error) {
      rollback();
      setSaveError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSavingKey(null);
    }
  }, [onSaveSettings, t]);

  const handleThemeChange = (next: Theme) => {
    const previous = theme;
    setTheme(next);
    void persist('theme', { theme: next }, () => setTheme(previous));
  };

  const handleLanguageChange = (next: Language) => {
    const previous = language;
    setLanguage(next);
    void persist('language', { language: next }, () => setLanguage(previous));
  };

  const handleRamCommit = (values: number[]) => {
    const next = values[0];
    if (next === undefined) return;
    const previous = ramMax;
    setRamMax(next);
    if (!onSaveSettings) {
      onDefaultRamChange?.(Math.floor(next / 2), next);
      return;
    }
    void persist('ram', { defaultRamMin: Math.floor(next / 2), defaultRamMax: next }, () => setRamMax(previous));
  };

  const handleBoolean = (
    key: 'launchAtLogin' | 'startMinimized' | 'restoreLastSession',
    next: boolean
  ) => {
    const values = { launchAtLogin, startMinimized, restoreLastSession };
    const previous = values[key];
    if (key === 'launchAtLogin') setLaunchAtLogin(next);
    if (key === 'startMinimized') setStartMinimized(next);
    if (key === 'restoreLastSession') setRestoreLastSession(next);
    void persist(key, { [key]: next }, () => {
      if (key === 'launchAtLogin') setLaunchAtLogin(previous);
      if (key === 'startMinimized') setStartMinimized(previous);
      if (key === 'restoreLastSession') setRestoreLastSession(previous);
    });
  };

  const handleCloseBehavior = (next: SettingsDto['closeBehavior']) => {
    const previous = closeBehavior;
    setCloseBehavior(next);
    void persist('closeBehavior', { closeBehavior: next }, () => setCloseBehavior(previous));
  };

  const saveRetention = (kind: 'regular' | 'preRestore', rawValue: string) => {
    const value = Math.min(50, Math.max(1, Math.round(Number(rawValue) || 3)));
    if (kind === 'regular') {
      const previous = regularRetention;
      setRegularRetention(value);
      void persist('regularRetention', { defaultRegularBackupRetention: value }, () => setRegularRetention(previous));
    } else {
      const previous = preRestoreRetention;
      setPreRestoreRetention(value);
      void persist('preRestoreRetention', { defaultPreRestoreBackupRetention: value }, () => setPreRestoreRetention(previous));
    }
  };

  const chooseServersPath = async () => {
    const result = await window.electronAPI.app.selectDirectory();
    if (!result.success || !result.data) {
      if (!result.success) setSaveError(result.error ?? t('settings.saveFailed'));
      return;
    }
    const previous = serversPath;
    setServersPath(result.data);
    await persist('serversPath', { defaultServersPath: result.data }, () => setServersPath(previous));
  };

  const resetServersPath = async () => {
    const result = await window.electronAPI.app.getDataPath();
    if (!result.success || !result.data) {
      setSaveError(result.error ?? t('settings.saveFailed'));
      return;
    }
    const next = `${result.data}/servers`;
    const previous = serversPath;
    setServersPath(next);
    await persist('serversPath', { defaultServersPath: next }, () => setServersPath(previous));
  };

  const openServersPath = async () => {
    if (!serversPath) return;
    const result = await window.electronAPI.app.openFolder(serversPath);
    if (!result.success) setSaveError(result.error ?? t('settings.openFolderFailed'));
  };

  const navigation = [
    { id: 'general' as const, label: t('settings.general'), icon: Settings2 },
    { id: 'startup' as const, label: t('settings.startup'), icon: Power },
    { id: 'storage' as const, label: t('settings.storage'), icon: HardDrive },
    { id: 'java' as const, label: t('settings.java'), icon: Coffee },
  ];

  const renderGeneral = () => (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t('settings.general')}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.generalDescription')}</p>
      </div>

      <section aria-labelledby="settings-appearance-heading">
        <div className="mb-1 flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 id="settings-appearance-heading" className="text-xs font-medium">{t('settings.appearance')}</h3>
        </div>
        <SettingRow title={t('settings.theme')} description={t('settings.themeDescription')}>
          <Select value={theme} onValueChange={(value) => handleThemeChange(value as Theme)}>
            <SelectTrigger className="settings-select-trigger h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="settings-select-content">
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">{t(option.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title={t('settings.language')} description={t('settings.languageDescription')}>
          <Select value={language} onValueChange={(value) => handleLanguageChange(value as Language)}>
            <SelectTrigger className="settings-select-trigger h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="settings-select-content">
              {languageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </section>

      <section className="mt-7" aria-labelledby="settings-defaults-heading">
        <h3 id="settings-defaults-heading" className="mb-3 text-xs font-medium">{t('settings.defaults')}</h3>
        <div className="settings-memory-panel rounded-lg border border-border/60 bg-muted/25 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium">{t('settings.defaultRam')}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('settings.defaultRamDescription')}</p>
            </div>
            <output className="settings-ram-value rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[11px] tabular-nums">
              {ramMax >= 1024 ? `${ramMax / 1024} GB` : `${ramMax} MB`}
            </output>
          </div>
          <Slider
            className="settings-slider mt-5"
            value={[ramMax]}
            onValueChange={(values) => values[0] !== undefined && setRamMax(values[0])}
            onValueCommit={handleRamCommit}
            min={1024}
            max={16384}
            step={512}
            aria-label={t('settings.defaultRam')}
            disabled={savingKey === 'ram'}
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/75"><span>1 GB</span><span>16 GB</span></div>
        </div>
      </section>
    </>
  );

  const renderStartup = () => (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t('settings.startup')}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.startupDescription')}</p>
      </div>
      <section aria-label={t('settings.startup')}>
        <SettingRow title={t('settings.launchAtLogin')} description={t('settings.launchAtLoginDescription')}>
          <Switch checked={launchAtLogin} onCheckedChange={(value) => handleBoolean('launchAtLogin', value)} disabled={savingKey === 'launchAtLogin'} />
        </SettingRow>
        <SettingRow title={t('settings.startMinimized')} description={t('settings.startMinimizedDescription')}>
          <Switch checked={startMinimized} onCheckedChange={(value) => handleBoolean('startMinimized', value)} disabled={!launchAtLogin || savingKey === 'startMinimized'} />
        </SettingRow>
        <SettingRow title={t('settings.restoreLastSession')} description={t('settings.restoreLastSessionDescription')}>
          <Switch checked={restoreLastSession} onCheckedChange={(value) => handleBoolean('restoreLastSession', value)} disabled={savingKey === 'restoreLastSession'} />
        </SettingRow>
        <SettingRow title={t('settings.closeBehavior')} description={t('settings.closeBehaviorDescription')}>
          <Select value={closeBehavior} onValueChange={(value) => handleCloseBehavior(value as SettingsDto['closeBehavior'])}>
            <SelectTrigger className="settings-select-trigger h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="settings-select-content">
              <SelectItem value="minimize-to-tray" className="text-xs">{t('settings.closeToTray')}</SelectItem>
              <SelectItem value="quit" className="text-xs">{t('settings.quitApp')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </section>
    </>
  );

  const renderStorage = () => (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t('settings.storage')}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.storageDescription')}</p>
      </div>
      <section aria-labelledby="settings-storage-path-heading">
        <div className="mb-2 flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 id="settings-storage-path-heading" className="text-xs font-medium">{t('settings.serverRoot')}</h3>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs leading-5 text-muted-foreground">{t('settings.serverRootDescription')}</p>
          <div className="mt-3 flex gap-2">
            <Input value={serversPath} readOnly className="h-8 min-w-0 flex-1 font-mono text-[11px]" aria-label={t('settings.serverRoot')} />
            <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void chooseServersPath()} disabled={savingKey === 'serversPath'}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />{t('settings.chooseFolder')}
            </Button>
            <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void openServersPath()} disabled={!serversPath || savingKey === 'serversPath'}>
              {t('settings.openFolder')}
            </Button>
          </div>
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => void resetServersPath()} disabled={savingKey === 'serversPath'}>
              <RotateCcw className="mr-1.5 h-3 w-3" />{t('settings.resetFolder')}
            </Button>
          </div>
        </div>
      </section>
      <section className="mt-7" aria-labelledby="settings-retention-heading">
        <h3 id="settings-retention-heading" className="mb-1 text-xs font-medium">{t('settings.backupRetention')}</h3>
        <p className="mb-2 text-[11px] leading-5 text-muted-foreground">{t('settings.backupRetentionDescription')}</p>
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4">
          <SettingRow title={t('settings.regularRetention')} description={t('settings.regularRetentionDescription')}>
            <div className="flex items-center gap-2"><Input type="number" min={1} max={50} value={regularRetention} onChange={(event) => setRegularRetention(Number(event.target.value))} onBlur={(event) => saveRetention('regular', event.target.value)} className="h-8 w-20 text-right text-xs" /><span className="text-[11px] text-muted-foreground">{t('settings.copies')}</span></div>
          </SettingRow>
          <SettingRow title={t('settings.preRestoreRetention')} description={t('settings.preRestoreRetentionDescription')}>
            <div className="flex items-center gap-2"><Input type="number" min={1} max={50} value={preRestoreRetention} onChange={(event) => setPreRestoreRetention(Number(event.target.value))} onBlur={(event) => saveRetention('preRestore', event.target.value)} className="h-8 w-20 text-right text-xs" /><span className="text-[11px] text-muted-foreground">{t('settings.copies')}</span></div>
          </SettingRow>
        </div>
      </section>
    </>
  );

  const renderJava = () => (
    <>
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{t('settings.java')}</h2>
          <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{t('settings.javaDescription')}</p>
        </div>
        <Button variant="outline" size="sm" className="settings-action h-8 shrink-0 text-xs" onClick={onDetectJava} disabled={javaLoading}>
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', javaLoading && 'animate-spin')} />{t('settings.redetect')}
        </Button>
      </div>
      <section aria-labelledby="settings-java-list-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="settings-java-list-heading" className="text-xs font-medium">{t('settings.detectedInstallations')}</h3>
          <span className="text-[10px] tabular-nums text-muted-foreground">{javaInstallations.length}</span>
        </div>
        {javaInstallations.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 px-6 text-center">
            <FolderOpen className="mb-3 h-5 w-5 text-muted-foreground/70" aria-hidden="true" />
            <p className="text-xs font-medium">{t('settings.noJavaTitle')}</p>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-muted-foreground">{t('settings.noJavaDescription')}</p>
          </div>
        ) : (
          <div className="space-y-2">{javaInstallations.map((java) => <JavaItem key={java.path} java={java} />)}</div>
        )}
      </section>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="settings-workspace-overlay"
        className="settings-workspace-modal h-[calc(100vh-48px)] max-h-[620px] w-[calc(100vw-48px)] max-w-[920px] grid-cols-[168px_minmax(0,1fr)] grid-rows-[56px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <header className="col-span-2 flex h-14 items-center border-b border-border/60 px-5 pr-14">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-muted/50"><Settings2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /></div>
            <DialogTitle className="text-sm font-semibold tracking-[-0.01em]">{t('settings.title')}</DialogTitle>
            <DialogDescription className="hidden truncate text-xs sm:block">{t('settings.description')}</DialogDescription>
          </div>
        </header>

        <aside className="flex min-h-0 w-[168px] flex-col border-r border-border/60 bg-muted/20 p-2.5">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">{t('settings.navigation')}</p>
          <nav className="space-y-0.5" aria-label={t('settings.navigation')}>
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button key={item.id} type="button" className={cn('settings-nav-item flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none', active ? 'bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)]' : 'text-muted-foreground hover:bg-accent/55 hover:text-foreground')} aria-current={active ? 'page' : undefined} onClick={() => setSection(item.id)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="flex-1 truncate">{item.label}</span><ChevronRight className={cn('settings-nav-chevron h-3 w-3', active ? 'opacity-60' : 'opacity-0')} aria-hidden="true" />
                </button>
              );
            })}
          </nav>
          <div className="mt-auto px-2 py-1 text-[10px] leading-4 text-muted-foreground/65">{t('settings.autoSaveHint')}</div>
        </aside>

        <main className="modal-scrollbar min-h-0 min-w-0 overflow-y-auto bg-background">
          <div key={section} className="settings-panel-enter mx-auto max-w-[680px] px-8 py-7">
            {section === 'general' && renderGeneral()}
            {section === 'startup' && renderStartup()}
            {section === 'storage' && renderStorage()}
            {section === 'java' && renderJava()}
            {saveError && <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{saveError}</p>}
          </div>
        </main>
      </DialogContent>
    </Dialog>
  );
}
