/**
 * Java IPC Handlers
 * 處理 Java 偵測與管理的 IPC 請求
 */

import { ipcMain } from 'electron';
import { JavaChannels } from '../../shared/ipc-channels';
import { JavaDetector } from '../services/java-detector';
import type {
  IpcResult,
  JavaInstallationDto,
  JavaInstallRequest,
} from '../../shared/ipc-types';

// ============================================================================
// Module State
// ============================================================================

let javaDetector: JavaDetector | null = null;
let cachedInstallations: JavaInstallationDto[] | null = null;

// ============================================================================
// Initialization
// ============================================================================

export function initJavaHandlers(): void {
  javaDetector = new JavaDetector();
  registerHandlers();
}

// ============================================================================
// Handler Registration
// ============================================================================

function registerHandlers(): void {
  // DETECT - 偵測系統上的 Java 安裝
  ipcMain.handle(
    JavaChannels.DETECT,
    async (): Promise<IpcResult<JavaInstallationDto[]>> => {
      try {
        console.log('[JavaHandlers] Detecting Java installations...');
        const installations = await javaDetector!.detectAll();
        cachedInstallations = installations;
        console.log('[JavaHandlers] Found installations:', installations);
        return { success: true, data: installations };
      } catch (error) {
        console.error('[JavaHandlers] Detection failed:', error);
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_INSTALLATIONS - 取得已偵測的 Java 安裝（使用快取）
  ipcMain.handle(
    JavaChannels.GET_INSTALLATIONS,
    async (): Promise<IpcResult<JavaInstallationDto[]>> => {
      try {
        if (!cachedInstallations) {
          cachedInstallations = await javaDetector!.detectAll();
        }
        return { success: true, data: cachedInstallations };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // INSTALL - 安裝 Java（目前不支援，回傳錯誤）
  ipcMain.handle(
    JavaChannels.INSTALL,
    async (_: unknown, _data: JavaInstallRequest): Promise<IpcResult<JavaInstallationDto>> => {
      return {
        success: false,
        error: 'NOT_IMPLEMENTED: 自動安裝 Java 功能尚未實作，請手動安裝 Java',
      };
    }
  );

  // SELECT_FOR_MC - 根據 Minecraft 版本選擇適合的 Java
  ipcMain.handle(
    JavaChannels.SELECT_FOR_MC,
    async (_, mcVersion: string): Promise<IpcResult<JavaInstallationDto | null>> => {
      try {
        console.log('[JavaHandlers] Selecting Java for MC version:', mcVersion);
        if (!cachedInstallations) {
          cachedInstallations = await javaDetector!.detectAll();
        }
        const selected = javaDetector!.selectForMinecraft(cachedInstallations, mcVersion);
        console.log('[JavaHandlers] Selected Java:', selected);
        return { success: true, data: selected };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
