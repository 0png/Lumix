/**
 * Forge Installer
 * 處理 Forge 伺服器的安裝邏輯
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * 執行 Forge installer 以 headless 模式安裝伺服器
 */
export function runForgeInstaller(installerPath: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Forge installer 使用 --installServer 參數進行無頭安裝
    const args = ['-jar', installerPath, '--installServer'];
    console.log('[ForgeInstaller] Args:', args);
    console.log('[ForgeInstaller] Working directory:', targetDir);

    const proc = spawn('java', args, {
      cwd: targetDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data: Buffer) => {
      console.log('[ForgeInstaller]', data.toString().trim());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      console.error('[ForgeInstaller]', data.toString().trim());
    });

    proc.on('close', async (code: number) => {
      console.log('[ForgeInstaller] Exited with code:', code);

      if (code !== 0) {
        reject(new Error(`FORGE_INSTALL_FAILED: Installer 退出碼 ${code}`));
        return;
      }

      try {
        await setupForgeServerJar(targetDir, installerPath);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`FORGE_INSTALL_ERROR: ${err.message}`));
    });
  });
}

/**
 * 安裝完成後設定 server.jar
 * Forge 安裝後會生成多個檔案，需要找到正確的啟動 jar
 */
async function setupForgeServerJar(targetDir: string, installerPath: string): Promise<void> {
  const files = await fs.readdir(targetDir);
  console.log('[ForgeInstaller] Files after install:', files);

  const serverJarPath = path.join(targetDir, 'server.jar');

  // 尋找 forge server jar（舊版 Forge）
  const forgeJar = files.find(
    (f) =>
      f.startsWith('forge-') &&
      f.endsWith('.jar') &&
      !f.includes('installer') &&
      !f.includes('shim')
  );

  if (forgeJar) {
    // 舊版 Forge：直接重命名
    console.log('[ForgeInstaller] Found Forge jar:', forgeJar);
    await fs.rename(path.join(targetDir, forgeJar), serverJarPath);
  } else {
    // 新版 Forge (1.17+)：檢查是否有 run.bat/run.sh
    await setupNewForgeServer(targetDir, serverJarPath, files);
  }

  // 清理 installer
  await fs.unlink(installerPath).catch(() => {});
}

/**
 * 設定新版 Forge (1.17+) 的 server.jar
 */
async function setupNewForgeServer(
  targetDir: string,
  serverJarPath: string,
  files: string[]
): Promise<void> {
  const hasRunScript = files.some((f) => f === 'run.bat' || f === 'run.sh');

  if (!hasRunScript) {
    throw new Error('FORGE_JAR_NOT_FOUND: 安裝後找不到 Forge jar');
  }

  // 新版 Forge 使用 run.bat/run.sh 啟動
  const runBatPath = path.join(targetDir, 'run.bat');
  const runBatExists = await fs
    .access(runBatPath)
    .then(() => true)
    .catch(() => false);

  if (!runBatExists) {
    throw new Error('FORGE_JAR_NOT_FOUND: 找不到 run.bat');
  }

  const runBatContent = await fs.readFile(runBatPath, 'utf-8');
  console.log('[ForgeInstaller] run.bat content:', runBatContent);

  // 從 run.bat 中提取 @libraries 路徑
  const match = runBatContent.match(/@libraries[^\s]+\.jar/);
  if (!match) {
    throw new Error('FORGE_JAR_NOT_FOUND: 無法解析 run.bat');
  }

  const libJarPath = path.join(targetDir, match[0].replace('@', ''));
  const libJarExists = await fs
    .access(libJarPath)
    .then(() => true)
    .catch(() => false);

  if (!libJarExists) {
    throw new Error('FORGE_JAR_NOT_FOUND: 找不到 Forge 啟動 jar');
  }

  // 複製 library jar 到 server.jar
  await fs.copyFile(libJarPath, serverJarPath);
  console.log('[ForgeInstaller] Copied library jar to server.jar');
}
