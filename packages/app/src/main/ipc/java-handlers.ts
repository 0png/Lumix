/**
 * Java IPC Handlers
 * 處理 Java 偵測與管理的 IPC 請求
 */

import { ipcMain, BrowserWindow } from 'electron';
import { JavaChannels } from '../../shared/ipc-channels';
import { JavaDetector } from '../services/java-detector';
import { fetchJson, downloadFile } from '../services/http-client';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { spawn } from 'child_process';
import type {
  IpcResult,
  JavaInstallationDto,
  JavaInstallRequest,
  JavaRequiredVersionResult,
} from '../../shared/ipc-types';

// ============================================================================
// Module State
// ============================================================================

let javaDetector: JavaDetector | null = null;
let cachedInstallations: JavaInstallationDto[] | null = null;

// ============================================================================
// Adoptium API Types
// ============================================================================

interface AdoptiumAsset {
  binary: {
    package: {
      link: string;
      size: number;
      name: string;
    };
    image_type: string;
    os: string;
    architecture: string;
  };
  release_name: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
}

// ============================================================================
// Initialization
// ============================================================================

export function initJavaHandlers(): void {
  javaDetector = new JavaDetector();
  registerHandlers();
}

// ============================================================================
// Handler Registration
// ============================================================================

function registerHandlers(): void {
  // DETECT - 偵測系統上的 Java 安裝
  ipcMain.handle(
    JavaChannels.DETECT,
    async (): Promise<IpcResult<JavaInstallationDto[]>> => {
      try {
        console.log('[JavaHandlers] Detecting Java installations...');
        const installations = await javaDetector!.detectAll();
        cachedInstallations = installations;
        console.log('[JavaHandlers] Found installations:', installations);
        return { success: true, data: installations };
      } catch (error) {
        console.error('[JavaHandlers] Detection failed:', error);
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_INSTALLATIONS - 取得已偵測的 Java 安裝（使用快取）
  ipcMain.handle(
    JavaChannels.GET_INSTALLATIONS,
    async (): Promise<IpcResult<JavaInstallationDto[]>> => {
      try {
        if (!cachedInstallations) {
          cachedInstallations = await javaDetector!.detectAll();
        }
        return { success: true, data: cachedInstallations };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // INSTALL - 安裝 Java（使用 Adoptium API）
  ipcMain.handle(
    JavaChannels.INSTALL,
    async (_: unknown, data: JavaInstallRequest): Promise<IpcResult<JavaInstallationDto>> => {
      try {
        console.log('[JavaHandlers] Installing Java', data.majorVersion);
        const installation = await installJavaFromAdoptium(data.majorVersion);
        
        // 更新快取
        if (cachedInstallations) {
          const existing = cachedInstallations.findIndex((j) => j.majorVersion === data.majorVersion);
          if (existing >= 0) {
            cachedInstallations[existing] = installation;
          } else {
            cachedInstallations.push(installation);
          }
        }
        
        return { success: true, data: installation };
      } catch (error) {
        console.error('[JavaHandlers] Install failed:', error);
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_REQUIRED_VERSION - 取得 MC 版本所需的 Java 版本
  ipcMain.handle(
    JavaChannels.GET_REQUIRED_VERSION,
    async (_, mcVersion: string): Promise<IpcResult<JavaRequiredVersionResult>> => {
      try {
        const result = javaDetector!.getRequiredJavaVersion(mcVersion);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // SELECT_FOR_MC - 根據 Minecraft 版本選擇適合的 Java
  ipcMain.handle(
    JavaChannels.SELECT_FOR_MC,
    async (_, mcVersion: string): Promise<IpcResult<JavaInstallationDto | null>> => {
      try {
        console.log('[JavaHandlers] Selecting Java for MC version:', mcVersion);
        if (!cachedInstallations) {
          cachedInstallations = await javaDetector!.detectAll();
        }
        const selected = javaDetector!.selectForMinecraft(cachedInstallations, mcVersion);
        console.log('[JavaHandlers] Selected Java:', selected);
        return { success: true, data: selected };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// ============================================================================
// Java Installation from Adoptium
// ============================================================================

function getAdoptiumOS(): string {
  switch (process.platform) {
    case 'win32': return 'windows';
    case 'darwin': return 'mac';
    default: return 'linux';
  }
}

function getAdoptiumArch(): string {
  switch (process.arch) {
    case 'x64': return 'x64';
    case 'arm64': return 'aarch64';
    default: return 'x64';
  }
}

async function installJavaFromAdoptium(majorVersion: number): Promise<JavaInstallationDto> {
  const os = getAdoptiumOS();
  const arch = getAdoptiumArch();
  const imageType = 'jdk';
  
  // 取得最新版本資訊
  const apiUrl = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=${arch}&image_type=${imageType}&os=${os}&vendor=eclipse`;
  console.log('[JavaHandlers] Fetching Adoptium API:', apiUrl);
  
  const assets = await fetchJson<AdoptiumAsset[]>(apiUrl);
  if (!assets || assets.length === 0) {
    throw new Error(`JAVA_INSTALL_FAILED: 找不到 Java ${majorVersion} 的下載資源`);
  }
  
  const asset = assets[0]!;
  const downloadUrl = asset.binary.package.link;
  const fileName = asset.binary.package.name;
  const fileSize = asset.binary.package.size;
  
  // 準備下載目錄
  const javaDir = path.join(app.getPath('userData'), 'java');
  await fs.mkdir(javaDir, { recursive: true });
  
  const downloadPath = path.join(javaDir, fileName);
  const extractDir = path.join(javaDir, `jdk-${majorVersion}`);
  
  // 發送進度事件
  const sendProgress = (downloaded: number, total: number) => {
    const windows = BrowserWindow.getAllWindows();
    const percentage = Math.round((downloaded / total) * 100);
    windows.forEach((win) => {
      win.webContents.send(JavaChannels.INSTALL_PROGRESS, {
        majorVersion,
        progress: { downloaded, total, percentage },
      });
    });
  };
  
  // 下載
  console.log('[JavaHandlers] Downloading Java from:', downloadUrl);
  await downloadFile(downloadUrl, downloadPath, fileSize, sendProgress);
  
  // 解壓縮
  console.log('[JavaHandlers] Extracting to:', extractDir);
  await extractArchive(downloadPath, extractDir);
  
  // 清理下載檔案
  await fs.unlink(downloadPath).catch(() => {});
  
  // 找到 java 執行檔
  const javaPath = await findJavaExecutable(extractDir);
  if (!javaPath) {
    throw new Error('JAVA_INSTALL_FAILED: 解壓縮後找不到 java 執行檔');
  }
  
  return {
    path: javaPath,
    version: `${asset.version.major}.${asset.version.minor}.${asset.version.patch}`,
    majorVersion: asset.version.major,
    vendor: 'Eclipse Temurin',
    isValid: true,
  };
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  // 確保目標目錄存在
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });
  
  if (process.platform === 'win32') {
    // Windows: 使用 PowerShell 解壓縮 zip
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path "${archivePath}" -DestinationPath "${destDir}" -Force`,
      ], { stdio: 'pipe' });
      
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`解壓縮失敗，exit code: ${code}`));
      });
      proc.on('error', reject);
    });
  } else {
    // Linux/Mac: 使用 tar 解壓縮
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('tar', ['-xzf', archivePath, '-C', destDir, '--strip-components=1'], {
        stdio: 'pipe',
      });
      
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`解壓縮失敗，exit code: ${code}`));
      });
      proc.on('error', reject);
    });
  }
}

async function findJavaExecutable(baseDir: string): Promise<string | null> {
  const executable = process.platform === 'win32' ? 'java.exe' : 'java';
  
  // 嘗試常見路徑
  const possiblePaths = [
    path.join(baseDir, 'bin', executable),
    path.join(baseDir, 'Contents', 'Home', 'bin', executable), // macOS
  ];
  
  // 也檢查子目錄（解壓縮後可能有一層目錄）
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        possiblePaths.push(path.join(baseDir, entry.name, 'bin', executable));
        possiblePaths.push(path.join(baseDir, entry.name, 'Contents', 'Home', 'bin', executable));
      }
    }
  } catch {
    // ignore
  }
  
  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  
  return null;
}
