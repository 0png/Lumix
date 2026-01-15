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
// Forge
// ============================================================================

const FORGE_MAVEN_BASE = 'https://maven.minecraftforge.net';
const FORGE_FILES_API = 'https://files.minecraftforge.net/net/minecraftforge/forge';

// Forge MC 版本與最新 Forge 版本對應表
// 這個表需要定期更新，或者可以從 Forge API 動態取得
const FORGE_VERSION_MAP: Record<string, string> = {
  // 1.21.x
  '1.21.4': '54.0.23',
  '1.21.3': '53.0.23',
  '1.21.1': '52.0.28',
  '1.21': '51.0.33',
  // 1.20.x
  '1.20.6': '50.1.32',
  '1.20.4': '49.1.13',
  '1.20.3': '49.0.30',
  '1.20.2': '48.1.0',
  '1.20.1': '47.3.12',
  '1.20': '46.0.14',
  // 1.19.x
  '1.19.4': '45.3.0',
  '1.19.3': '44.1.23',
  '1.19.2': '43.4.4',
  '1.19.1': '42.0.9',
  '1.19': '41.1.0',
  // 1.18.x
  '1.18.2': '40.2.21',
  '1.18.1': '39.1.2',
  '1.18': '38.0.17',
  // 1.17.x
  '1.17.1': '37.1.1',
  // 1.16.x
  '1.16.5': '36.2.42',
  '1.16.4': '35.1.37',
  '1.16.3': '34.1.42',
  '1.16.2': '33.0.61',
  '1.16.1': '32.0.108',
  // 1.15.x
  '1.15.2': '31.2.57',
  // 1.14.x
  '1.14.4': '28.2.26',
  // 1.12.x (經典版本)
  '1.12.2': '14.23.5.2860',
  '1.12.1': '14.22.1.2485',
  '1.12': '14.21.1.2443',
  // 1.7.x (經典版本)
  '1.7.10': '10.13.4.1614',
};

/**
 * 取得 Forge 版本列表
 */
export async function getForgeVersions(): Promise<string[]> {
  // 回傳所有支援的 MC 版本（按版本號降序排列）
  return Object.keys(FORGE_VERSION_MAP).sort((a, b) => {
    return compareMinecraftVersions(b, a);
  });
}

/**
 * 比較 Minecraft 版本號
 */
function compareMinecraftVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

/**
 * 取得 Forge 伺服器下載 URL
 * 注意：Forge 需要安裝器，這裡回傳安裝器 URL
 */
export async function getForgeServerUrl(version: string): Promise<string> {
  const forgeVersion = FORGE_VERSION_MAP[version];
  if (!forgeVersion) {
    throw new Error(`Forge version for MC ${version} not found. Available versions: ${Object.keys(FORGE_VERSION_MAP).join(', ')}`);
  }

  return `${FORGE_MAVEN_BASE}/net/minecraftforge/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
}

/**
 * 檢查 Forge 是否支援指定的 MC 版本
 */
export function isForgeVersionSupported(mcVersion: string): boolean {
  return mcVersion in FORGE_VERSION_MAP;
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
