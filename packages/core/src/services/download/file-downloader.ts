// File Downloader
// 負責下載檔案並回報進度

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DownloadProgress } from '../../models/types';
import { ensureDir } from '../../utils/file-utils';

/**
 * 下載檔案選項
 */
export interface DownloadOptions {
  /** 進度回調 */
  onProgress?: (progress: DownloadProgress) => void;
  /** 超時時間（毫秒） */
  timeout?: number;
  /** 重試次數 */
  retries?: number;
}

const DEFAULT_TIMEOUT = 300000; // 5 分鐘
const DEFAULT_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 秒

/**
 * 下載檔案到指定路徑
 */
export async function downloadFile(
  url: string,
  destPath: string,
  options: DownloadOptions = {}
): Promise<string> {
  const { onProgress, timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES } = options;

  // 確保目標目錄存在
  await ensureDir(path.dirname(destPath));

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await downloadWithProgress(url, destPath, onProgress, timeout);
      return destPath;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retries) {
        // 等待後重試
        await sleep(RETRY_DELAY * attempt);
      }
    }
  }

  throw lastError || new Error('Download failed');
}

/**
 * 執行下載並回報進度
 */
async function downloadWithProgress(
  url: string,
  destPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  timeout?: number
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = timeout
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let downloaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      downloaded += value.length;

      if (onProgress) {
        const percentage = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        onProgress({
          downloaded,
          total,
          percentage: Math.min(percentage, 100), // 確保不超過 100
        });
      }
    }

    const buffer = Buffer.concat(chunks);
    await fs.writeFile(destPath, buffer);

    // 最終進度回報
    if (onProgress && total > 0) {
      onProgress({ downloaded: total, total, percentage: 100 });
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * 驗證下載的檔案
 */
export async function verifyDownload(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * 取得檔案大小
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * 輔助函式：等待指定時間
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
