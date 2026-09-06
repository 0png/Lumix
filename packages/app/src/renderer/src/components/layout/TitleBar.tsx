import { useEffect } from 'react';
import { PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TitleBarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function TitleBar({ isSidebarCollapsed, onToggleSidebar }: TitleBarProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    window.electronAPI.window.setTitleBarOverlayTheme(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <header className="app-drag-region flex h-24 shrink-0 items-center border-b border-border/50 bg-background/96 pl-3 pr-[138px]">
      <div className="flex min-w-0 items-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="app-no-drag h-8 w-8 rounded-lg text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground focus-ring motion-reduce:transition-none"
                onClick={onToggleSidebar}
                aria-label={isSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                aria-expanded={!isSidebarCollapsed}
              >
                <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
