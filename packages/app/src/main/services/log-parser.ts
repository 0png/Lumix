/**
 * Log Parser Utilities
 * 解析 Minecraft 伺服器日誌
 */

import type { LogLevel } from '../../shared/ipc-types';

/**
 * 解析日誌等級
 */
export function parseLogLevel(line: string): LogLevel | null {
  const lowerLine = line.toLowerCase();
  if (lowerLine.includes('[warn]') || lowerLine.includes('/warn]')) {
    return 'warn';
  }
  if (lowerLine.includes('[error]') || lowerLine.includes('/error]') || lowerLine.includes('exception')) {
    return 'error';
  }
  if (lowerLine.includes('[info]') || lowerLine.includes('/info]')) {
    return 'info';
  }
  return null;
}

/**
 * 分割多行輸出
 */
export function splitLogLines(data: string): string[] {
  return data.split(/\r?\n/).filter((line) => line.trim());
}
