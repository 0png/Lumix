// Java Version Selector
// 負責根據 Minecraft 版本選擇適合的 Java 版本

import type { JavaInstallation } from '../../models/types';

/**
 * Minecraft 版本與 Java 版本對應規則
 * - MC 1.12.2-1.16.5 -> Java 8+
 * - MC 1.17-1.20.4 -> Java 17+
 * - MC 1.20.5+ -> Java 21+
 */

/**
 * 取得 Minecraft 版本所需的最低 Java 版本
 */
export function getRequiredJavaVersion(mcVersion: string): number {
  const parsed = parseMinecraftVersion(mcVersion);
  
  if (!parsed) {
    // 無法解析時，預設使用 Java 17（最常見）
    return 17;
  }

  const { minor, patch } = parsed;

  // MC 1.20.5+ 需要 Java 21
  if (minor > 20 || (minor === 20 && (patch ?? 0) >= 5)) {
    return 21;
  }

  // MC 1.17-1.20.4 需要 Java 17
  if (minor >= 17) {
    return 17;
  }

  // MC 1.16.5 及更早版本需要 Java 8
  return 8;
}

/**
 * 從已安裝的 Java 中選擇適合的版本
 * 優先選擇剛好符合需求的版本，避免使用過新的版本
 */
export function selectJavaForMinecraft(
  mcVersion: string,
  installations: JavaInstallation[]
): JavaInstallation | null {
  if (installations.length === 0) {
    return null;
  }

  const requiredVersion = getRequiredJavaVersion(mcVersion);
  
  // 過濾出符合最低版本要求的 Java
  const compatible = installations.filter(
    (java) => java.majorVersion >= requiredVersion
  );

  if (compatible.length === 0) {
    return null;
  }

  // 排序：優先選擇版本最接近需求的（避免過新）
  compatible.sort((a, b) => a.majorVersion - b.majorVersion);

  return compatible[0] ?? null;
}

/**
 * 檢查 Java 版本是否與 Minecraft 版本相容
 */
export function isJavaCompatible(
  javaMajorVersion: number,
  mcVersion: string
): boolean {
  const requiredVersion = getRequiredJavaVersion(mcVersion);
  return javaMajorVersion >= requiredVersion;
}

/**
 * 解析 Minecraft 版本字串
 * 支援格式：1.20.4, 1.17, 1.12.2
 */
interface MinecraftVersion {
  major: number;
  minor: number;
  patch?: number;
}

function parseMinecraftVersion(version: string): MinecraftVersion | null {
  const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : undefined,
  };
}

/**
 * 取得建議安裝的 Java 版本列表
 * 根據常見的 Minecraft 版本需求
 */
export function getRecommendedJavaVersions(): number[] {
  return [8, 17, 21];
}
