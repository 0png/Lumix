/**
 * DownloadService
 * 處理 Minecraft 伺服器核心的版本獲取與下載
 */

import { EventEmitter } from 'events';
import path from 'path';
import type { CoreType, DownloadProgress } from '../../shared/ipc-types';
import { IpcErrorCode, formatIpcError, createIpcError } from '../../shared/ipc-types';
import { fetchJson, downloadFile } from './http-client';
import { runForgeInstaller } from './forge-installer';

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

interface PaperBuild {
  build: number;
  channel: string;
  downloads: { application: { name: string; sha256: string } };
}

interface PaperBuildsResponse {
  builds: PaperBuild[];
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
  FORGE_PROMOTIONS: 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
  FORGE_MAVEN: 'https://maven.minecraftforge.net/net/minecraftforge/forge',
} as const;

interface ForgePromotions {
  promos: Record<string, string>;
}

// ============================================================================
// DownloadService Class
// ============================================================================

export class DownloadService extends EventEmitter {
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
        return this.fetchPaperVersions();
      default:
        throw new Error(formatIpcError(createIpcError(
          IpcErrorCode.DOWNLOAD_UNSUPPORTED_CORE,
          `不支援的核心類型 ${coreType}`
        )));
    }
  }

  private async fetchVanillaVersions(): Promise<string[]> {
    const manifest = await fetchJson<VersionManifest>(API_ENDPOINTS.VANILLA_MANIFEST);
    return manifest.versions
      .filter((v) => v.type === 'release')
      .map((v) => v.id);
  }

  private async fetchPaperVersions(): Promise<string[]> {
    const data = await fetchJson<PaperProjectResponse>(API_ENDPOINTS.PAPER_PROJECT);
    return data.versions.reverse();
  }

  private async fetchFabricVersions(): Promise<string[]> {
    const data = await fetchJson<FabricGameVersion[]>(API_ENDPOINTS.FABRIC_GAME);
    return data
      .filter((v) => v.stable)
      .map((v) => v.version);
  }

  private async fetchForgeVersions(): Promise<string[]> {
    const data = await fetchJson<ForgePromotions>(API_ENDPOINTS.FORGE_PROMOTIONS);
    
    // 從 promos 中提取所有支援的 MC 版本
    // 格式: "1.21.1-latest": "52.0.1", "1.21.1-recommended": "52.0.1"
    const versions = new Set<string>();
    for (const key of Object.keys(data.promos)) {
      const mcVersion = key.replace(/-latest$/, '').replace(/-recommended$/, '');
      versions.add(mcVersion);
    }
    
    // 排序版本（新版在前）
    return Array.from(versions)
      .sort((a, b) => this.compareVersions(b, a));
  }

  /**
   * 比較 Minecraft 版本號
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
    const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA !== numB) return numA - numB;
    }
    return 0;
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
        await this.downloadPaperServer(mcVersion, jarPath, serverId);
        break;
      default:
        throw new Error(formatIpcError(createIpcError(
          IpcErrorCode.DOWNLOAD_UNSUPPORTED_CORE,
          `不支援的核心類型 ${coreType}`
        )));
    }

    return jarPath;
  }

  private async downloadVanillaServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    const manifest = await fetchJson<VersionManifest>(API_ENDPOINTS.VANILLA_MANIFEST);
    const versionInfo = manifest.versions.find((v) => v.id === mcVersion);
    if (!versionInfo) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `找不到 Vanilla ${mcVersion} 版本`
      )));
    }

    const versionData = await fetchJson<{
      downloads: { server: { url: string; size: number } };
    }>(versionInfo.url);

    if (!versionData.downloads?.server) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `${mcVersion} 沒有提供伺服器 JAR`
      )));
    }

    await this.downloadWithProgress(
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
    const buildsUrl = `${API_ENDPOINTS.PAPER_PROJECT}/versions/${mcVersion}/builds`;
    const buildsData = await fetchJson<PaperBuildsResponse>(buildsUrl);

    if (!buildsData.builds || buildsData.builds.length === 0) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `Paper ${mcVersion} 沒有可用的 build`
      )));
    }

    const latestBuild = buildsData.builds[buildsData.builds.length - 1]!;
    const downloadUrl = `${API_ENDPOINTS.PAPER_PROJECT}/versions/${mcVersion}/builds/${latestBuild.build}/downloads/paper-${mcVersion}-${latestBuild.build}.jar`;

    await this.downloadWithProgress(downloadUrl, jarPath, 0, serverId);
  }

  private async downloadFabricServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    const loaders = await fetchJson<FabricLoaderVersion[]>(API_ENDPOINTS.FABRIC_LOADER);
    const stableLoader = loaders.find((l) => l.stable);
    if (!stableLoader) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        '找不到穩定的 Fabric Loader'
      )));
    }

    const installers = await fetchJson<FabricInstallerVersion[]>(API_ENDPOINTS.FABRIC_INSTALLER);
    const stableInstaller = installers.find((i) => i.stable);
    if (!stableInstaller) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        '找不到穩定的 Fabric Installer'
      )));
    }

    const downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${stableLoader.version}/${stableInstaller.version}/server/jar`;
    await this.downloadWithProgress(downloadUrl, jarPath, 0, serverId);
  }

  private async downloadForgeServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    // 從 promotions_slim.json 獲取 Forge 版本
    const promos = await fetchJson<ForgePromotions>(API_ENDPOINTS.FORGE_PROMOTIONS);
    
    // 優先使用 recommended 版本，否則使用 latest
    const recommendedKey = `${mcVersion}-recommended`;
    const latestKey = `${mcVersion}-latest`;
    const forgeVersion = promos.promos[recommendedKey] || promos.promos[latestKey];
    
    if (!forgeVersion) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `Forge ${mcVersion} 沒有可用版本`
      )));
    }

    // 構建 Maven 下載連結
    // 格式: https://maven.minecraftforge.net/net/minecraftforge/forge/[MC版本]-[Forge版本]/forge-[MC版本]-[Forge版本]-installer.jar
    const forgeFullVersion = `${mcVersion}-${forgeVersion}`;
    const installerUrl = `${API_ENDPOINTS.FORGE_MAVEN}/${forgeFullVersion}/forge-${forgeFullVersion}-installer.jar`;
    
    const targetDir = path.dirname(jarPath);
    const installerPath = path.join(targetDir, 'forge-installer.jar');

    await this.downloadWithProgress(installerUrl, installerPath, 0, serverId);

    await runForgeInstaller(installerPath, targetDir);
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private async downloadWithProgress(
    url: string,
    destPath: string,
    expectedSize: number,
    serverId?: string
  ): Promise<void> {
    await downloadFile(url, destPath, expectedSize, (downloaded, total) => {
      if (serverId) {
        this.emit('progress', serverId, {
          downloaded,
          total,
          percentage: Math.round((downloaded / total) * 100),
        });
      }
    });
  }
}
