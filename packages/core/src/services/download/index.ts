// Download Module Exports

export * from './version-fetcher';
export * from './file-downloader';

import type { CoreType, DownloadProgress } from '../../models/types';
import { getAvailableVersions, getServerDownloadUrl } from './version-fetcher';
import { downloadFile } from './file-downloader';
import path from 'node:path';

/**
 * 取得版本列表（便利函式）
 */
export async function fetchVersions(coreType: CoreType): Promise<string[]> {
  return getAvailableVersions(coreType);
}

/**
 * 下載伺服器 JAR 檔案
 */
export async function downloadServerJar(
  coreType: CoreType,
  mcVersion: string,
  targetDir: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  const url = await getServerDownloadUrl(coreType, mcVersion);
  const fileName = `server.jar`;
  const destPath = path.join(targetDir, fileName);
  
  await downloadFile(url, destPath, { onProgress });
  return destPath;
}
