// Java IPC Handlers
// 處理 Java 管理相關的 IPC 請求

import { ipcMain, BrowserWindow } from 'electron';
import { JavaChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  JavaInstallationDto,
  JavaInstallRequest,
} from '../../shared/ipc-types';
import {
  detectJavaInstallations,
  selectJavaForMinecraft,
  installJava,
  configManager,
} from '@lumix/core';

/**
 * 初始化 Java handlers
 */
export function initJavaHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  // 檢測系統 Java
  ipcMain.handle(JavaChannels.DETECT, async (): Promise<IpcResult<JavaInstallationDto[]>> => {
    try {
      const installations = await detectJavaInstallations();
      
      // 儲存到設定
      const settings = await configManager.loadSettings();
      settings.javaInstallations = installations;
      await configManager.saveSettings(settings);
      
      return { success: true, data: installations };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 取得已儲存的 Java 安裝
  ipcMain.handle(JavaChannels.GET_INSTALLATIONS, async (): Promise<IpcResult<JavaInstallationDto[]>> => {
    try {
      const settings = await configManager.loadSettings();
      return { success: true, data: settings.javaInstallations };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 安裝 Java
  ipcMain.handle(JavaChannels.INSTALL, async (_, data: JavaInstallRequest): Promise<IpcResult<JavaInstallationDto>> => {
    try {
      const installation = await installJava(data.majorVersion, (progress) => {
        // 發送進度事件
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((win) => {
          win.webContents.send(JavaChannels.INSTALL_PROGRESS, {
            majorVersion: data.majorVersion,
            progress,
          });
        });
      });

      // 更新設定
      const settings = await configManager.loadSettings();
      const existing = settings.javaInstallations.findIndex(
        (j) => j.majorVersion === installation.majorVersion
      );
      if (existing >= 0) {
        settings.javaInstallations[existing] = installation;
      } else {
        settings.javaInstallations.push(installation);
      }
      await configManager.saveSettings(settings);

      return { success: true, data: installation };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 為 Minecraft 版本選擇 Java
  ipcMain.handle(JavaChannels.SELECT_FOR_MC, async (_, mcVersion: string): Promise<IpcResult<JavaInstallationDto | null>> => {
    try {
      const settings = await configManager.loadSettings();
      const selected = selectJavaForMinecraft(mcVersion, settings.javaInstallations);
      return { success: true, data: selected };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
