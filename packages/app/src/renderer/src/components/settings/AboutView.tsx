/**
 * AboutView 元件 - 關於頁面
 * 完整頁面視圖，顯示產品資訊、更新狀態與外部連結
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BellDot,
  BookText,
  ExternalLink,
  Github,
  Layers3,
  Radio,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [version, setVersion] = useState('0.1.0');
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

  const metadata = [
    { label: t('about.version'), value: version, icon: Layers3 },
    { label: t('about.releaseChannel'), value: t('about.releaseChannelValue'), icon: Radio },
    { label: t('about.license'), value: 'MIT', icon: BookText },
    { label: t('about.runtime'), value: t('about.runtimeValue'), icon: ExternalLink },
    { label: t('about.maintainer'), value: '0png', icon: UserRound },
  ];

  const metadataPrimary = metadata.slice(0, 3);
  const metadataSecondary = metadata.slice(3);

  const quickLinks = [
    {
      label: t('about.viewOnGitHub'),
      href: 'https://github.com/0png/Lumix',
      icon: Github,
    },
    {
      label: t('about.reportIssue'),
      href: 'https://github.com/0png/Lumix/issues',
      icon: BellDot,
    },
    {
      label: t('about.releaseNotes'),
      href: 'https://github.com/0png/Lumix/releases',
      icon: BookText,
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('about.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('about.description')}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
        <Card className="glass overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-border/50 bg-gradient-subtle px-5 py-6 sm:px-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <img
                      src={appIcon}
                      alt="Lumix"
                      className="h-16 w-16 shrink-0 rounded-2xl shadow-sm ring-1 ring-border/50"
                    />
                    <div className="min-w-0 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-[28px] font-semibold tracking-tight text-foreground">Lumix</h2>
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                          v{version}
                        </Badge>
                      </div>
                      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                        {t('about.tagline')}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[220px] rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/90">
                          {t('about.updateStatusTitle')}
                        </p>
                        <p className="text-sm font-semibold">{updateStatusLabel}</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <RefreshCw className={`h-4 w-4 text-primary ${checking ? 'animate-spin' : ''}`} />
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {updateSummary}
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleCheckUpdate}
                      disabled={checking}
                      className="mt-4 w-full justify-center hover:bg-primary/10 hover:border-primary/50 transition-colors"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                      {checking ? t('update.checking') : t('update.checkForUpdates')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-px bg-border/50">
              <div className="grid gap-px md:grid-cols-3">
                {metadataPrimary.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="bg-card px-5 py-4 sm:px-6">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      </div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/90">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-foreground">{item.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-px md:grid-cols-2">
                {metadataSecondary.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="bg-card px-5 py-4 sm:px-6">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      </div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/90">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-foreground">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="glass">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base">{t('about.quickLinks')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-5 pt-0">
              {quickLinks.map((link) => {
                const Icon = link.icon;

                return (
                  <Button
                    key={link.label}
                    variant="outline"
                    onClick={() => void openExternal(link.href)}
                    className="h-11 w-full justify-between rounded-xl px-4 hover:bg-primary/10 hover:border-primary/50 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      <span>{link.label}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Button>
                );
              })}
              <div className="flex items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
                <span>{t('about.copyrightNotice')}</span>
                <span>{t('about.releaseChannelValue')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
