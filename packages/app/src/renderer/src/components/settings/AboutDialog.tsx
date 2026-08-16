/**
 * AboutDialog 元件 - 關於對話框
 * 顯示精簡的產品資訊和外部連結
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Github, Info } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { WorkspaceDialogBody, WorkspaceDialogContent, WorkspaceDialogHeader } from '@/components/ui/workspace-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import appIcon from '@/assets/icon.png';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 開啟外部連結 */
function openExternal(url: string) {
  window.open(url, '_blank');
}

/** 關於對話框元件 */
export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('1.1.1');

  useEffect(() => {
    window.electronAPI.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setVersion(result.data);
      }
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WorkspaceDialogContent className="sm:max-w-lg">
        <WorkspaceDialogHeader icon={Info} eyebrow={t('modal.about')} title={t('about.title')} />

        <WorkspaceDialogBody className="space-y-4">
          <div className="rounded-lg border border-border/50 bg-gradient-subtle p-4">
            <div className="flex items-start gap-4">
              <img src={appIcon} alt="Lumix" className="h-14 w-14 shrink-0 rounded-xl shadow-sm" />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Lumix</h2>
                  <Badge variant="secondary">{t('about.status')}</Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{t('about.summary')}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">{t('about.version')}</p>
              <p className="text-xs font-semibold">{version}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">{t('about.license')}</p>
              <p className="text-xs font-semibold">MIT</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">{t('about.releaseChannel')}</p>
              <p className="text-xs font-semibold">{t('about.releaseChannelValue')}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <p className="text-[10px] font-medium text-muted-foreground">{t('about.maintainer')}</p>
              <p className="text-xs font-semibold">0png</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => openExternal('https://github.com/0png/Lumix')}
            >
              <Github className="mr-1.5 h-3.5 w-3.5" />
              {t('about.viewOnGitHub')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => openExternal('https://github.com/0png/Lumix/issues')}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              {t('about.submitFeedback')}
            </Button>
          </div>
        </WorkspaceDialogBody>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
