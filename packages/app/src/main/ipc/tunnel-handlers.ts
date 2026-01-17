/**
 * Tunnel IPC Handlers
 * 連接 PlayitTunnelManager 到 IPC 通道，處理前端請求與事件轉發
 */

import { ipcMain, BrowserWindow } from 'electron';
import { TunnelChannels, getAllTunnelChannels } from '../../shared/ipc-channels';
import { PlayitTunnelManager } from '../services/playit-tunnel-manager';
import type {
  IpcResult,
  TunnelInfo,
  TunnelStatus,
  CreateTunnelRequest,
  TunnelStatusEvent,
  TunnelInfoEvent,
} from '../../shared/ipc-types';

// ============================================================================
// Module State
// ============================================================================

let tunnelManager: PlayitTunnelManager | null = null;

// ============================================================================
// Initialization
// ============================================================================

export function initTunnelHandlers(): void {
  tunnelManager = new PlayitTunnelManager();
  registerHandlers();
  setupEventForwarding();
}

// ============================================================================
// Handler Registration
// ============================================================================

function registerHandlers(): void {
  // CREATE - 創建隧道
  ipcMain.handle(
    TunnelChannels.CREATE,
    async (_, data: CreateTunnelRequest): Promise<IpcResult<TunnelInfo>> => {
      try {
        const tunnel = await tunnelManager!.createTunnel(data.serverId, data.localPort);
        if (data.autoStart) {
          await tunnelManager!.startTunnel(data.serverId);
        }
        return { success: true, data: tunnel };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // START - 啟動隧道
  ipcMain.handle(
    TunnelChannels.START,
    async (_, serverId: string): Promise<IpcResult<void>> => {
      try {
        await tunnelManager!.startTunnel(serverId);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // STOP - 停止隧道
  ipcMain.handle(
    TunnelChannels.STOP,
    async (_, serverId: string): Promise<IpcResult<void>> => {
      try {
        await tunnelManager!.stopTunnel(serverId);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // DELETE - 刪除隧道
  ipcMain.handle(
    TunnelChannels.DELETE,
    async (_, serverId: string): Promise<IpcResult<void>> => {
      try {
        await tunnelManager!.deleteTunnel(serverId);
        return { success: true };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_INFO - 獲取隧道信息
  ipcMain.handle(
    TunnelChannels.GET_INFO,
    async (_, serverId: string): Promise<IpcResult<TunnelInfo | null>> => {
      try {
        const info = tunnelManager!.getTunnelInfo(serverId);
        return { success: true, data: info };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // GET_STATUS - 獲取隧道狀態
  ipcMain.handle(
    TunnelChannels.GET_STATUS,
    async (_, serverId: string): Promise<IpcResult<TunnelStatus>> => {
      try {
        const status = tunnelManager!.getTunnelStatus(serverId);
        return { success: true, data: status };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );

  // CHECK_AGENT - 檢查 Agent 是否存在
  ipcMain.handle(
    TunnelChannels.CHECK_AGENT,
    async (): Promise<IpcResult<boolean>> => {
      try {
        await tunnelManager!.ensureAgentInstalled();
        return { success: true, data: true };
      } catch (error) {
        return { success: false, error: formatError(error), data: false };
      }
    }
  );

  // INSTALL_AGENT - 安裝 Agent（後台自動下載）
  ipcMain.handle(
    TunnelChannels.INSTALL_AGENT,
    async (): Promise<IpcResult<string>> => {
      try {
        const agentPath = await tunnelManager!.ensureAgentInstalled();
        return { success: true, data: agentPath };
      } catch (error) {
        return { success: false, error: formatError(error) };
      }
    }
  );
}

// ============================================================================
// Event Forwarding
// ============================================================================

function setupEventForwarding(): void {
  if (!tunnelManager) return;

  // 轉發狀態變更事件到所有視窗
  tunnelManager.on('status-changed', (serverId: string, status: TunnelStatus) => {
    const event: TunnelStatusEvent = { serverId, status };
    broadcastToAllWindows(TunnelChannels.STATUS_CHANGED, event);
  });

  // 轉發信息更新事件到所有視窗
  tunnelManager.on('info-updated', (serverId: string, info: TunnelInfo) => {
    const event: TunnelInfoEvent = { serverId, info };
    broadcastToAllWindows(TunnelChannels.INFO_UPDATED, event);
  });

  // 轉發 claim 需求事件到所有視窗
  tunnelManager.on('claim-required', (serverId: string, claimUrl: string, claimCode: string) => {
    const event: import('../../shared/ipc-types').TunnelClaimRequiredEvent = { 
      serverId, 
      claimUrl, 
      claimCode 
    };
    broadcastToAllWindows(TunnelChannels.CLAIM_REQUIRED, event);
  });
}

function broadcastToAllWindows(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupTunnelHandlers(): void {
  // 移除所有 IPC handlers（避免 hot reload 重複註冊）
  for (const channel of getAllTunnelChannels()) {
    ipcMain.removeHandler(channel);
  }

  if (tunnelManager) {
    tunnelManager.cleanup();
    tunnelManager = null;
  }
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
