/**
 * FileManager Service
 * 處理伺服器相關的檔案系統操作
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CoreType } from '../../shared/ipc-types';

// ============================================================================
// Types
// ============================================================================

export interface ServerMetadata {
  id: string;
  name: string;
  coreType: CoreType;
  mcVersion: string;
  ramMin: number;
  ramMax: number;
  jvmArgs: string[];
  javaPath?: string;
  createdAt: string;
  lastStartedAt?: string;
}

export interface RunBatConfig {
  javaPath: string;
  ramMin: number;
  ramMax: number;
  jvmArgs: string[];
}

// ============================================================================
// FileManager Class
// ============================================================================

export class FileManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * 取得 servers 目錄路徑
   */
  getServersPath(): string {
    return path.join(this.basePath, 'servers');
  }

  /**
   * 取得特定伺服器的目錄路徑
   */
  getServerPath(serverName: string): string {
    return path.join(this.getServersPath(), serverName);
  }

  /**
   * 建立伺服器目錄
   */
  async createServerDirectory(serverName: string): Promise<string> {
    const serverPath = this.getServerPath(serverName);
    await fs.mkdir(serverPath, { recursive: true });
    return serverPath;
  }

  /**
   * 刪除伺服器目錄
   */
  async deleteServerDirectory(serverPath: string): Promise<void> {
    await fs.rm(serverPath, { recursive: true, force: true });
  }

  /**
   * 寫入 EULA 檔案
   */
  async writeEula(serverPath: string): Promise<void> {
    const eulaPath = path.join(serverPath, 'eula.txt');
    const content = 'eula=true\n';
    await fs.writeFile(eulaPath, content, 'utf-8');
  }

  /**
   * 寫入 run.bat 啟動腳本
   */
  async writeRunBat(serverPath: string, config: RunBatConfig): Promise<void> {
    const batPath = path.join(serverPath, 'run.bat');
    const jvmArgsStr = config.jvmArgs.length > 0 ? config.jvmArgs.join(' ') + ' ' : '';
    const content = `@echo off
"${config.javaPath}" -Xms${config.ramMin}M -Xmx${config.ramMax}M ${jvmArgsStr}-jar server.jar nogui
pause
`;
    await fs.writeFile(batPath, content, 'utf-8');
  }

  /**
   * 寫入 server.json 元資料檔案
   */
  async writeServerJson(serverPath: string, metadata: ServerMetadata): Promise<void> {
    const jsonPath = path.join(serverPath, 'server.json');
    const content = JSON.stringify(metadata, null, 2);
    await fs.writeFile(jsonPath, content, 'utf-8');
  }

  /**
   * 讀取 server.json 元資料檔案
   */
  async readServerJson(serverPath: string): Promise<ServerMetadata> {
    const jsonPath = path.join(serverPath, 'server.json');
    const content = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(content) as ServerMetadata;
  }

  /**
   * 檢查伺服器目錄是否存在
   */
  async serverExists(serverName: string): Promise<boolean> {
    const serverPath = this.getServerPath(serverName);
    try {
      await fs.access(serverPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 探索並載入所有現有伺服器
   */
  async discoverServers(): Promise<ServerMetadata[]> {
    const serversPath = this.getServersPath();
    const servers: ServerMetadata[] = [];

    try {
      await fs.access(serversPath);
    } catch {
      // servers 目錄不存在，回傳空陣列
      return servers;
    }

    const entries = await fs.readdir(serversPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const serverPath = path.join(serversPath, entry.name);
      try {
        const metadata = await this.readServerJson(serverPath);
        servers.push(metadata);
      } catch {
        // 無法讀取 server.json，跳過此目錄
        console.warn(`無法讀取伺服器元資料: ${serverPath}`);
      }
    }

    return servers;
  }
}
