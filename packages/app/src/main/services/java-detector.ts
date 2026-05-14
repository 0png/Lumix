/**
 * JavaDetector Service
 * 偵測系統上安裝的 Java 版本
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import type { JavaInstallationDto } from '../../shared/ipc-types';
import { fetchJson } from './http-client';

// ============================================================================
// Constants
// ============================================================================

const WINDOWS_JAVA_PATHS = [
  'C:\\Program Files\\Java',
  'C:\\Program Files\\Eclipse Adoptium',
  'C:\\Program Files\\Temurin',
  'C:\\Program Files\\Microsoft\\jdk',
  'C:\\Program Files\\Zulu',
];

const LINUX_JAVA_PATHS = [
  '/usr/lib/jvm',
  '/usr/java',
  '/opt/java',
];

const MAC_JAVA_PATHS = [
  '/Library/Java/JavaVirtualMachines',
  '/System/Library/Java/JavaVirtualMachines',
];

const VANILLA_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

interface VersionManifest {
  versions: Array<{ id: string; url: string }>;
}

interface VersionMetadata {
  javaVersion?: {
    component?: string;
    majorVersion?: number;
  };
}

// ============================================================================
// JavaDetector Class
// ============================================================================

export class JavaDetector {
  private versionManifest: VersionManifest | null = null;

  /**
   * 偵測系統上所有的 Java 安裝
   */
  async detectAll(): Promise<JavaInstallationDto[]> {
    const installations: JavaInstallationDto[] = [];

    // 1. 先檢查 PATH 中的 java
    const pathJava = await this.detectFromPath();
    if (pathJava) {
      installations.push(pathJava);
    }

    // 2. 檢查 JAVA_HOME
    const javaHomeJava = await this.detectFromJavaHome();
    if (javaHomeJava && !this.isDuplicate(installations, javaHomeJava)) {
      installations.push(javaHomeJava);
    }

    // 3. 掃描常見安裝路徑
    const scannedJavas = await this.scanCommonPaths();
    for (const java of scannedJavas) {
      if (!this.isDuplicate(installations, java)) {
        installations.push(java);
      }
    }

    return installations;
  }

  /**
   * 從 PATH 環境變數偵測 Java
   */
  private async detectFromPath(): Promise<JavaInstallationDto | null> {
    // 先取得 java 的完整路徑
    const javaPath = await this.findJavaInPath();
    if (!javaPath) {
      return null;
    }

    // 使用完整路徑驗證 Java（不使用 shell，與 process-manager 一致）
    // 移除 windowsVerbatimArguments 以正確處理帶空格的路徑
    return new Promise((resolve) => {
      const proc = spawn(javaPath, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('error', () => {
        resolve(null);
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }

        const info = this.parseJavaVersion(output, javaPath);
        resolve(info);
      });

      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 5000);
    });
  }

  /**
   * 在 PATH 中尋找 java 執行檔的完整路徑
   */
  private async findJavaInPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const command = process.platform === 'win32' ? 'where' : 'which';
      const proc = spawn(command, ['java'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsVerbatimArguments: true,
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('error', () => {
        resolve(null);
      });

      proc.on('close', (code) => {
        if (code !== 0 || !output.trim()) {
          resolve(null);
          return;
        }

        // where/which 可能回傳多個路徑，取第一個
        const firstPath = output.trim().split('\n')[0]?.trim();
        resolve(firstPath || null);
      });

      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 5000);
    });
  }

  /**
   * 從 JAVA_HOME 環境變數偵測 Java
   */
  private async detectFromJavaHome(): Promise<JavaInstallationDto | null> {
    const javaHome = process.env.JAVA_HOME;
    if (!javaHome) return null;

    const javaPath = this.getJavaExecutable(javaHome);
    return this.getJavaInfo(javaPath);
  }

  /**
   * 掃描常見的 Java 安裝路徑
   */
  private async scanCommonPaths(): Promise<JavaInstallationDto[]> {
    const installations: JavaInstallationDto[] = [];
    const searchPaths = this.getSearchPaths();

    for (const basePath of searchPaths) {
      try {
        const entries = await fs.readdir(basePath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const jdkPath = path.join(basePath, entry.name);
            const javaPath = await this.findJavaExecutable(jdkPath);
            
            if (!javaPath) continue;

            const info = await this.getJavaInfo(javaPath);
            if (info) {
              installations.push(info);
            }
          }
        }
      } catch (error) {
        // Path not accessible, skip
      }
    }

    return installations;
  }

  /**
   * 取得 Java 執行檔的完整資訊
   */
  private async getJavaInfo(javaPath: string): Promise<JavaInstallationDto | null> {
    return new Promise((resolve) => {
      const proc = spawn(javaPath, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOccurred = false;

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('error', () => {
        errorOccurred = true;
        resolve(null);
      });

      proc.on('close', (code) => {
        if (errorOccurred) return;
        
        if (code !== 0) {
          resolve(null);
          return;
        }

        const info = this.parseJavaVersion(output, javaPath);
        resolve(info);
      });

      setTimeout(() => {
        if (!errorOccurred) {
          proc.kill();
          resolve(null);
        }
      }, 5000);
    });
  }

  /**
   * 解析 java -version 輸出
   */
  private parseJavaVersion(output: string, javaPath: string): JavaInstallationDto | null {
    // 範例輸出:
    // openjdk version "21.0.7" 2025-04-15 LTS
    // OpenJDK Runtime Environment Temurin-21.0.7+6 (build 21.0.7+6-LTS)
    // java version "1.8.0_421" (Java 8 格式)
    const versionMatch = output.match(/version "(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!versionMatch) return null;

    let major = parseInt(versionMatch[1]!, 10);
    const minor = versionMatch[2] ? parseInt(versionMatch[2], 10) : 0;
    const patch = versionMatch[3] ? parseInt(versionMatch[3], 10) : 0;

    // Java 8 特殊處理：版本號為 1.8.x，但 major version 應該是 8
    if (major === 1 && minor === 8) {
      major = 8;
    }

    // 偵測 vendor
    let vendor = 'Unknown';
    if (output.includes('Temurin')) vendor = 'Eclipse Temurin';
    else if (output.includes('OpenJDK')) vendor = 'OpenJDK';
    else if (output.includes('Oracle')) vendor = 'Oracle';
    else if (output.includes('Zulu')) vendor = 'Azul Zulu';
    else if (output.includes('Microsoft')) vendor = 'Microsoft';
    else if (output.includes('Amazon')) vendor = 'Amazon Corretto';

    return {
      path: javaPath,
      version: `${major}.${minor}.${patch}`,
      majorVersion: major,
      vendor,
      isValid: true,
    };
  }

  /**
   * 根據作業系統取得搜尋路徑
   */
  private getSearchPaths(): string[] {
    const systemPaths = (() => {
      switch (process.platform) {
        case 'win32':
          return WINDOWS_JAVA_PATHS;
        case 'darwin':
          return MAC_JAVA_PATHS;
        default:
          return LINUX_JAVA_PATHS;
      }
    })();

    // 加入應用程式自己下載的 Java 目錄
    const appJavaDir = path.join(app.getPath('userData'), 'java');
    return [appJavaDir, ...systemPaths];
  }

  /**
   * 根據 JDK 目錄取得 java 執行檔路徑
   */
  private getJavaExecutable(jdkPath: string): string {
    const executable = process.platform === 'win32' ? 'java.exe' : 'java';
    return path.join(jdkPath, 'bin', executable);
  }

  /**
   * 在 JDK 目錄或其常見巢狀目錄中尋找 java 執行檔
   */
  private async findJavaExecutable(jdkPath: string): Promise<string | null> {
    const executable = process.platform === 'win32' ? 'java.exe' : 'java';
    const possiblePaths = [
      path.join(jdkPath, 'bin', executable),
      path.join(jdkPath, 'Contents', 'Home', 'bin', executable),
    ];

    try {
      const entries = await fs.readdir(jdkPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        possiblePaths.push(path.join(jdkPath, entry.name, 'bin', executable));
        possiblePaths.push(path.join(jdkPath, entry.name, 'Contents', 'Home', 'bin', executable));
      }
    } catch {
      // ignore
    }

    for (const javaPath of possiblePaths) {
      try {
        await fs.access(javaPath);
        return javaPath;
      } catch {
        // continue
      }
    }

    return null;
  }

  /**
   * 檢查是否重複
   */
  private isDuplicate(list: JavaInstallationDto[], item: JavaInstallationDto): boolean {
    const normalize = (javaPath: string) => {
      const normalized = path.normalize(javaPath);
      return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    };

    return list.some((existing) => normalize(existing.path) === normalize(item.path));
  }

  /**
   * 根據 Minecraft 版本取得所需的 Java 版本
   */
  async getRequiredJavaVersion(mcVersion: string): Promise<{ requiredMajor: number; reason: string }> {
    const manifestResult = await this.getRequiredJavaVersionFromManifest(mcVersion);
    if (manifestResult) {
      return manifestResult;
    }

    return this.getFallbackRequiredJavaVersion(mcVersion);
  }

  private async getRequiredJavaVersionFromManifest(
    mcVersion: string
  ): Promise<{ requiredMajor: number; reason: string } | null> {
    try {
      if (!this.versionManifest) {
        this.versionManifest = await fetchJson<VersionManifest>(VANILLA_MANIFEST_URL);
      }

      const versionInfo = this.versionManifest.versions.find((version) => version.id === mcVersion);
      if (!versionInfo) return null;

      const metadata = await fetchJson<VersionMetadata>(versionInfo.url);
      const requiredMajor = metadata.javaVersion?.majorVersion;
      if (!requiredMajor) return null;

      const component = metadata.javaVersion?.component;
      const suffix = component ? ` (${component})` : '';
      return {
        requiredMajor,
        reason: `MC ${mcVersion} requires Java ${requiredMajor}${suffix}`,
      };
    } catch {
      return null;
    }
  }

  private getFallbackRequiredJavaVersion(mcVersion: string): { requiredMajor: number; reason: string } {
    const parts = mcVersion.split('.');
    const major = parseInt(parts[0] || '1', 10);
    const minor = parseInt(parts[1] || '0', 10);
    const patch = parseInt(parts[2] || '0', 10);

    if (major >= 26) {
      return { requiredMajor: 25, reason: 'MC 26.x requires Java 25' };
    } else if (major > 1 || minor >= 21) {
      return { requiredMajor: 21, reason: 'MC 1.21+ requires Java 21' };
    } else if (major === 1 && minor === 20 && patch >= 5) {
      return { requiredMajor: 21, reason: 'MC 1.20.5+ requires Java 21' };
    } else if (major >= 1 && minor >= 18) {
      return { requiredMajor: 17, reason: 'MC 1.18-1.20.4 requires Java 17' };
    } else if (major >= 1 && minor >= 17) {
      return { requiredMajor: 16, reason: 'MC 1.17 requires Java 16+' };
    }
    return { requiredMajor: 8, reason: 'MC 1.16 and below requires Java 8' };
  }

  /**
   * 根據 Minecraft 版本選擇適合的 Java
   */
  async selectForMinecraft(
    installations: JavaInstallationDto[],
    mcVersion: string
  ): Promise<JavaInstallationDto | null> {
    if (installations.length === 0) return null;

    const { requiredMajor } = await this.getRequiredJavaVersion(mcVersion);

    // 對於舊版 MC (Java 8)，優先選擇 Java 8，因為新版 Java 可能不相容
    // 對於新版 MC，選擇符合要求的最新版本
    if (requiredMajor === 8) {
      // 優先找 Java 8
      const java8 = installations.find((j) => j.majorVersion === 8);
      if (java8) return java8;
      // 沒有 Java 8，回傳 null（不要用新版 Java，會不相容）
      return null;
    }

    // 新版 MC：找到符合要求的最新版本
    const compatible = installations
      .filter((j) => j.majorVersion >= requiredMajor)
      .sort((a, b) => b.majorVersion - a.majorVersion);

    return compatible[0] || null;
  }
}
