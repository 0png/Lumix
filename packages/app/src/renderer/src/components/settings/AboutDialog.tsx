/**
 * AboutDialog 元件 - 關於對話框
 * 顯示應用程式資訊、技術棧和外部連結
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 開啟外部連結 */
function openExternal(url: string) {
  window.open(url, '_blank');
}

/** GitHub 圖示 */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/** 關於對話框元件 */
export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('0.1.0');

  useEffect(() => {
    // 未來可從 Electron API 取得版本
    setVersion('0.1.0');
  }, []);

  const techStack = ['Electron', 'React', 'Vite', 'TypeScript', 'Tailwind CSS', 'Radix UI'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">{t('about.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 應用程式資訊 */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">L</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Lumix</h2>
                <p className="text-xs text-muted-foreground">{t('about.description')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">{t('about.version')}</p>
                <p className="text-xs font-medium">{version}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">{t('about.author')}</p>
                <p className="text-xs font-medium">0png</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">{t('about.license')}</p>
                <p className="text-xs font-medium">MIT</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">{t('about.copyright')}</p>
                <p className="text-xs font-medium">© 2025 0png</p>
              </div>
            </div>
          </Card>

          <Separator />

          {/* 技術棧 */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('about.techStack')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <Separator />

          {/* 連結 */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('about.openSource')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => openExternal('https://github.com/0png/Lumix')}
              >
                <GitHubIcon className="mr-1.5 h-3.5 w-3.5" />
                {t('about.viewOnGitHub')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => openExternal('https://github.com/0png/Lumix/issues')}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t('about.submitFeedback')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
