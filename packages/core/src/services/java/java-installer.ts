// Java Installer
// 負責從 Adoptium API 下載和安裝 Java

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { JavaInstallation, DownloadProgress } from '../../models/types';
import { getJavaDir, ensureDir, fileExists } from '../../utils/file-utils';
import { getPlatform } from '../../utils/platform-utils';
import { verifyJavaAtPath } from './java-detector';

const execAsync = promisify(exec);

// Adoptium API 基礎 URL
const ADOPTIUM_API_BASE = 'https://api.adoptium.net/v3';

/**
 * 取得 Adoptium 下載 URL
 */
export function getAdoptiumDownloadUrl(majorVersion: number): string {
  const platform = getPlatform();
  const os = platform === 'windows' ? 'windows' : platform === 'macos' ? 'mac' : 'linux';
  const arch = process.arch === 'x64' ? 'x64' : 'aarch64';

  return `${ADOPTIUM_API_BASE}/binary/latest/${majorVersion}/ga/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;
}

/**
 * 下載並安裝 Java
 */
export async function installJava(
  majorVersion: number,
  onProgress?: (progress: DownloadProgress) => void
): Promise<JavaInstallation> {
  const javaDir = getJavaDir();
  const targetDir = path.join(javaDir, String(majorVersion));

  // 檢查是否已安裝
  if (await fileExists(targetDir)) {
    const existing = await verifyJavaAtPath(targetDir);
    if (existing) {
      return existing;
    }
    // 安裝損壞，移除後重新安裝
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  await ensureDir(javaDir);

  const downloadUrl = getAdoptiumDownloadUrl(majorVersion);
  const platform = getPlatform();
  const tempFile = path.join(javaDir, `java-${majorVersion}-temp.${platform === 'windows' ? 'zip' : 'tar.gz'}`);

  try {
    // 下載 Java
    await downloadFile(downloadUrl, tempFile, onProgress);

    // 解壓縮
    await extractArchive(tempFile, javaDir, platform);

    // 找到解壓縮後的目錄並重命名
    const extractedDir = await findExtractedJavaDir(javaDir, majorVersion);
    if (extractedDir && extractedDir !== targetDir) {
      await fs.rename(extractedDir, targetDir);
    }

    // 驗證安裝
    const installation = await verifyJavaAtPath(targetDir);
    if (!installation) {
      throw new Error(`Java ${majorVersion} installation verification failed`);
    }

    return installation;
  } finally {
    // 清理臨時檔案
    try {
      await fs.unlink(tempFile);
    } catch {
      // 忽略清理錯誤
    }
  }
}

/**
 * 下載檔案
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' });

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

    if (onProgress && total > 0) {
      onProgress({
        downloaded,
        total,
        percentage: Math.round((downloaded / total) * 100),
      });
    }
  }

  const buffer = Buffer.concat(chunks);
  await fs.writeFile(destPath, buffer);
}

/**
 * 解壓縮檔案
 */
async function extractArchive(
  archivePath: string,
  destDir: string,
  platform: 'windows' | 'macos' | 'linux'
): Promise<void> {
  if (platform === 'windows') {
    // 使用 PowerShell 解壓縮 ZIP
    await execAsync(
      `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
      { timeout: 300000 }
    );
  } else {
    // 使用 tar 解壓縮
    await execAsync(`tar -xzf "${archivePath}" -C "${destDir}"`, {
      timeout: 300000,
    });
  }
}

/**
 * 找到解壓縮後的 Java 目錄
 */
async function findExtractedJavaDir(
  baseDir: string,
  majorVersion: number
): Promise<string | null> {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const name = entry.name.toLowerCase();
      // Adoptium 解壓縮後的目錄名稱通常包含 jdk 和版本號
      if (name.includes('jdk') && name.includes(String(majorVersion))) {
        return path.join(baseDir, entry.name);
      }
    }
  }

  return null;
}

/**
 * 檢查是否已安裝指定版本的 Java
 */
export async function isJavaInstalled(majorVersion: number): Promise<boolean> {
  const targetDir = path.join(getJavaDir(), String(majorVersion));
  const installation = await verifyJavaAtPath(targetDir);
  return installation !== null;
}
