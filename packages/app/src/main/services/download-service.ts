/**
 * DownloadService
 * 處理 Minecraft 伺服器核心的版本獲取與下載
 */

import { EventEmitter } from 'events';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import type { CoreType, DownloadProgress } from '../../shared/ipc-types';

// ============================================================================
// Types
// ============================================================================

export interface DownloadServiceEvents {
  progress: (serverId: string, progress: DownloadProgress) => void;
}

interface VersionManifest {
  versions: Array<{ id: string; type: string; url: string }>;
}

interface PaperProjectResponse {
  versions: string[];
}

interface PaperBuildsResponse {
  builds: number[];
}

interface FabricGameVersion {
  version: string;
  stable: boolean;
}

interface FabricLoaderVersion {
  version: string;
  stable: boolean;
}

interface FabricInstallerVersion {
  version: string;
  stable: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const API_ENDPOINTS = {
  VANILLA_MANIFEST: 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  PAPER_PROJECT: 'https://api.papermc.io/v2/projects/paper',
  FABRIC_GAME: 'https://meta.fabricmc.net/v2/versions/game',
  FABRIC_LOADER: 'https://meta.fabricmc.net/v2/versions/loader',
  FABRIC_INSTALLER: 'https://meta.fabricmc.net/v2/versions/installer',
  BMCLAPI_FORGE: 'https://bmclapi2.bangbang93.com/forge/minecraft',
} as const;

const USER_AGENT = 'Lumix-Launcher/1.0 (https://github.com/lumix-launcher)';

// ============================================================================
// DownloadService Class
// ============================================================================

export class DownloadService extends EventEmitter {
  constructor() {
    super();
  }

  // ==========================================================================
  // Version Fetching
  // ==========================================================================

  async fetchVersions(coreType: CoreType): Promise<string[]> {
    switch (coreType) {
      case 'vanilla':
        return this.fetchVanillaVersions();
      case 'paper':
        return this.fetchPaperVersions();
      case 'fabric':
        return this.fetchFabricVersions();
      case 'forge':
        return this.fetchForgeVersions();
      case 'spigot':
        // Spigot 使用與 Paper 相同的版本列表（簡化處理）
        return this.fetchPaperVersions();
      default:
        throw new Error(`UNSUPPORTED_CORE: 不支援的核心類型 ${coreType}`);
    }
  }

  private async fetchVanillaVersions(): Promise<string[]> {
    const manifest = await this.fetchJson<VersionManifest>(API_ENDPOINTS.VANILLA_MANIFEST);
    return manifest.versions
      .filter((v) => v.type === 'release')
      .map((v) => v.id)
      .slice(0, 30); // 只取最近 30 個版本
  }

  private async fetchPaperVersions(): Promise<string[]> {
    const data = await this.fetchJson<PaperProjectResponse>(API_ENDPOINTS.PAPER_PROJECT);
    return data.versions.reverse().slice(0, 30);
  }

  private async fetchFabricVersions(): Promise<string[]> {
    const data = await this.fetchJson<FabricGameVersion[]>(API_ENDPOINTS.FABRIC_GAME);
    return data
      .filter((v) => v.stable)
      .map((v) => v.version)
      .slice(0, 30);
  }

  private async fetchForgeVersions(): Promise<string[]> {
    const data = await this.fetchJson<string[]>(API_ENDPOINTS.BMCLAPI_FORGE);
    return data.reverse().slice(0, 30);
  }

  // ==========================================================================
  // Server Download
  // ==========================================================================

  async downloadServer(
    coreType: CoreType,
    mcVersion: string,
    targetDir: string,
    serverId?: string
  ): Promise<string> {
    const jarPath = path.join(targetDir, 'server.jar');

    switch (coreType) {
      case 'vanilla':
        await this.downloadVanillaServer(mcVersion, jarPath, serverId);
        break;
      case 'paper':
        await this.downloadPaperServer(mcVersion, jarPath, serverId);
        break;
      case 'fabric':
        await this.downloadFabricServer(mcVersion, jarPath, serverId);
        break;
      case 'forge':
        await this.downloadForgeServer(mcVersion, jarPath, serverId);
        break;
      case 'spigot':
        // Spigot 需要 BuildTools，暫時使用 Paper 替代
        await this.downloadPaperServer(mcVersion, jarPath, serverId);
        break;
      default:
        throw new Error(`UNSUPPORTED_CORE: 不支援的核心類型 ${coreType}`);
    }

    return jarPath;
  }

  private async downloadVanillaServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    // 1. 獲取版本清單
    const manifest = await this.fetchJson<VersionManifest>(API_ENDPOINTS.VANILLA_MANIFEST);
    const versionInfo = manifest.versions.find((v) => v.id === mcVersion);
    if (!versionInfo) {
      throw new Error(`VERSION_NOT_FOUND: 找不到 Vanilla ${mcVersion} 版本`);
    }

    // 2. 獲取版本詳細資訊
    const versionData = await this.fetchJson<{
      downloads: { server: { url: string; size: number } };
    }>(versionInfo.url);

    if (!versionData.downloads?.server) {
      throw new Error(`NO_SERVER_JAR: ${mcVersion} 沒有提供伺服器 JAR`);
    }

    // 3. 下載 server.jar
    await this.downloadFile(
      versionData.downloads.server.url,
      jarPath,
      versionData.downloads.server.size,
      serverId
    );
  }

  private async downloadPaperServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    // 1. 獲取該版本的 builds
    const buildsUrl = `${API_ENDPOINTS.PAPER_PROJECT}/versions/${mcVersion}/builds`;
    const buildsData = await this.fetchJson<PaperBuildsResponse>(buildsUrl);

    if (!buildsData.builds || buildsData.builds.length === 0) {
      throw new Error(`NO_BUILDS: Paper ${mcVersion} 沒有可用的 build`);
    }

    // 2. 取得最新 build
    const latestBuild = Math.max(...buildsData.builds);
    const downloadUrl = `${API_ENDPOINTS.PAPER_PROJECT}/versions/${mcVersion}/builds/${latestBuild}/downloads/paper-${mcVersion}-${latestBuild}.jar`;

    // 3. 下載
    await this.downloadFile(downloadUrl, jarPath, 0, serverId);
  }

  private async downloadFabricServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    // 1. 獲取最新的 loader 版本
    const loaders = await this.fetchJson<FabricLoaderVersion[]>(API_ENDPOINTS.FABRIC_LOADER);
    const stableLoader = loaders.find((l) => l.stable);
    if (!stableLoader) {
      throw new Error('NO_LOADER: 找不到穩定的 Fabric Loader');
    }

    // 2. 獲取最新的 installer 版本
    const installers = await this.fetchJson<FabricInstallerVersion[]>(
      API_ENDPOINTS.FABRIC_INSTALLER
    );
    const stableInstaller = installers.find((i) => i.stable);
    if (!stableInstaller) {
      throw new Error('NO_INSTALLER: 找不到穩定的 Fabric Installer');
    }

    // 3. 下載 server launcher jar
    const downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${stableLoader.version}/${stableInstaller.version}/server/jar`;
    await this.downloadFile(downloadUrl, jarPath, 0, serverId);
  }

  private async downloadForgeServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    // 使用 BMCLAPI 獲取 Forge 版本列表
    const forgeListUrl = `https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`;
    const forgeVersions = await this.fetchJson<Array<{ version: string; build: number }>>(
      forgeListUrl
    );

    if (!forgeVersions || forgeVersions.length === 0) {
      throw new Error(`NO_FORGE: Forge ${mcVersion} 沒有可用版本`);
    }

    // 取最新的 Forge 版本
    const latestForge = forgeVersions[forgeVersions.length - 1]!;

    // 下載 installer（Forge 需要先下載 installer 再執行安裝）
    const installerUrl = `https://bmclapi2.bangbang93.com/forge/download/${latestForge.build}`;
    const installerPath = path.join(path.dirname(jarPath), 'forge-installer.jar');

    await this.downloadFile(installerUrl, installerPath, 0, serverId);

    // 注意：Forge 需要執行 installer 來生成 server.jar
    // 這裡先下載 installer，實際安裝需要另外處理
    // 暫時將 installer 重命名為 server.jar
    await fs.rename(installerPath, jarPath);
  }

  // ==========================================================================
  // HTTP Utilities
  // ==========================================================================

  private fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const options = {
        headers: { 'User-Agent': USER_AGENT },
      };

      protocol
        .get(url, options, (res) => {
          // 處理重定向
          if (res.statusCode === 301 || res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              this.fetchJson<T>(redirectUrl).then(resolve).catch(reject);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP_ERROR: ${res.statusCode} - ${url}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error(`JSON_PARSE_ERROR: 無法解析回應 - ${url}`));
            }
          });
        })
        .on('error', reject);
    });
  }

  private downloadFile(
    url: string,
    destPath: string,
    expectedSize: number,
    serverId?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const options = {
        headers: { 'User-Agent': USER_AGENT },
      };

      protocol
        .get(url, options, (res) => {
          // 處理重定向
          if (res.statusCode === 301 || res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              this.downloadFile(redirectUrl, destPath, expectedSize, serverId)
                .then(resolve)
                .catch(reject);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`DOWNLOAD_ERROR: HTTP ${res.statusCode} - ${url}`));
            return;
          }

          const totalSize = expectedSize || parseInt(res.headers['content-length'] || '0', 10);
          let downloadedSize = 0;

          const fileStream = createWriteStream(destPath);

          res.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            if (serverId && totalSize > 0) {
              this.emit('progress', serverId, {
                downloaded: downloadedSize,
                total: totalSize,
                percentage: Math.round((downloadedSize / totalSize) * 100),
              });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (err) => {
            fs.unlink(destPath).catch(() => {});
            reject(err);
          });
        })
        .on('error', (err) => {
          fs.unlink(destPath).catch(() => {});
          reject(err);
        });
    });
  }
}
