/**
 * ServerManager Service
 * 負責伺服器實例的 CRUD 操作與生命週期管理
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { promises as fs } from 'fs';
import { FileManager, ServerMetadata } from './file-manager';
import { ProcessManager, ProcessConfig } from './process-manager';
import { parseLogLevel, splitLogLines } from './log-parser';
import type {
  ServerInstanceDto,
  ServerStatus,
  CreateServerRequest,
  UpdateServerRequest,
  ServerStatusEvent,
  ServerLogEvent,
  LogLevel,
} from '../../shared/ipc-types';

// ============================================================================
// Types
// ============================================================================

export interface ServerManagerEvents {
  'status-changed': (event: ServerStatusEvent) => void;
  'log-entry': (event: ServerLogEvent) => void;
}

export interface ServerManagerConfig {
  fileManager: FileManager;
  processManager: ProcessManager;
  defaultJavaPath?: string;
}

// ============================================================================
// ServerManager Class
// ============================================================================

export class ServerManager extends EventEmitter {
  private fileManager: FileManager;
  private processManager: ProcessManager;
  private servers: Map<string, ServerInstanceDto> = new Map();
  private defaultJavaPath: string;

  constructor(config: ServerManagerConfig) {
    super();
    this.fileManager = config.fileManager;
    this.processManager = config.processManager;
    this.defaultJavaPath = config.defaultJavaPath || 'java';
    this.setupProcessManagerListeners();
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  async getAllServers(): Promise<ServerInstanceDto[]> {
    return Array.from(this.servers.values());
  }

  async getServerById(id: string): Promise<ServerInstanceDto | null> {
    return this.servers.get(id) ?? null;
  }

  async createServer(request: CreateServerRequest): Promise<ServerInstanceDto> {
    const trimmedName = request.name.trim();
    if (!trimmedName) {
      throw new Error('INVALID_NAME: 伺服器名稱不能為空');
    }

    if (this.findServerByName(trimmedName)) {
      throw new Error('DUPLICATE_NAME: 伺服器名稱已存在');
    }

    if (await this.fileManager.serverExists(trimmedName)) {
      throw new Error('DUPLICATE_NAME: 伺服器目錄已存在');
    }

    const id = uuidv4();
    const serverPath = await this.fileManager.createServerDirectory(trimmedName);

    try {
      const metadata = this.buildMetadata(id, trimmedName, request);
      await this.writeServerFiles(serverPath, metadata);

      const server: ServerInstanceDto = {
        ...metadata,
        javaPath: metadata.javaPath || this.defaultJavaPath,
        directory: serverPath,
        status: 'stopped',
      };

      this.servers.set(id, server);
      return server;
    } catch (error) {
      await this.fileManager.deleteServerDirectory(serverPath).catch(() => {});
      throw error;
    }
  }

  async updateServer(request: UpdateServerRequest): Promise<ServerInstanceDto> {
    const server = this.servers.get(request.id);
    if (!server) {
      throw new Error('NOT_FOUND: 找不到指定的伺服器');
    }

    if (request.name !== undefined) {
      const trimmedName = request.name.trim();
      if (!trimmedName) {
        throw new Error('INVALID_NAME: 伺服器名稱不能為空');
      }
      if (this.findServerByName(trimmedName, request.id)) {
        throw new Error('DUPLICATE_NAME: 伺服器名稱已存在');
      }
    }

    const updatedServer: ServerInstanceDto = {
      ...server,
      name: request.name?.trim() ?? server.name,
      javaPath: request.javaPath ?? server.javaPath,
      ramMin: request.ramMin ?? server.ramMin,
      ramMax: request.ramMax ?? server.ramMax,
      jvmArgs: request.jvmArgs ?? server.jvmArgs,
    };

    await this.persistServerUpdate(updatedServer);
    this.servers.set(request.id, updatedServer);
    return updatedServer;
  }

  async deleteServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error('NOT_FOUND: 找不到指定的伺服器');
    }

    if (server.status !== 'stopped') {
      await this.stopServer(id);
    }

    await this.fileManager.deleteServerDirectory(server.directory);
    this.servers.delete(id);
  }

  // ==========================================================================
  // Lifecycle Operations
  // ==========================================================================

  async startServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error('NOT_FOUND: 找不到指定的伺服器');
    }

    if (server.status === 'running' || server.status === 'starting') {
      throw new Error('INVALID_STATE: 伺服器已在執行中');
    }

    const javaPath = server.javaPath || this.defaultJavaPath;
    if (!(await this.validateJava(javaPath))) {
      throw new Error('JAVA_NOT_FOUND: 找不到有效的 Java 安裝');
    }

    const jarPath = path.join(server.directory, 'server.jar');
    try {
      await fs.access(jarPath);
    } catch {
      throw new Error('JAR_NOT_FOUND: 找不到 server.jar 檔案');
    }

    this.updateServerStatus(id, 'starting');

    try {
      const processConfig: ProcessConfig = {
        serverId: id,
        javaPath,
        jarPath,
        workingDir: server.directory,
        ramMin: server.ramMin,
        ramMax: server.ramMax,
        jvmArgs: server.jvmArgs,
      };

      this.processManager.spawn(processConfig);
      await this.updateLastStartedAt(id);
      this.updateServerStatus(id, 'running');
    } catch (error) {
      this.updateServerStatus(id, 'stopped');
      throw error;
    }
  }

  async stopServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error('NOT_FOUND: 找不到指定的伺服器');
    }

    if (server.status === 'stopped') {
      throw new Error('INVALID_STATE: 伺服器已停止');
    }

    this.updateServerStatus(id, 'stopping');

    const sent = this.processManager.writeStdin(id, 'stop');
    if (!sent) {
      this.processManager.kill(id);
    }

    setTimeout(() => {
      if (this.processManager.isRunning(id)) {
        this.processManager.forceKill(id);
      }
    }, 30000);
  }

  async sendCommand(id: string, command: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error('NOT_FOUND: 找不到指定的伺服器');
    }

    if (server.status !== 'running') {
      throw new Error('INVALID_STATE: 只能對執行中的伺服器發送指令');
    }

    const sent = this.processManager.writeStdin(id, command);
    if (!sent) {
      throw new Error('COMMAND_FAILED: 無法發送指令');
    }

    this.emitLogEntry(id, 'info', `> ${command}`);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async loadServers(): Promise<void> {
    const metadataList = await this.fileManager.discoverServers();

    for (const metadata of metadataList) {
      const serverPath = this.fileManager.getServerPath(metadata.name);
      const server: ServerInstanceDto = {
        id: metadata.id,
        name: metadata.name,
        coreType: metadata.coreType,
        mcVersion: metadata.mcVersion,
        javaPath: metadata.javaPath || this.defaultJavaPath,
        ramMin: metadata.ramMin,
        ramMax: metadata.ramMax,
        jvmArgs: metadata.jvmArgs,
        directory: serverPath,
        status: 'stopped',
        createdAt: metadata.createdAt,
        lastStartedAt: metadata.lastStartedAt,
      };
      this.servers.set(metadata.id, server);
    }
  }

  async cleanup(): Promise<void> {
    this.processManager.killAll();
  }


  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupProcessManagerListeners(): void {
    this.processManager.on('stdout', (serverId: string, data: string) => {
      this.handleProcessOutput(serverId, data, 'info');
    });

    this.processManager.on('stderr', (serverId: string, data: string) => {
      this.handleProcessOutput(serverId, data, 'error');
    });

    this.processManager.on('exit', (serverId: string, code: number | null) => {
      this.handleProcessExit(serverId, code);
    });

    this.processManager.on('error', (serverId: string, error: Error) => {
      this.emitLogEntry(serverId, 'error', `程序錯誤: ${error.message}`);
      this.updateServerStatus(serverId, 'stopped');
    });
  }

  private handleProcessOutput(serverId: string, data: string, defaultLevel: LogLevel): void {
    const lines = splitLogLines(data);
    for (const line of lines) {
      const level = parseLogLevel(line) || defaultLevel;
      this.emitLogEntry(serverId, level, line);
    }
  }

  private handleProcessExit(serverId: string, code: number | null): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    const event: ServerStatusEvent = {
      serverId,
      status: 'stopped',
      exitCode: code ?? undefined,
    };

    server.status = 'stopped';
    this.servers.set(serverId, server);
    this.emit('status-changed', event);
    this.emitLogEntry(serverId, 'info', `伺服器已停止 (exit code: ${code ?? 'unknown'})`);
  }

  private updateServerStatus(id: string, status: ServerStatus): void {
    const server = this.servers.get(id);
    if (!server) return;

    server.status = status;
    this.servers.set(id, server);
    this.emit('status-changed', { serverId: id, status });
  }

  private emitLogEntry(serverId: string, level: LogLevel, message: string): void {
    this.emit('log-entry', {
      serverId,
      entry: { timestamp: new Date().toISOString(), level, message },
    });
  }

  private async validateJava(javaPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const proc = spawn(javaPath, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.on('error', () => {
        resolve(false);
      });

      proc.on('close', (code: number | null) => {
        resolve(code === 0);
      });

      // 設定超時，避免卡住
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  private findServerByName(name: string, excludeId?: string): ServerInstanceDto | undefined {
    return Array.from(this.servers.values()).find(
      (s) => s.name === name && s.id !== excludeId
    );
  }

  private buildMetadata(id: string, name: string, request: CreateServerRequest): ServerMetadata {
    return {
      id,
      name,
      coreType: request.coreType,
      mcVersion: request.mcVersion,
      ramMin: request.ramMin ?? 1024,
      ramMax: request.ramMax ?? 2048,
      jvmArgs: request.jvmArgs ?? [],
      javaPath: request.javaPath,
      createdAt: new Date().toISOString(),
    };
  }

  private async writeServerFiles(serverPath: string, metadata: ServerMetadata): Promise<void> {
    await this.fileManager.writeEula(serverPath);
    await this.fileManager.writeRunBat(serverPath, {
      javaPath: metadata.javaPath || this.defaultJavaPath,
      ramMin: metadata.ramMin,
      ramMax: metadata.ramMax,
      jvmArgs: metadata.jvmArgs,
    });
    await this.fileManager.writeServerJson(serverPath, metadata);
  }

  private async persistServerUpdate(server: ServerInstanceDto): Promise<void> {
    const metadata: ServerMetadata = {
      id: server.id,
      name: server.name,
      coreType: server.coreType,
      mcVersion: server.mcVersion,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
      javaPath: server.javaPath,
      createdAt: server.createdAt,
      lastStartedAt: server.lastStartedAt,
    };
    await this.fileManager.writeServerJson(server.directory, metadata);
    await this.fileManager.writeRunBat(server.directory, {
      javaPath: server.javaPath,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
    });
  }

  private async updateLastStartedAt(id: string): Promise<void> {
    const server = this.servers.get(id)!;
    server.lastStartedAt = new Date().toISOString();
    this.servers.set(id, server);

    const metadata: ServerMetadata = {
      id: server.id,
      name: server.name,
      coreType: server.coreType,
      mcVersion: server.mcVersion,
      ramMin: server.ramMin,
      ramMax: server.ramMax,
      jvmArgs: server.jvmArgs,
      javaPath: server.javaPath,
      createdAt: server.createdAt,
      lastStartedAt: server.lastStartedAt,
    };
    await this.fileManager.writeServerJson(server.directory, metadata);
  }
}
