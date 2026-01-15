// Java IPC Handlers - Mock 版本
// 回傳假資料，不執行實際後端邏輯

import { ipcMain } from 'electron';
import { JavaChannels } from '../../shared/ipc-channels';
import type {
  IpcResult,
  JavaInstallationDto,
  JavaInstallRequest,
} from '../../shared/ipc-types';

// Mock Java 安裝資料
const mockJavaInstallations: JavaInstallationDto[] = [
  {
    path: '/usr/lib/jvm/java-17-openjdk/bin/java',
    version: '17.0.9',
    majorVersion: 17,
    vendor: 'OpenJDK',
    isValid: true,
  },
  {
    path: '/usr/lib/jvm/java-21-openjdk/bin/java',
    version: '21.0.1',
    majorVersion: 21,
    vendor: 'OpenJDK',
    isValid: true,
  },
];

export function initJavaHandlers(): void {
  registerHandlers();
}

function registerHandlers(): void {
  ipcMain.handle(JavaChannels.DETECT, async (): Promise<IpcResult<JavaInstallationDto[]>> => {
    return { success: true, data: mockJavaInstallations };
  });

  ipcMain.handle(JavaChannels.GET_INSTALLATIONS, async (): Promise<IpcResult<JavaInstallationDto[]>> => {
    return { success: true, data: mockJavaInstallations };
  });

  ipcMain.handle(JavaChannels.INSTALL, async (_, data: JavaInstallRequest): Promise<IpcResult<JavaInstallationDto>> => {
    // Mock: 假裝安裝成功
    const newInstallation: JavaInstallationDto = {
      path: `/usr/lib/jvm/java-${data.majorVersion}-openjdk/bin/java`,
      version: `${data.majorVersion}.0.1`,
      majorVersion: data.majorVersion,
      vendor: 'OpenJDK',
      isValid: true,
    };
    return { success: true, data: newInstallation };
  });

  ipcMain.handle(JavaChannels.SELECT_FOR_MC, async (_, mcVersion: string): Promise<IpcResult<JavaInstallationDto | null>> => {
    // 簡單邏輯：1.20+ 用 Java 21，其他用 Java 17
    const majorMcVersion = parseFloat(mcVersion.split('.').slice(0, 2).join('.'));
    if (majorMcVersion >= 1.2) {
      const java21 = mockJavaInstallations.find((j) => j.majorVersion === 21);
      return { success: true, data: java21 || mockJavaInstallations[0] || null };
    }
    const java17 = mockJavaInstallations.find((j) => j.majorVersion === 17);
    return { success: true, data: java17 || mockJavaInstallations[0] || null };
  });
}
