// Log Parser - 日誌解析工具
// 負責解析 Minecraft 伺服器日誌格式

import type { LogEntry, LogLevel } from '../../models/types';

/**
 * 解析日誌行
 * 支援 Minecraft 標準日誌格式: [HH:MM:SS] [Thread/LEVEL]: Message
 */
export function parseLogLine(line: string, defaultLevel: LogLevel = 'info'): LogEntry {
  const timestamp = new Date();
  let level: LogLevel = defaultLevel;
  let message = line;

  // 嘗試解析 Minecraft 日誌格式: [HH:MM:SS] [Thread/LEVEL]: Message
  const mcLogPattern = /^\[[\d:]+\]\s*\[([^\]]+)\/(\w+)\]:\s*(.*)$/;
  const match = line.match(mcLogPattern);

  if (match && match[2] && match[3]) {
    const levelStr = match[2].toLowerCase();
    if (levelStr === 'warn' || levelStr === 'warning') {
      level = 'warn';
    } else if (levelStr === 'error' || levelStr === 'severe' || levelStr === 'fatal') {
      level = 'error';
    } else {
      level = 'info';
    }
    message = match[3];
  } else {
    // 簡單的關鍵字檢測
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('failed')) {
      level = 'error';
    } else if (lowerLine.includes('warn')) {
      level = 'warn';
    }
  }

  return { timestamp, level, message };
}

/**
 * 檢測伺服器是否已完成啟動
 */
export function isServerStartedMessage(line: string): boolean {
  return line.includes('Done') && line.includes('For help, type');
}
