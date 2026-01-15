// Java Detector
// 負責檢測系統中已安裝的 Java

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { JavaInstallation } from '../../models/types';
import { parseJavaVersionOutput, createJavaInstallation } from './java-version-parser';
import { getCommonJavaPaths, getJavaExecutable } from '../../utils/platform-utils';
import { getJavaDir, fileExists } from '../../utils/file-utils';

const execAsync = promisify(exec);

/**
 * 檢測系統中所有已安裝的 Java
 */
export async function detectInstalledJava(): Promise<JavaInstallation[]> {
  const installations: JavaInstallation[] = [];
  const checkedPaths = new Set<string>();

  // 1. 檢查 JAVA_HOME 環境變數
  const javaHome = process.env['JAVA_HOME'];
  if (javaHome) {
    const installation = await verifyJavaAtPath(javaHome);
    if (installation && !checkedPaths.has(installation.path)) {
      installations.push(installation);
      checkedPaths.add(installation.path);
    }
  }

  // 2. 檢查 Lumix 自動安裝的 Java
  const lumixJavaInstalls = await detectLumixJava();
  for (const install of lumixJavaInstalls) {
    if (!checkedPaths.has(install.path)) {
      installations.push(install);
      checkedPaths.add(install.path);
    }
  }

  // 3. 檢查系統常見路徑
  const commonPaths = getCommonJavaPaths();
  for (const basePath of commonPaths) {
    const found = await scanJavaDirectory(basePath);
    for (const install of found) {
      if (!checkedPaths.has(install.path)) {
        installations.push(install);
        checkedPaths.add(install.path);
      }
    }
  }

  // 4. 檢查 PATH 中的 java
  const pathJava = await detectJavaInPath();
  if (pathJava && !checkedPaths.has(pathJava.path)) {
    installations.push(pathJava);
  }

  return installations;
}

/**
 * 檢測 Lumix 自動安裝的 Java
 */
async function detectLumixJava(): Promise<JavaInstallation[]> {
  const installations: JavaInstallation[] = [];
  const javaDir = getJavaDir();

  if (!(await fileExists(javaDir))) {
    return installations;
  }

  try {
    const entries = await fs.readdir(javaDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const javaPath = path.join(javaDir, entry.name);
        const installation = await verifyJavaAtPath(javaPath);
        if (installation) {
          installations.push(installation);
        }
      }
    }
  } catch {
    // 忽略讀取錯誤
  }

  return installations;
}

/**
 * 掃描目錄中的 Java 安裝
 */
async function scanJavaDirectory(basePath: string): Promise<JavaInstallation[]> {
  const installations: JavaInstallation[] = [];

  if (!(await fileExists(basePath))) {
    return installations;
  }

  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const javaPath = path.join(basePath, entry.name);
        const installation = await verifyJavaAtPath(javaPath);
        if (installation) {
          installations.push(installation);
        }
      }
    }
  } catch {
    // 忽略讀取錯誤
  }

  return installations;
}

/**
 * 檢測 PATH 環境變數中的 java
 */
async function detectJavaInPath(): Promise<JavaInstallation | null> {
  try {
    const { stdout } = await execAsync('java -version 2>&1', { timeout: 10000 });
    const parsed = parseJavaVersionOutput(stdout);
    
    if (parsed) {
      // 取得 java 的實際路徑
      const javaPath = await getJavaPathFromCommand();
      if (javaPath) {
        return createJavaInstallation(javaPath, parsed.version, parsed.majorVersion);
      }
    }
  } catch {
    // java 不在 PATH 中
  }

  return null;
}

/**
 * 從 where/which 命令取得 java 路徑
 */
async function getJavaPathFromCommand(): Promise<string | null> {
  try {
    const command = process.platform === 'win32' ? 'where java' : 'which java';
    const { stdout } = await execAsync(command, { timeout: 5000 });
    const lines = stdout.trim().split('\n');
    return lines[0]?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * 驗證指定路徑的 Java 安裝
 */
export async function verifyJavaAtPath(javaHome: string): Promise<JavaInstallation | null> {
  const javaExe = getJavaExecutable();
  const javaBinPath = path.join(javaHome, 'bin', javaExe);

  // 檢查 java 執行檔是否存在
  if (!(await fileExists(javaBinPath))) {
    return null;
  }

  try {
    const { stdout, stderr } = await execAsync(`"${javaBinPath}" -version 2>&1`, {
      timeout: 10000,
    });
    
    const output = stdout || stderr;
    const parsed = parseJavaVersionOutput(output);
    
    if (parsed) {
      return createJavaInstallation(javaHome, parsed.version, parsed.majorVersion);
    }
  } catch {
    // 執行失敗
  }

  return null;
}
