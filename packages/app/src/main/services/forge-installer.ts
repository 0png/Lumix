/**
 * Mod Loader Installer
 * 處理 Forge 與 NeoForge 伺服器的安裝邏輯
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export type InstallerLoaderType = 'forge' | 'neoforge';

/**
 * 執行 Forge installer 以 headless 模式安裝伺服器
 */
export function runForgeInstaller(installerPath: string, targetDir: string, javaPath: string = 'java'): Promise<void> {
  return runModLoaderInstaller('forge', installerPath, targetDir, javaPath);
}

export function runNeoForgeInstaller(installerPath: string, targetDir: string, javaPath: string = 'java'): Promise<void> {
  return runModLoaderInstaller('neoforge', installerPath, targetDir, javaPath);
}

function runModLoaderInstaller(
  loader: InstallerLoaderType,
  installerPath: string,
  targetDir: string,
  javaPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Forge installer 使用 --installServer 參數進行無頭安裝
    // Windows 上路徑包含空格時，spawn 會自動處理引號
    const args = ['-jar', installerPath, '--installServer'];

    const proc = spawn(javaPath, args, {
      cwd: targetDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 移除 windowsVerbatimArguments，讓 Node.js 自動處理路徑引號
    });

    proc.stdout?.on('data', () => {
      // Forge installer output
    });

    proc.stderr?.on('data', (data: Buffer) => {
      console.error(`[${loader === 'forge' ? 'Forge' : 'NeoForge'}Installer]`, data.toString().trim());
    });

    proc.on('close', async (code: number) => {
      if (code !== 0) {
        reject(new Error(`${loader.toUpperCase()}_INSTALL_FAILED: Installer 退出碼 ${code}`));
        return;
      }

      try {
        await setupLoaderServer(loader, targetDir, installerPath);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`${loader.toUpperCase()}_INSTALL_ERROR: ${err.message}`));
    });
  });
}

/**
 * 安裝完成後設定 Loader 啟動資訊。
 */
async function setupLoaderServer(
  loader: InstallerLoaderType,
  targetDir: string,
  installerPath: string
): Promise<void> {
  const files = await fs.readdir(targetDir);

  const serverJarPath = path.join(targetDir, 'server.jar');

  // 尋找 forge server jar（舊版 Forge）
  const forgeJar = loader === 'forge' ? files.find(
    (f) =>
      f.startsWith('forge-') &&
      f.endsWith('.jar') &&
      !f.includes('installer') &&
      !f.includes('shim')
  ) : undefined;

  if (forgeJar) {
    // 舊版 Forge：直接重命名
    await fs.rename(path.join(targetDir, forgeJar), serverJarPath);
  } else {
    // 新版 Forge (1.17+)：檢查是否有 run.bat/run.sh
    await setupArgsFileServer(loader, targetDir, files);
  }

  // 清理 installer
  await fs.unlink(installerPath).catch(() => {});
}

/**
 * 設定使用 args file 啟動的新版 Forge / NeoForge。
 */
async function setupArgsFileServer(
  loader: InstallerLoaderType,
  targetDir: string,
  files: string[]
): Promise<void> {
  const hasRunScript = files.some((f) => f === 'run.bat' || f === 'run.sh');

  if (!hasRunScript) {
    throw new Error(`${loader.toUpperCase()}_ARGS_NOT_FOUND: 安裝後找不到 run.bat`);
  }

  // 新版 Forge 使用 run.bat/run.sh 啟動
  const runBatPath = path.join(targetDir, 'run.bat');
  const runBatExists = await fs
    .access(runBatPath)
    .then(() => true)
    .catch(() => false);

  if (!runBatExists) {
    throw new Error(`${loader.toUpperCase()}_ARGS_NOT_FOUND: 找不到 run.bat`);
  }

  const runBatContent = await fs.readFile(runBatPath, 'utf-8');

  // 從 run.bat 中提取完整的 java 參數
  // 新版 Forge run.bat 格式類似：
  // java @user_jvm_args.txt @libraries/net/minecraftforge/.../win_args.txt %*
  const argsMatch = runBatContent.match(/@libraries[^\s]+args\.txt/);
  
  if (argsMatch) {
    // 新版 Forge 使用 args.txt 檔案
    const argsFilePath = path.join(targetDir, argsMatch[0].replace('@', ''));
    const argsFileExists = await fs
      .access(argsFilePath)
      .then(() => true)
      .catch(() => false);

    if (argsFileExists) {
      // 新版 Forge 由 args.txt 與 user_jvm_args.txt 驅動啟動流程。
      // 這裡只需要保存必要的啟動配置，實際啟動由 ServerManager 處理。
      const loaderConfig = {
        type: 'args-file',
        loader,
        argsFile: argsMatch[0].replace('@', ''),
        userJvmArgsFile: 'user_jvm_args.txt',
      };

      await fs.writeFile(
        path.join(targetDir, 'loader-config.json'),
        JSON.stringify(loaderConfig, null, 2)
      );

      // 建立 user_jvm_args.txt 如果不存在
      const userJvmArgsPath = path.join(targetDir, 'user_jvm_args.txt');
      const userJvmArgsExists = await fs
        .access(userJvmArgsPath)
        .then(() => true)
        .catch(() => false);
      
      if (!userJvmArgsExists) {
        await fs.writeFile(userJvmArgsPath, '# Add custom JVM arguments here\n');
      }

      // args file Loader 不需要 server.jar；ServerManager 會讀取 loader-config.json。
      return;
    }
  }

  // 嘗試舊的方式：從 run.bat 中提取 @libraries 路徑
  const libMatch = runBatContent.match(/@libraries[^\s]+\.jar/);
  if (!libMatch) {
    throw new Error(`${loader.toUpperCase()}_ARGS_NOT_FOUND: 無法解析 run.bat`);
  }

  const libJarPath = path.join(targetDir, libMatch[0].replace('@', ''));
  const libJarExists = await fs
    .access(libJarPath)
    .then(() => true)
    .catch(() => false);

  if (!libJarExists) {
    throw new Error(`${loader.toUpperCase()}_ARGS_NOT_FOUND: 找不到 Loader 啟動 jar`);
  }

  // 複製 library jar 到 server.jar
  await fs.copyFile(libJarPath, path.join(targetDir, 'server.jar'));
}
