// Platform-specific utilities for Lumix

import os from 'node:os';
import path from 'node:path';

/**
 * 取得當前平台
 */
export function getPlatform(): 'windows' | 'macos' | 'linux' {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return 'linux';
  }
}

/**
 * 取得 Java 可執行檔名稱
 */
export function getJavaExecutable(): string {
  return getPlatform() === 'windows' ? 'java.exe' : 'java';
}

/**
 * 取得 Windows 常見的 Java 安裝路徑
 */
export function getCommonJavaPaths(): string[] {
  const platform = getPlatform();

  if (platform === 'windows') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    return [
      path.join(programFiles, 'Java'),
      path.join(programFiles, 'Eclipse Adoptium'),
      path.join(programFiles, 'Temurin'),
      path.join(programFiles, 'Microsoft'),
      path.join(programFilesX86, 'Java'),
    ];
  }

  // macOS / Linux
  return [
    '/usr/lib/jvm',
    '/Library/Java/JavaVirtualMachines',
    path.join(os.homedir(), '.sdkman/candidates/java'),
  ];
}

/**
 * 取得系統總記憶體 (MB)
 */
export function getTotalMemoryMB(): number {
  return Math.floor(os.totalmem() / (1024 * 1024));
}

/**
 * 取得建議的最大 RAM 配置 (MB)
 * 預設為系統記憶體的 50%，最大 8GB
 */
export function getRecommendedMaxRam(): number {
  const totalMB = getTotalMemoryMB();
  const halfMemory = Math.floor(totalMB / 2);
  return Math.min(halfMemory, 8192);
}
