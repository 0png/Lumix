import { useEffect } from 'react';
import { useTheme } from '@/contexts/theme-context';
import appIcon from '@/assets/icon.png';

export function TitleBar() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    window.electronAPI.window.setTitleBarOverlayTheme(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <header className="app-drag-region flex h-9 shrink-0 items-center justify-between border-b border-border/50 bg-background/96 pr-[138px]">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <img
          src={appIcon}
          alt=""
          className="h-[18px] w-[18px] shrink-0 rounded-[4px] border border-border/50 object-cover"
          aria-hidden="true"
        />
        <div className="min-w-0 text-xs font-medium text-muted-foreground">
          <span className="truncate">Lumix</span>
        </div>
      </div>
    </header>
  );
}
