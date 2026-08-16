import { BrowserWindow, ipcMain } from 'electron';
import { ModpackChannels } from '../../shared/ipc-channels';
import type {
  ImportModpackRequest,
  ImportModpackResult,
  IpcResult,
  ModpackCandidateDto,
  ModpackInstallProgressEvent,
  ScanModpackRequest,
} from '../../shared/ipc-types';
import { DownloadService } from '../services/download-service';
import { JavaDetector } from '../services/java-detector';
import { ModpackService } from '../services/modpack-service';
import { ServerManager } from '../services/server-manager';

let serverManager: ServerManager | null = null;
let downloadService: DownloadService | null = null;
let modpackService: ModpackService | null = null;

export function initModpackHandlers(manager: ServerManager, downloader: DownloadService): void {
  serverManager = manager;
  downloadService = downloader;
  modpackService = new ModpackService();

  ipcMain.handle(
    ModpackChannels.SCAN,
    async (_, data: ScanModpackRequest): Promise<IpcResult<ModpackCandidateDto>> => {
      try {
        const candidate = await modpackService!.scan(data.archivePath);
        return { success: true, data: candidate };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  ipcMain.handle(
    ModpackChannels.IMPORT,
    async (_, data: ImportModpackRequest): Promise<IpcResult<ImportModpackResult>> => {
      let serverId: string | undefined;
      try {
        if (!data.eulaAccepted) {
          return { success: false, error: 'VALIDATION_ERROR: 必須先接受 Minecraft EULA' };
        }
        const candidate = await modpackService!.scan(data.archivePath);
        if (!candidate.coreType) {
          return { success: false, error: 'MODPACK_UNSUPPORTED_LOADER: 此模組包的 Loader 尚未受到支援' };
        }

        emitProgress({ stage: 'preparing', completed: 0, total: 1, percentage: 0, message: '正在準備伺服器' });
        const javaPath = data.javaPath ?? await selectJava(candidate.mcVersion);
        if (!javaPath) {
          return { success: false, error: `JAVA_NOT_FOUND: 找不到適用於 Minecraft ${candidate.mcVersion} 的 Java` };
        }
        const server = await serverManager!.createServer({
          name: data.name,
          coreType: candidate.coreType,
          mcVersion: candidate.mcVersion,
          ramMin: data.ramMin,
          ramMax: data.ramMax,
          javaPath,
        });
        serverId = server.id;

        emitProgress({ stage: 'server', completed: 0, total: 1, percentage: 0, message: '正在安裝伺服器 Loader' });
        await downloadService!.downloadServer(
          candidate.coreType,
          candidate.mcVersion,
          server.directory,
          server.id,
          { loaderVersion: candidate.loaderVersion, javaPath }
        );

        const installed = await modpackService!.install(data.archivePath, server.directory, {
          allowIncomplete: data.allowIncomplete,
          onProgress: emitProgress,
        });

        emitProgress({ stage: 'finalizing', completed: 1, total: 1, percentage: 100, message: '模組包伺服器已建立完成' });
        const refreshed = await serverManager!.getServerById(server.id);
        if (!refreshed) throw new Error('SERVER_NOT_FOUND: 建立後找不到伺服器');

        return {
          success: true,
          data: {
            server: { ...refreshed, isReady: true },
            warnings: installed.warnings,
            installedFiles: installed.installedFiles,
            skippedClientOnlyFiles: installed.skippedClientOnlyFiles,
            unresolvedFiles: installed.unresolvedFiles,
          },
        };
      } catch (error) {
        if (serverId) {
          await serverManager!.deleteServer(serverId).catch((cleanupError) => {
            console.error('[ModpackHandlers] Failed to clean up incomplete server:', cleanupError);
          });
        }
        return { success: false, error: formatError(error) };
      }
    }
  );
}

export function cleanupModpackHandlers(): void {
  ipcMain.removeHandler(ModpackChannels.SCAN);
  ipcMain.removeHandler(ModpackChannels.IMPORT);
  serverManager = null;
  downloadService = null;
  modpackService = null;
}

async function selectJava(mcVersion: string): Promise<string | undefined> {
  const detector = new JavaDetector();
  const installations = await detector.detectAll();
  return (await detector.selectForMinecraft(installations, mcVersion))?.path;
}

function emitProgress(event: ModpackInstallProgressEvent): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) window.webContents.send(ModpackChannels.INSTALL_PROGRESS, event);
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
