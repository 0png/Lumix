/**
 * ServerConsole 元件 - 伺服器控制台
 * 支援響應式設計
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Terminal, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onSendCommand?: (command: string) => void;
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

export function ServerConsole({ logs, onClear, onSendCommand, className }: ServerConsoleProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [command, setCommand] = useState('');

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendCommand = () => {
    const trimmed = command.trim();
    if (trimmed && onSendCommand) {
      onSendCommand(trimmed);
      setCommand('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  return (
    <Card className={cn('flex flex-col border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-3 lg:p-4 pb-1.5 lg:pb-2 border-b border-border/30">
        <CardTitle className="text-sm lg:text-base flex items-center gap-1.5 lg:gap-2">
          <Terminal className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
          {t('server.console')}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 lg:h-8 w-7 lg:w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="h-[200px] lg:h-[350px] rounded-none" ref={scrollRef}>
          <div className="p-3 lg:p-4 font-mono text-[10px] lg:text-sm bg-gradient-to-b from-secondary/30 to-secondary/50">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 lg:py-8">
                {t('server.console')}
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-1.5 lg:gap-2 py-0.5 hover:bg-muted/30 px-1 -mx-1 rounded transition-colors">
                  <span className="text-muted-foreground/70 shrink-0">
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
        {/* 指令輸入區 */}
        <div className="flex gap-2 p-3 lg:p-4 pt-2 lg:pt-3 border-t border-border/30 bg-background/50">
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('server.commandPlaceholder')}
            className="flex-1 h-8 lg:h-9 text-xs lg:text-sm font-mono bg-secondary/50 border-border/50 focus:border-primary/50 transition-colors"
          />
          <Button
            size="sm"
            onClick={handleSendCommand}
            disabled={!command.trim()}
            className="h-8 lg:h-9 px-3 transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
          >
            <Send className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
