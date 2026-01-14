/**
 * ServerConsole 元件 - 伺服器控制台
 * 支援響應式設計
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

interface ServerConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
  className?: string;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const levelColors: Record<LogLevel, string> = {
  info: 'text-foreground',
  warn: 'text-yellow-500',
  error: 'text-red-500',
};

export function ServerConsole({ logs, onClear, className }: ServerConsoleProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-3 lg:p-4 pb-1.5 lg:pb-2">
        <CardTitle className="text-sm lg:text-base flex items-center gap-1.5 lg:gap-2">
          <Terminal className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          {t('server.console')}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 lg:h-8 w-7 lg:w-8 p-0">
          <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[200px] lg:h-[400px] rounded-b-lg" ref={scrollRef}>
          <div className="p-3 lg:p-4 font-mono text-[10px] lg:text-sm bg-secondary/50">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 lg:py-8">
                {t('server.console')}
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-1.5 lg:gap-2 py-0.5">
                  <span className="text-muted-foreground shrink-0">
                    [{formatTimestamp(log.timestamp)}]
                  </span>
                  <span className={cn('break-all', levelColors[log.level])}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
