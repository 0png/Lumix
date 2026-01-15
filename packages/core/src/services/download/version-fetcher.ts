// Version Fetcher
// 負責從各 API 取得 Minecraft 伺服器版本列表

import type { CoreType } from '../../models/types';

// API URLs
const MOJANG_VERSION_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const PAPER_API_BASE = 'https://api.papermc.io/v2';
const FABRIC_API_BASE = 'https://meta.fabricmc.net/v2';

// ============================================================================
// Vanilla (Mojang)
// ============================================================================

interface MojangVersionManifest {
  versions: Array<{
    id: string;
    type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
    url: string;
  }>;
}

interface MojangVersionDetail {
  downloads?: {
    server?: {
      url: string;
    };
  };
}

/**
 * 取得 Vanilla 版本列表
 */
export async function getVanillaVersions(): Promise<string[]> {
  const response = await fetch(MOJANG_VERSION_MANIFEST);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Vanilla versions: ${response.status}`);
  }

  const manifest = (await response.json()) as MojangVersionManifest;
  
  // 只回傳正式版本
  return manifest.versions
    .filter((v) => v.type === 'release')
    .map((v) => v.id);
}

/**
 * 取得 Vanilla 伺服器下載 URL
 */
export async function getVanillaServerUrl(version: string): Promise<string> {
  const response = await fetch(MOJANG_VERSION_MANIFEST);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Vanilla manifest: ${response.status}`);
  }

  const manifest = (await response.json()) as MojangVersionManifest;
  const versionInfo = manifest.versions.find((v) => v.id === version);
  
  if (!versionInfo) {
    throw new Error(`Vanilla version ${version} not found`);
  }

  // 取得版本詳細資訊
  const versionResponse = await fetch(versionInfo.url);
  if (!versionResponse.ok) {
    throw new Error(`Failed to fetch version info: ${versionResponse.status}`);
  }

  const versionData = (await versionResponse.json()) as MojangVersionDetail;
  const serverUrl = versionData.downloads?.server?.url;
  
  if (!serverUrl) {
    throw new Error(`Server download not available for ${version}`);
  }

  return serverUrl;
}

// ============================================================================
// Paper
// ============================================================================

interface PaperProjectResponse {
  versions: string[];
}

interface PaperBuildsResponse {
  builds: Array<{
    build: number;
    downloads: {
      application: {
        name: string;
      };
    };
  }>;
}

/**
 * 取得 Paper 版本列表
 */
export async function getPaperVersions(): Promise<string[]> {
  const response = await fetch(`${PAPER_API_BASE}/projects/paper`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Paper versions: ${response.status}`);
  }

  const data = (await response.json()) as PaperProjectResponse;
  
  // 回傳倒序（最新版本在前）
  return [...data.versions].reverse();
}

/**
 * 取得 Paper 伺服器下載 URL
 */
export async function getPaperServerUrl(version: string): Promise<string> {
  // 取得該版本的 builds
  const buildsResponse = await fetch(
    `${PAPER_API_BASE}/projects/paper/versions/${version}/builds`
  );
  
  if (!buildsResponse.ok) {
    throw new Error(`Failed to fetch Paper builds: ${buildsResponse.status}`);
  }

  const buildsData = (await buildsResponse.json()) as PaperBuildsResponse;
  
  if (buildsData.builds.length === 0) {
    throw new Error(`No builds available for Paper ${version}`);
  }

  // 取得最新的 build
  const latestBuild = buildsData.builds[buildsData.builds.length - 1]!;
  const fileName = latestBuild.downloads.application.name;

  return `${PAPER_API_BASE}/projects/paper/versions/${version}/builds/${latestBuild.build}/downloads/${fileName}`;
}

// ============================================================================
// Fabric
// ============================================================================

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

/**
 * 取得 Fabric 支援的 Minecraft 版本列表
 */
export async function getFabricVersions(): Promise<string[]> {
  const response = await fetch(`${FABRIC_API_BASE}/versions/game`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Fabric versions: ${response.status}`);
  }

  const versions = (await response.json()) as FabricGameVersion[];
  
  // 只回傳穩定版本
  return versions.filter((v) => v.stable).map((v) => v.version);
}

/**
 * 取得 Fabric 伺服器下載 URL
 */
export async function getFabricServerUrl(version: string): Promise<string> {
  // 取得最新的 loader 版本
  const loaderResponse = await fetch(`${FABRIC_API_BASE}/versions/loader`);
  if (!loaderResponse.ok) {
    throw new Error(`Failed to fetch Fabric loader: ${loaderResponse.status}`);
  }
  const loaders = (await loaderResponse.json()) as FabricLoaderVersion[];
  const stableLoader = loaders.find((l) => l.stable);
  if (!stableLoader) {
    throw new Error('No stable Fabric loader found');
  }

  // 取得最新的 installer 版本
  const installerResponse = await fetch(`${FABRIC_API_BASE}/versions/installer`);
  if (!installerResponse.ok) {
    throw new Error(`Failed to fetch Fabric installer: ${installerResponse.status}`);
  }
  const installers = (await installerResponse.json()) as FabricInstallerVersion[];
  const stableInstaller = installers.find((i) => i.stable);
  if (!stableInstaller) {
    throw new Error('No stable Fabric installer found');
  }

  return `${FABRIC_API_BASE}/versions/loader/${version}/${stableLoader.version}/${stableInstaller.version}/server/jar`;
}

// ============================================================================
// Forge (簡化版本，Forge API 較複雜)
// ============================================================================

const FORGE_MAVEN_BASE = 'https://maven.minecraftforge.net';

/**
 * 取得 Forge 版本列表
 * 注意：Forge 的 API 較複雜，這裡提供簡化版本
 */
export async function getForgeVersions(): Promise<string[]> {
  // Forge 沒有簡單的版本列表 API，回傳常見的支援版本
  return [
    '1.20.4', '1.20.2', '1.20.1', '1.20',
    '1.19.4', '1.19.3', '1.19.2', '1.19',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1', '1.16.5', '1.12.2',
  ];
}

/**
 * 取得 Forge 伺服器下載 URL
 * 注意：Forge 需要安裝器，這裡回傳安裝器 URL
 */
export async function getForgeServerUrl(version: string): Promise<string> {
  // Forge 版本對應表（簡化）
  const forgeVersionMap: Record<string, string> = {
    '1.20.4': '49.0.30',
    '1.20.2': '48.1.0',
    '1.20.1': '47.2.20',
    '1.19.4': '45.2.0',
    '1.19.2': '43.3.0',
    '1.18.2': '40.2.0',
    '1.16.5': '36.2.39',
    '1.12.2': '14.23.5.2859',
  };

  const forgeVersion = forgeVersionMap[version];
  if (!forgeVersion) {
    throw new Error(`Forge version for MC ${version} not found`);
  }

  return `${FORGE_MAVEN_BASE}/net/minecraftforge/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
}

// ============================================================================
// Unified Interface
// ============================================================================

/**
 * 取得指定核心類型的版本列表
 */
export async function getAvailableVersions(coreType: CoreType): Promise<string[]> {
  switch (coreType) {
    case 'vanilla':
      return getVanillaVersions();
    case 'paper':
      return getPaperVersions();
    case 'fabric':
      return getFabricVersions();
    case 'forge':
      return getForgeVersions();
    default:
      throw new Error(`Unknown core type: ${coreType}`);
  }
}

/**
 * 取得指定核心類型和版本的下載 URL
 */
export async function getServerDownloadUrl(
  coreType: CoreType,
  version: string
): Promise<string> {
  switch (coreType) {
    case 'vanilla':
      return getVanillaServerUrl(version);
    case 'paper':
      return getPaperServerUrl(version);
    case 'fabric':
      return getFabricServerUrl(version);
    case 'forge':
      return getForgeServerUrl(version);
    default:
      throw new Error(`Unknown core type: ${coreType}`);
  }
}
