/**
 * DownloadService
 * 處理 Minecraft 伺服器核心的版本獲取與下載
 */

import { EventEmitter } from 'events';
import path from 'path';
import type { CoreType, DownloadProgress } from '../../shared/ipc-types';
import { IpcErrorCode, formatIpcError, createIpcError } from '../../shared/ipc-types';
import { fetchJson, downloadFile } from './http-client';
import { runForgeInstaller, runNeoForgeInstaller } from './forge-installer';

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
  versions: Record<string, string[]>;
}

interface PurpurProjectResponse {
  versions: string[];
}

interface NeoForgeVersionsResponse {
  versions: string[];
}

export interface DownloadServerOptions {
  loaderVersion?: string;
  javaPath?: string;
}

interface PaperBuild {
  id: number;
  channel: string;
  downloads: Record<string, { name: string; url: string; size?: number }>;
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
  PAPER_PROJECT: 'https://fill.papermc.io/v3/projects/paper',
  PURPUR_PROJECT: 'https://api.purpurmc.org/v2/purpur',
  FABRIC_GAME: 'https://meta.fabricmc.net/v2/versions/game',
  FABRIC_LOADER: 'https://meta.fabricmc.net/v2/versions/loader',
  FABRIC_INSTALLER: 'https://meta.fabricmc.net/v2/versions/installer',
  FORGE_PROMOTIONS: 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
  FORGE_MAVEN: 'https://maven.minecraftforge.net/net/minecraftforge/forge',
  NEOFORGE_VERSIONS: 'https://maven.neoforged.net/api/maven/versions/releases/net%2Fneoforged%2Fneoforge',
  NEOFORGE_MAVEN: 'https://maven.neoforged.net/releases/net/neoforged/neoforge',
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
      case 'purpur':
        return this.fetchPurpurVersions();
      case 'fabric':
        return this.fetchFabricVersions();
      case 'forge':
        return this.fetchForgeVersions();
      case 'neoforge':
        return this.fetchNeoForgeVersions();
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
    return Object.values(data.versions)
      .flat()
      .sort((a, b) => this.compareVersions(b, a));
  }

  private async fetchPurpurVersions(): Promise<string[]> {
    const data = await fetchJson<PurpurProjectResponse>(API_ENDPOINTS.PURPUR_PROJECT);
    return data.versions.sort((a, b) => this.compareVersions(b, a));
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

  private async fetchNeoForgeVersions(): Promise<string[]> {
    const data = await fetchJson<NeoForgeVersionsResponse>(API_ENDPOINTS.NEOFORGE_VERSIONS);
    return Array.from(new Set(
      data.versions
        .filter(isSupportedNeoForgeRelease)
        .map(getNeoForgeMinecraftVersion)
        .filter((version): version is string => Boolean(version))
    )).sort((a, b) => this.compareVersions(b, a));
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
    serverId?: string,
    options: DownloadServerOptions = {}
  ): Promise<string> {
    const jarPath = path.join(targetDir, 'server.jar');

    switch (coreType) {
      case 'vanilla':
        await this.downloadVanillaServer(mcVersion, jarPath, serverId);
        break;
      case 'paper':
        await this.downloadPaperServer(mcVersion, jarPath, serverId);
        break;
      case 'purpur':
        await this.downloadPurpurServer(mcVersion, jarPath, serverId);
        break;
      case 'fabric':
        await this.downloadFabricServer(mcVersion, jarPath, serverId, options.loaderVersion);
        break;
      case 'forge':
        await this.downloadForgeServer(mcVersion, jarPath, serverId, options.loaderVersion, options.javaPath);
        break;
      case 'neoforge':
        await this.downloadNeoForgeServer(mcVersion, jarPath, serverId, options.loaderVersion, options.javaPath);
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
    const buildsData = await fetchJson<PaperBuild[]>(buildsUrl);

    if (!buildsData || buildsData.length === 0) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `Paper ${mcVersion} 沒有可用的 build`
      )));
    }

    const latestBuild = buildsData.find((build) => build.channel === 'STABLE') || buildsData[0]!;
    const download = latestBuild.downloads['server:default'];
    if (!download) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `Paper ${mcVersion} build ${latestBuild.id} 沒有可下載的 server JAR`
      )));
    }

    await this.downloadWithProgress(download.url, jarPath, download.size || 0, serverId);
  }

  private async downloadPurpurServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string
  ): Promise<void> {
    const project = await fetchJson<PurpurProjectResponse>(API_ENDPOINTS.PURPUR_PROJECT);
    if (!project.versions.includes(mcVersion)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `Purpur ${mcVersion} 沒有可用版本`
      )));
    }

    await this.downloadWithProgress(
      `${API_ENDPOINTS.PURPUR_PROJECT}/${encodeURIComponent(mcVersion)}/latest/download`,
      jarPath,
      0,
      serverId
    );
  }

  private async downloadFabricServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string,
    loaderVersion?: string
  ): Promise<void> {
    const loaders = await fetchJson<FabricLoaderVersion[]>(API_ENDPOINTS.FABRIC_LOADER);
    const stableLoader = loaderVersion
      ? loaders.find((loader) => loader.version === loaderVersion)
      : loaders.find((loader) => loader.stable);
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
    serverId?: string,
    requestedForgeVersion?: string,
    javaPath?: string
  ): Promise<void> {
    // 從 promotions_slim.json 獲取 Forge 版本
    let forgeVersion = requestedForgeVersion;
    if (!forgeVersion) {
      const promos = await fetchJson<ForgePromotions>(API_ENDPOINTS.FORGE_PROMOTIONS);
      // 優先使用 recommended 版本，否則使用 latest
      const recommendedKey = `${mcVersion}-recommended`;
      const latestKey = `${mcVersion}-latest`;
      forgeVersion = promos.promos[recommendedKey] || promos.promos[latestKey];
    }
    
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

    await runForgeInstaller(installerPath, targetDir, javaPath);
  }

  private async downloadNeoForgeServer(
    mcVersion: string,
    jarPath: string,
    serverId?: string,
    requestedNeoForgeVersion?: string,
    javaPath?: string
  ): Promise<void> {
    let neoForgeVersion = requestedNeoForgeVersion;
    if (!neoForgeVersion) {
      const data = await fetchJson<NeoForgeVersionsResponse>(API_ENDPOINTS.NEOFORGE_VERSIONS);
      neoForgeVersion = selectNeoForgeVersion(data.versions, mcVersion);
    }

    if (!neoForgeVersion || getNeoForgeMinecraftVersion(neoForgeVersion) !== normalizeMinecraftVersion(mcVersion)) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.DOWNLOAD_VERSION_NOT_FOUND,
        `NeoForge ${mcVersion} 沒有可用版本`
      )));
    }

    const targetDir = path.dirname(jarPath);
    const installerPath = path.join(targetDir, 'neoforge-installer.jar');
    const installerUrl = `${API_ENDPOINTS.NEOFORGE_MAVEN}/${encodeURIComponent(neoForgeVersion)}/neoforge-${encodeURIComponent(neoForgeVersion)}-installer.jar`;

    await this.downloadWithProgress(installerUrl, installerPath, 0, serverId);
    await runNeoForgeInstaller(installerPath, targetDir, javaPath);
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
    if (serverId) {
      this.emit('progress', serverId, {
        downloaded: 0,
        total: expectedSize,
        percentage: 0,
      });
    }

    await downloadFile(url, destPath, expectedSize, (downloaded, total) => {
      if (serverId) {
        this.emit('progress', serverId, {
          downloaded,
          total,
          percentage: total > 0 ? Math.round((downloaded / total) * 100) : 0,
        });
      }
    });
  }
}

export function getNeoForgeMinecraftVersion(neoForgeVersion: string): string | null {
  if (neoForgeVersion.startsWith('0')) return null;
  const match = neoForgeVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major >= 26) {
    return patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  }
  return minor === 0 ? `1.${major}` : `1.${major}.${minor}`;
}

export function selectNeoForgeVersion(versions: string[], mcVersion: string): string | undefined {
  const normalizedMcVersion = normalizeMinecraftVersion(mcVersion);
  const candidates = versions.filter(
    (version) => isSupportedNeoForgeRelease(version)
      && getNeoForgeMinecraftVersion(version) === normalizedMcVersion
  );
  const stable = candidates.filter((version) => !version.includes('-'));
  return [...(stable.length > 0 ? stable : candidates)].sort(compareNeoForgeVersions).at(-1);
}

function isSupportedNeoForgeRelease(version: string): boolean {
  return !version.startsWith('0') && (!version.includes('-') || version.includes('-beta'));
}

function normalizeMinecraftVersion(version: string): string {
  return version.replace(/\.0$/, '');
}

function compareNeoForgeVersions(a: string, b: string): number {
  const partsA = a.match(/^\d+(?:\.\d+)*/)?.[0].split('.').map(Number) ?? [];
  const partsB = b.match(/^\d+(?:\.\d+)*/)?.[0].split('.').map(Number) ?? [];
  for (let index = 0; index < Math.max(partsA.length, partsB.length); index += 1) {
    const difference = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.localeCompare(b);
}
