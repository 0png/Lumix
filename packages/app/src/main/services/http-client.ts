/**
 * HTTP Client
 * 提供 HTTP 請求的工具函式
 */

import { createWriteStream, promises as fs } from 'fs';
import https from 'https';
import http from 'http';

const USER_AGENT = 'Lumix-Launcher/1.0 (https://github.com/lumix-launcher)';

export interface DownloadProgressCallback {
  (downloaded: number, total: number): void;
}

/**
 * 發送 HTTP GET 請求並解析 JSON 回應
 */
export function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': USER_AGENT },
    };

    protocol
      .get(url, options, (res) => {
        // 處理重定向
        if (res.statusCode === 301 || res.statusCode === 302) {
          let redirectUrl = res.headers.location;
          if (redirectUrl) {
            // 處理相對路徑重定向
            if (redirectUrl.startsWith('/')) {
              const baseUrl = new URL(url);
              redirectUrl = `${baseUrl.protocol}//${baseUrl.host}${redirectUrl}`;
            }
            fetchJson<T>(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP_ERROR: ${res.statusCode} - ${url}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`JSON_PARSE_ERROR: 無法解析回應 - ${url}`));
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * 下載檔案到指定路徑
 */
export function downloadFile(
  url: string,
  destPath: string,
  expectedSize: number,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': USER_AGENT },
    };

    protocol
      .get(url, options, (res) => {
        // 處理重定向
        if (res.statusCode === 301 || res.statusCode === 302) {
          let redirectUrl = res.headers.location;
          if (redirectUrl) {
            // 處理相對路徑重定向
            if (redirectUrl.startsWith('/')) {
              const baseUrl = new URL(url);
              redirectUrl = `${baseUrl.protocol}//${baseUrl.host}${redirectUrl}`;
            }
            downloadFile(redirectUrl, destPath, expectedSize, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`DOWNLOAD_ERROR: HTTP ${res.statusCode} - ${url}`));
          return;
        }

        const totalSize = expectedSize || parseInt(res.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        const fileStream = createWriteStream(destPath);

        res.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize > 0) {
            onProgress(downloadedSize, totalSize);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath).catch(() => {});
          reject(err);
        });
      })
      .on('error', (err) => {
        fs.unlink(destPath).catch(() => {});
        reject(err);
      });
  });
}
