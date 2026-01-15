/**
 * AboutView 元件 - 關於頁面
 * 完整頁面視圖，顯示應用程式資訊、技術棧和外部連結
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import appIcon from '@/assets/icon.png';

interface AboutViewProps {
  onBack: () => void;
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

/** 關於頁面元件 */
export function AboutView({ onBack }: AboutViewProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('0.1.0');

  useEffect(() => {
    setVersion('0.1.0');
  }, []);

  const techStack = ['Electron', 'React', 'Vite', 'TypeScript', 'Tailwind CSS', 'Radix UI'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 標題列 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/10 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('about.title')}</h1>
      </div>

      <div className="grid gap-6">
        {/* 應用程式資訊 */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-shadow overflow-hidden">
                <img src={appIcon} alt="Lumix" className="w-12 h-12 object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Lumix</h2>
                <p className="text-sm text-muted-foreground">{t('about.description')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('about.version')}</p>
                <p className="text-sm font-medium">{version}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('about.author')}</p>
                <p className="text-sm font-medium">0png</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('about.license')}</p>
                <p className="text-sm font-medium">MIT</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('about.copyright')}</p>
                <p className="text-sm font-medium">© 2025 0png</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 技術棧 */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('about.techStack')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 text-sm font-medium rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-default"
                >
                  {tech}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 連結 */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('about.openSource')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => openExternal('https://github.com/0png/Lumix')}
                className="hover:bg-primary/10 hover:border-primary/50 transition-colors"
              >
                <GitHubIcon className="mr-2 h-4 w-4" />
                {t('about.viewOnGitHub')}
              </Button>
              <Button
                variant="outline"
                onClick={() => openExternal('https://github.com/0png/Lumix/issues')}
                className="hover:bg-primary/10 hover:border-primary/50 transition-colors"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('about.submitFeedback')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
