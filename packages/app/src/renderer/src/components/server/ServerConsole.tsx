/**
 * ServerConsole 元件 - 伺服器控制台
 * 支援響應式設計、語法高亮、無障礙
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, Trash2, Terminal, Send, AlertCircle } from 'lucide-react';
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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

interface CommandCompletion {
  value: string;
  args?: string[];
}

interface CompletionMatch {
  value: string;
  kind: 'command' | 'argument';
  replacementStart: number;
  replacementEnd: number;
}

interface InlineCompletion {
  suffix: string;
  nextValue: string;
  nextCursor: number;
}

const COMMAND_COMPLETIONS: CommandCompletion[] = [
  { value: 'ban', args: ['<player>', '[reason]'] },
  { value: 'ban-ip', args: ['<address>', '[reason]'] },
  { value: 'banlist', args: ['players', 'ips'] },
  { value: 'clear', args: ['<player>', '[item]'] },
  { value: 'deop', args: ['<player>'] },
  { value: 'difficulty', args: ['peaceful', 'easy', 'normal', 'hard'] },
  { value: 'effect', args: ['give', 'clear'] },
  { value: 'enchant', args: ['<player>', '<enchantment>'] },
  { value: 'execute', args: ['as', 'at', 'in', 'run'] },
  { value: 'experience', args: ['add', 'set', 'query'] },
  { value: 'gamemode', args: ['survival', 'creative', 'adventure', 'spectator'] },
  { value: 'gamerule', args: ['keepInventory', 'doDaylightCycle', 'doMobSpawning', 'mobGriefing', 'randomTickSpeed'] },
  { value: 'give', args: ['<player>', '<item>', '[count]'] },
  { value: 'help', args: ['[command]'] },
  { value: 'kick', args: ['<player>', '[reason]'] },
  { value: 'kill', args: ['<target>'] },
  { value: 'list' },
  { value: 'locate', args: ['structure', 'biome', 'poi'] },
  { value: 'me', args: ['<action>'] },
  { value: 'msg', args: ['<player>', '<message>'] },
  { value: 'op', args: ['<player>'] },
  { value: 'pardon', args: ['<player>'] },
  { value: 'pardon-ip', args: ['<address>'] },
  { value: 'playsound', args: ['<sound>', '<source>', '<player>'] },
  { value: 'reload' },
  { value: 'save-all' },
  { value: 'save-off' },
  { value: 'save-on' },
  { value: 'say', args: ['<message>'] },
  { value: 'seed' },
  { value: 'setblock', args: ['<pos>', '<block>'] },
  { value: 'setidletimeout', args: ['<minutes>'] },
  { value: 'setworldspawn', args: ['[pos]'] },
  { value: 'spawnpoint', args: ['<player>', '[pos]'] },
  { value: 'stop' },
  { value: 'summon', args: ['<entity>', '[pos]'] },
  { value: 'tellraw', args: ['<player>', '<json>'] },
  { value: 'time', args: ['set', 'add', 'query', 'day', 'noon', 'night', 'midnight'] },
  { value: 'title', args: ['<player>', 'title', 'subtitle', 'actionbar', 'clear', 'reset'] },
  { value: 'tp', args: ['<target>', '<destination>'] },
  { value: 'weather', args: ['clear', 'rain', 'thunder'] },
  { value: 'whitelist', args: ['on', 'off', 'list', 'add', 'remove', 'reload'] },
  { value: 'worldborder', args: ['add', 'center', 'damage', 'get', 'set', 'warning'] },
  { value: 'xp', args: ['add', 'set', 'query'] },
];

function getCommandCompletion(input: string, cursorPosition: number): InlineCompletion | null {
  const beforeCursor = input.slice(0, cursorPosition);
  const tokenStart = Math.max(beforeCursor.lastIndexOf(' ') + 1, 0);
  const token = beforeCursor.slice(tokenStart).replace(/^\//, '').toLowerCase();
  const matches = getCompletionMatches(input, cursorPosition);

  if (matches.length === 0 || beforeCursor.trim().length === 0) {
    return null;
  }

  const selected = matches[0];

  if (!selected) {
    return null;
  }
  const prefix = tokenStart === 0 && beforeCursor.startsWith('/') ? '/' : '';
  const replacement = selected.kind === 'command' ? `${prefix}${selected.value} ` : `${selected.value} `;

  if (!replacement.toLowerCase().startsWith(beforeCursor.slice(selected.replacementStart).toLowerCase())) {
    return null;
  }

  const suffix = replacement.slice(beforeCursor.length - selected.replacementStart);

  if (!suffix || token === selected.value.toLowerCase()) {
    return null;
  }

  const nextValue = `${input.slice(0, selected.replacementStart)}${replacement}${input.slice(selected.replacementEnd)}`;
  const nextCursor = selected.replacementStart + replacement.length;

  return { suffix, nextValue, nextCursor };
}

function getCompletionMatches(input: string, cursorPosition: number): CompletionMatch[] {
  const beforeCursor = input.slice(0, cursorPosition);
  const tokenStart = Math.max(beforeCursor.lastIndexOf(' ') + 1, 0);
  const nextSpaceIndex = input.indexOf(' ', cursorPosition);
  const tokenEnd = nextSpaceIndex === -1 ? input.length : nextSpaceIndex;
  const rawToken = beforeCursor.slice(tokenStart);
  const token = rawToken.replace(/^\//, '').toLowerCase();
  const commandName = beforeCursor.trimStart().replace(/^\//, '').split(/\s+/)[0]?.toLowerCase() ?? '';
  const isCommandToken = beforeCursor.trim().length === rawToken.trim().length;

  if (isCommandToken) {
    return COMMAND_COMPLETIONS
      .filter((item) => item.value.startsWith(token))
      .slice(0, 6)
      .map((item) => ({
        value: item.value,
        kind: 'command',
        replacementStart: tokenStart,
        replacementEnd: tokenEnd,
      }));
  }

  const command = COMMAND_COMPLETIONS.find((item) => item.value === commandName);

  if (!command) {
    return [];
  }

  if (rawToken.length === 0) {
    return [];
  }

  return (command.args ?? [])
    .filter((arg) => arg.toLowerCase().startsWith(token) || arg.startsWith('<') || arg.startsWith('['))
    .slice(0, 6)
    .map((arg) => ({
      value: arg,
      kind: 'argument',
      replacementStart: tokenStart,
      replacementEnd: tokenEnd,
    }));
}

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

export function ServerConsole({ logs, onClear, onSendCommand, isFullscreen, onToggleFullscreen, className }: ServerConsoleProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [command, setCommand] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const inlineCompletion = useMemo(() => {
    return isInputFocused && cursorPosition === command.length ? getCommandCompletion(command, cursorPosition) : null;
  }, [command, cursorPosition, isInputFocused]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendCommand = () => {
    const trimmed = command.trim();
    if (trimmed && onSendCommand) {
      onSendCommand(trimmed);
      setCommand('');
      setCursorPosition(0);
      inputRef.current?.focus();
    }
  };

  const applyCompletion = () => {
    if (!inlineCompletion) {
      return;
    }

    setCommand(inlineCompletion.nextValue);
    setCursorPosition(inlineCompletion.nextCursor);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inlineCompletion.nextCursor, inlineCompletion.nextCursor);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
      return;
    }

    if (e.key === 'Tab') {
      if (inlineCompletion) {
        e.preventDefault();
        applyCompletion();
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsInputFocused(false);
    }
  };

  const handleClear = () => {
    onClear?.();
    setShowClearDialog(false);
  };

  const syncCursorPosition = () => {
    setCursorPosition(inputRef.current?.selectionStart ?? command.length);
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
          <div className="flex items-center gap-1">
            {onToggleFullscreen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFullscreen}
                className="h-7 lg:h-8 px-2 text-xs"
                aria-label={isFullscreen ? t('server.consoleExitFullscreen') : t('server.consoleFullscreen')}
              >
                {isFullscreen ? (
                  <Minimize2 className="mr-1.5 h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
                ) : (
                  <Maximize2 className="mr-1.5 h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
                )}
                {isFullscreen ? t('server.consoleExitFullscreen') : t('server.consoleFullscreen')}
              </Button>
            )}
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
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 flex flex-col">
          <ScrollArea 
            className={cn(isFullscreen ? 'h-[calc(100vh-11rem)]' : 'h-[200px] lg:h-[350px]', 'rounded-none')}
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
            <div className="relative flex-1 rounded-md bg-secondary/50">
              <span
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 font-mono text-xs font-semibold text-primary/70"
                aria-hidden="true"
              >
                &gt;
              </span>
              {inlineCompletion && (
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 flex h-8 items-center overflow-hidden whitespace-pre rounded-md pl-7 pr-3 font-mono text-xs lg:h-9 lg:text-sm',
                    'text-muted-foreground/45'
                  )}
                  aria-hidden="true"
                >
                  <span className="text-transparent">{command}</span>
                  <span>{inlineCompletion.suffix}</span>
                </div>
              )}
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => {
                  setCommand(e.target.value);
                  setCursorPosition(e.currentTarget.selectionStart ?? e.target.value.length);
                  setIsInputFocused(true);
                }}
                onFocus={() => {
                  setIsInputFocused(true);
                  syncCursorPosition();
                }}
                onBlur={() => setIsInputFocused(false)}
                onClick={syncCursorPosition}
                onKeyDown={handleKeyDown}
                onKeyUp={syncCursorPosition}
                onSelect={syncCursorPosition}
                placeholder={t('server.commandPlaceholder')}
                className="relative z-10 h-8 pl-7 lg:h-9 text-xs lg:text-sm font-mono bg-transparent border-border/50 focus:border-primary/50 transition-colors"
                aria-label={t('server.commandPlaceholder')}
                aria-autocomplete="inline"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSendCommand}
              disabled={!command.trim()}
              className={cn(
                'group h-8 min-w-20 lg:h-9 px-3 text-xs font-semibold tracking-wide',
                'border border-primary/20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground',
                'shadow-sm shadow-primary/15 transition-all duration-200',
                'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/20',
                'active:translate-y-0 disabled:translate-y-0 disabled:border-border disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
                'ripple'
              )}
              aria-label={t('server.sendCommand', '發送指令')}
            >
              <Send className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 lg:h-4 lg:w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('server.sendCommand', '發送')}</span>
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
