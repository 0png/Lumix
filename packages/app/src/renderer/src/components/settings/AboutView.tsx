/**
 * AboutView 元件 - 關於頁面
 * 顯示精簡的產品資訊、更新狀態與外部連結
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookText, ExternalLink, Github, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdate } from '@/hooks/use-update';
import { toast } from 'sonner';
import appIcon from '@/assets/icon.png';

interface AboutViewProps {
  onBack: () => void;
}

/** 開啟外部連結 */
async function openExternal(url: string) {
  await window.electronAPI.app.openExternal(url);
}

/** 關於頁面元件 */
export function AboutView({ onBack }: AboutViewProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('1.1.0');
  const [hasCheckedUpdate, setHasCheckedUpdate] = useState(false);
  const { checkForUpdates, checking, available, updateInfo } = useUpdate();

  useEffect(() => {
    window.electronAPI.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setVersion(result.data);
      }
    });
  }, []);

  const handleCheckUpdate = async () => {
    const result = await checkForUpdates();
    setHasCheckedUpdate(true);

    if (result.success && !result.data?.hasUpdate) {
      toast.success(t('update.noUpdate.title'), {
        description: t('update.noUpdate.description'),
      });
    }
  };

  const quickLinks = [
    {
      label: t('about.viewOnGitHub'),
      href: 'https://github.com/0png/Lumix',
      icon: Github,
    },
    {
      label: t('about.releaseNotes'),
      href: 'https://github.com/0png/Lumix/releases',
      icon: BookText,
    },
    {
      label: t('about.reportIssue'),
      href: 'https://github.com/0png/Lumix/issues',
      icon: ExternalLink,
    },
  ];

  const updateStatusLabel = checking
    ? t('update.checking')
    : available && updateInfo
      ? t('about.updateAvailableLabel')
      : hasCheckedUpdate
        ? t('about.upToDateLabel')
        : t('about.updateIdleLabel');

  const updateSummary = available && updateInfo
    ? t('update.newVersionAvailable', { version: updateInfo.version })
    : hasCheckedUpdate
      ? t('update.noUpdate.description')
      : t('about.updateIdleDescription');

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center py-10 animate-fade-in lg:min-h-[calc(100vh-9rem)]">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="absolute left-0 top-0 h-9 w-9 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={t('common.back')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <section className="w-full max-w-xl">
        <div className="flex flex-col items-center text-center">
          <img
            src={appIcon}
            alt="Lumix"
            className="h-16 w-16 rounded-2xl shadow-sm ring-1 ring-border/60"
          />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Lumix</h1>
          <p className="mt-1 text-xs font-medium text-muted-foreground">v{version}</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {t('about.tagline')}
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/30">
          <div className="flex min-h-[72px] items-center justify-between gap-5 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${available ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{updateStatusLabel}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{updateSummary}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckUpdate}
              disabled={checking}
              className="h-8 shrink-0 bg-background/60 px-3 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? t('update.checking') : t('update.checkForUpdates')}
            </Button>
          </div>

          <dl className="border-t border-border/60">
            <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 text-sm sm:px-5">
              <dt className="text-muted-foreground">{t('about.releaseChannel')}</dt>
              <dd className="font-medium text-foreground">{t('about.releaseChannelValue')}</dd>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5">
              <dt className="text-muted-foreground">{t('about.license')}</dt>
              <dd className="font-medium text-foreground">MIT</dd>
            </div>
          </dl>
        </div>

        <nav className="mt-5 flex flex-wrap items-center justify-center gap-1" aria-label={t('about.quickLinks')}>
          {quickLinks.map((link) => {
            const Icon = link.icon;

            return (
              <Button
                key={link.label}
                variant="ghost"
                size="sm"
                onClick={() => void openExternal(link.href)}
                className="h-8 px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Button>
            );
          })}
        </nav>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          {t('about.copyrightNotice')}
        </p>
      </section>
    </div>
  );
}
