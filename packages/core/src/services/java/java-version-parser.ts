// Java Version Parser
// 負責解析 Java 版本字串

import type { JavaInstallation } from '../../models/types';

/**
 * 解析 Java 版本輸出字串
 * 支援格式：
 * - "1.8.0_xxx" (Java 8)
 * - "11.0.x" (Java 11)
 * - "17.0.x" (Java 17)
 * - "21.0.x" (Java 21)
 */
export function parseJavaVersionOutput(output: string): { version: string; majorVersion: number } | null {
  // 嘗試匹配 "version" 後面的版本號
  // 例如: openjdk version "17.0.2" 或 java version "1.8.0_301"
  const versionMatch = output.match(/version\s+"([^"]+)"/i);
  
  if (!versionMatch) {
    return null;
  }

  const version = versionMatch[1];
  const majorVersion = extractMajorVersion(version);

  if (majorVersion === null) {
    return null;
  }

  return { version, majorVersion };
}

/**
 * 從版本字串提取主版本號
 * - "1.8.0_xxx" -> 8
 * - "11.0.x" -> 11
 * - "17.0.x" -> 17
 */
export function extractMajorVersion(version: string): number | null {
  // Java 8 及更早版本使用 1.x 格式
  const legacyMatch = version.match(/^1\.(\d+)/);
  if (legacyMatch) {
    return parseInt(legacyMatch[1], 10);
  }

  // Java 9+ 使用 x.y.z 格式
  const modernMatch = version.match(/^(\d+)/);
  if (modernMatch) {
    return parseInt(modernMatch[1], 10);
  }

  return null;
}

/**
 * 建立 JavaInstallation 物件
 */
export function createJavaInstallation(
  javaPath: string,
  version: string,
  majorVersion: number
): JavaInstallation {
  return {
    path: javaPath,
    version,
    majorVersion,
  };
}

/**
 * 驗證版本字串格式是否有效
 */
export function isValidVersionString(version: string): boolean {
  // 支援 1.8.x, 11.x, 17.x, 21.x 等格式
  return /^(1\.\d+|\d+)(\.\d+)*(_\d+)?(-[a-zA-Z0-9]+)?$/.test(version);
}
