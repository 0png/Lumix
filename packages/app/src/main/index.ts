import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';

// IPC handler for fetching MC versions (bypasses CSP)
ipcMain.handle('fetch-versions', async (_event, coreType: string) => {
  const MOJANG_API = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
  const PAPER_API = 'https://api.papermc.io/v2/projects/paper';
  const FABRIC_API = 'https://meta.fabricmc.net/v2/versions/game';
  const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';

  try {
    let result: string[] = [];

    if (coreType === 'paper') {
      const response = await fetch(PAPER_API);
      const data = await response.json();
      result = [...(data.versions as string[])].reverse();
    } else if (coreType === 'vanilla') {
      const response = await fetch(MOJANG_API);
      const data = await response.json();
      result = (data.versions as Array<{ id: string; type: string }>)
        .filter((v) => v.type === 'release')
        .map((v) => v.id);
    } else if (coreType === 'fabric') {
      const response = await fetch(FABRIC_API);
      const data = await response.json();
      result = (data as Array<{ version: string; stable: boolean }>)
        .filter((v) => v.stable)
        .map((v) => v.version);
    } else if (coreType === 'forge') {
      // Parse Forge Maven metadata XML
      const response = await fetch(FORGE_MAVEN);
      const xml = await response.text();
      // Extract versions from XML (format: mcVersion-forgeVersion)
      const versionMatches = xml.match(/<version>([^<]+)<\/version>/g) || [];
      const mcVersions = new Set<string>();
      for (const match of versionMatches) {
        const version = match.replace(/<\/?version>/g, '');
        const mcVersion = version.split('-')[0];
        if (mcVersion && /^\d+\.\d+/.test(mcVersion)) {
          mcVersions.add(mcVersion);
        }
      }
      // Sort versions descending
      result = [...mcVersions].sort((a, b) => {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const numA = partsA[i] ?? 0;
          const numB = partsB[i] ?? 0;
          if (numA !== numB) return numB - numA;
        }
        return 0;
      });
    }

    return { success: true, versions: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false, // Allow cross-origin requests for API calls
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lumix.launcher');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
