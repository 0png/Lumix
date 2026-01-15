// Java Module Exports

export * from './java-detector';
export * from './java-version-parser';
export * from './java-version-selector';
export * from './java-installer';

import type { JavaInstallation } from '../../models/types';
import { detectInstalledJava } from './java-detector';

/**
 * 檢測系統 Java 安裝（便利函式）
 */
export async function detectJavaInstallations(): Promise<JavaInstallation[]> {
  return detectInstalledJava();
}
