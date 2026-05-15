/**
 * AboutView 元件 - 關於頁面
 * 完整頁面視圖，顯示產品資訊、專案狀態和外部連結
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Github,
  HeartHandshake,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
function openExternal(url: string) {
  window.open(url, '_blank');
}

/** 關於頁面元件 */
export function AboutView({ onBack }: AboutViewProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('0.1.0');
  const { checkForUpdates, checking, available, updateInfo } = useUpdate();

  useEffect(() => {
    // 動態讀取版本號
    window.electronAPI.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setVersion(result.data);
      }
    });
  }, []);

  const handleCheckUpdate = async () => {
    await checkForUpdates();

    if (!available && !checking) {
      toast.success(t('update.noUpdate.title'), {
        description: t('update.noUpdate.description'),
      });
    }
  };

  const projectSignals = [
    {
      icon: ShieldCheck,
      title: t('about.signals.localFirst.title'),
      description: t('about.signals.localFirst.description'),
    },
    {
      icon: BadgeCheck,
      title: t('about.signals.releaseReady.title'),
      description: t('about.signals.releaseReady.description'),
    },
    {
      icon: HeartHandshake,
      title: t('about.signals.openProject.title'),
      description: t('about.signals.openProject.description'),
    },
  ];

  const metadata = [
    { label: t('about.version'), value: version },
    { label: t('about.releaseChannel'), value: t('about.releaseChannelValue') },
    { label: t('about.license'), value: 'MIT' },
    { label: t('about.maintainer'), value: '0png' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('about.title')}</h1>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-border/50 bg-gradient-subtle px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <img src={appIcon} alt="Lumix" className="h-16 w-16 shrink-0 rounded-2xl shadow-sm" />
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Lumix</h2>
                    <Badge variant="secondary" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('about.status')}
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t('about.summary')}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleCheckUpdate}
                disabled={checking}
                className="shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-colors"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? t('update.checking') : t('update.checkForUpdates')}
              </Button>
            </div>

            {available && updateInfo && (
              <p className="mt-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {t('update.newVersionAvailable', { version: updateInfo.version })}
              </p>
            )}
          </div>

          <div className="grid gap-0 divide-y divide-border/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {metadata.map((item) => (
              <div key={item.label} className="space-y-1 px-5 py-4 sm:px-6">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="glass">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">{t('about.projectTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0">
            {projectSignals.map((signal) => {
              const Icon = signal.icon;

              return (
                <div
                  key={signal.title}
                  className="flex gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold">{signal.title}</h3>
                    <p className="text-xs leading-5 text-muted-foreground">{signal.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">{t('about.openSource')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <p className="text-sm leading-6 text-muted-foreground">{t('about.openSourceDescription')}</p>
            <div className="grid gap-2">
              <Button
                variant="outline"
                onClick={() => openExternal('https://github.com/0png/Lumix')}
                className="justify-start hover:bg-primary/10 hover:border-primary/50 transition-colors"
              >
                <Github className="mr-2 h-4 w-4" />
                {t('about.viewOnGitHub')}
              </Button>
              <Button
                variant="outline"
                onClick={() => openExternal('https://github.com/0png/Lumix/issues')}
                className="justify-start hover:bg-primary/10 hover:border-primary/50 transition-colors"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('about.submitFeedback')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t('about.updatePolicyTitle')}</h3>
            <p className="text-xs leading-5 text-muted-foreground">{t('about.updatePolicyDescription')}</p>
          </div>
          <Badge variant="outline" className="w-fit shrink-0">
            {t('about.copyrightNotice')}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
