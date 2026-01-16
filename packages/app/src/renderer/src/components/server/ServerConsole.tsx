/**
 * ServerConsole 元件 - 伺服器控制台
 * 支援響應式設計、語法高亮、無障礙
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Terminal, Send, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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

const levelConfig: Record<LogLevel, { color: string; bgColor: string; icon: string }> = {
  info: { 
    color: 'text-foreground', 
    bgColor: 'bg-transparent',
    icon: 'ℹ️',
  },
  warn: { 
    color: 'text-yellow-500 dark:text-yellow-400', 
    bgColor: 'bg-yellow-500/5',
    icon: '⚠️',
  },
  error: { 
    color: 'text-red-500 dark:text-red-400', 
    bgColor: 'bg-red-500/5',
    icon: '❌',
  },
};

/**
 * 空狀態元件
 */
function EmptyConsole() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted/50 p-3 mb-3">
        <Terminal className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground mb-1">
        {t('server.consoleEmpty', '控制台目前沒有日誌')}
      </p>
      <p className="text-xs text-muted-foreground/70">
        {t('server.consoleHint', '伺服器啟動後，日誌將顯示在這裡')}
      </p>
    </div>
  );
}

/**
 * 日誌項目元件
 */
function LogItem({ log }: { log: LogEntry }) {
  const config = levelConfig[log.level];
  
  return (
    <div 
      className={cn(
        'flex gap-2 py-0.5 px-1 -mx-1 rounded transition-colors',
        'hover:bg-muted/30',
        config.bgColor
      )}
      role="log"
      aria-label={`${log.level}: ${log.message}`}
    >
      <span className="text-muted-foreground/70 shrink-0 tabular-nums">
        [{formatTimestamp(log.timestamp)}]
      </span>
      <span className={cn('break-all', config.color)}>
        {log.message}
      </span>
    </div>
  );
}

export function ServerConsole({ logs, onClear, onSendCommand, className }: ServerConsoleProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [command, setCommand] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendCommand = () => {
    const trimmed = command.trim();
    if (trimmed && onSendCommand) {
      onSendCommand(trimmed);
      setCommand('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  const handleClear = () => {
    onClear?.();
    setShowClearDialog(false);
  };

  return (
    <>
      <Card className={cn('flex flex-col glass animate-fade-in-up', className)}>
        <CardHeader className="flex-row items-center justify-between space-y-0 p-3 lg:p-4 pb-1.5 lg:pb-2 border-b border-border/30">
          <CardTitle className="text-sm lg:text-base flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10">
              <Terminal className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" aria-hidden="true" />
            </div>
            {t('server.console')}
            {logs.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({logs.length})
              </span>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowClearDialog(true)}
            disabled={logs.length === 0}
            className="h-7 lg:h-8 w-7 lg:w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label={t('server.clearConsole', '清除控制台')}
          >
            <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 p-0 flex flex-col">
          <ScrollArea 
            className="h-[200px] lg:h-[350px] rounded-none" 
            ref={scrollRef}
          >
            <div 
              className="p-3 lg:p-4 font-mono text-[10px] lg:text-sm bg-gradient-to-b from-secondary/30 to-secondary/50"
              role="log"
              aria-live="polite"
              aria-label={t('server.console')}
            >
              {logs.length === 0 ? (
                <EmptyConsole />
              ) : (
                logs.map((log) => <LogItem key={log.id} log={log} />)
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* 指令輸入區 */}
          <div className="flex gap-2 p-3 lg:p-4 pt-2 lg:pt-3 border-t border-border/30 bg-background/50">
            <Input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('server.commandPlaceholder')}
              className="flex-1 h-8 lg:h-9 text-xs lg:text-sm font-mono bg-secondary/50 border-border/50 focus:border-primary/50 transition-colors"
              aria-label={t('server.commandPlaceholder')}
            />
            <Button
              size="sm"
              onClick={handleSendCommand}
              disabled={!command.trim()}
              className="h-8 lg:h-9 px-3 transition-all duration-200 hover:shadow-md hover:shadow-primary/20 ripple"
              aria-label={t('server.sendCommand', '發送指令')}
            >
              <Send className="h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 清除確認對話框 */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
              {t('server.clearConsole', '清除控制台')}
            </DialogTitle>
            <DialogDescription>
              {t('server.clearConsoleConfirm', '確定要清除所有日誌嗎？此操作無法復原。')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
