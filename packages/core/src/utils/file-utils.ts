// File system utilities for Lumix

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// 允許測試時覆蓋 home 目錄
let customHomeDir: string | null = null;

/**
 * 設定自訂 home 目錄（僅供測試使用）
 */
export function setCustomHomeDir(dir: string | null): void {
  customHomeDir = dir;
}

/**
 * 取得 home 目錄
 */
function getHomeDir(): string {
  if (customHomeDir) {
    return customHomeDir;
  }
  return os.homedir();
}

/**
 * 取得 Lumix 應用程式資料目錄
 * Windows: ~/.lumix
 */
export function getLumixDataDir(): string {
  return path.join(getHomeDir(), '.lumix');
}

/**
 * 取得設定檔路徑
 */
export function getSettingsPath(): string {
  return path.join(getLumixDataDir(), 'settings.json');
}

/**
 * 取得實例目錄
 */
export function getInstancesDir(): string {
  return path.join(getLumixDataDir(), 'instances');
}

/**
 * 取得 Java 安裝目錄
 */
export function getJavaDir(): string {
  return path.join(getLumixDataDir(), 'java');
}

/**
 * 確保目錄存在，如果不存在則建立
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 檢查檔案是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全讀取 JSON 檔案
 * 如果檔案不存在或損壞，回傳 null
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * 寫入 JSON 檔案
 * 自動建立父目錄
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 刪除目錄及其內容
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * 列出目錄中的子目錄
 */
export async function listSubDirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}
