/**
 * PlayitTunnelManager Service
 * 管理 Playit 隧道服務，包括 Agent 下載、隧道創建、啟動和停止
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { downloadFile, fetchJson } from './http-client';
import { IpcErrorCode, formatIpcError, createIpcError } from '../../shared/ipc-types';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface TunnelInfo {
  serverId: string;
  tunnelId?: string;
  localPort: number;
  publicAddress?: string;
  publicPort?: number;
  status: TunnelStatus;
  createdAt?: string;
}

export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface TunnelManagerEvents {
  'status-changed': (serverId: string, status: TunnelStatus) => void;
  'info-updated': (serverId: string, info: TunnelInfo) => void;
  'claim-required': (serverId: string, claimUrl: string, claimCode: string) => void;
}

interface PlayitAgentInfo {
  version: string;
  downloadUrl: string;
}

// ============================================================================
// PlayitTunnelManager Class
// ============================================================================

export class PlayitTunnelManager extends EventEmitter {
  private tunnels: Map<string, TunnelInfo> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private agentPath: string | null = null;
  private downloadInProgress: boolean = false;

  constructor() {
    super();
    // 啟動時載入已保存的隧道資訊
    this.loadTunnelInfo();
  }

  /**
   * 獲取隧道資訊檔案路徑
   */
  private getTunnelInfoPath(serverId: string): string {
    const agentDir = this.getAgentDirectory();
    return path.join(agentDir, 'configs', serverId, 'tunnel-info.json');
  }

  /**
   * 載入已保存的隧道資訊
   */
  private async loadTunnelInfo(): Promise<void> {
    try {
      const agentDir = this.getAgentDirectory();
      const configsDir = path.join(agentDir, 'configs');
      
      // 檢查 configs 目錄是否存在
      try {
        await fs.access(configsDir);
      } catch {
        return; // 目錄不存在，跳過載入
      }

      // 讀取所有伺服器的配置目錄
      const serverDirs = await fs.readdir(configsDir);
      
      for (const serverId of serverDirs) {
        const infoPath = this.getTunnelInfoPath(serverId);
        try {
          const data = await fs.readFile(infoPath, 'utf-8');
          const tunnelInfo: TunnelInfo = JSON.parse(data);
          // 設置狀態為 stopped（因為重啟後進程不存在）
          tunnelInfo.status = 'stopped';
          this.tunnels.set(serverId, tunnelInfo);
        } catch {
          // 檔案不存在或解析失敗，跳過
        }
      }
    } catch (error) {
      console.error('Failed to load tunnel info:', error);
    }
  }

  /**
   * 保存隧道資訊到檔案
   */
  private async saveTunnelInfo(serverId: string): Promise<void> {
    const tunnel = this.tunnels.get(serverId);
    if (!tunnel) return;

    try {
      const infoPath = this.getTunnelInfoPath(serverId);
      const dir = path.dirname(infoPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(infoPath, JSON.stringify(tunnel, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[Tunnel ${serverId}] Failed to save tunnel info:`, error);
    }
  }

  /**
   * 獲取 Agent 路徑
   */
  private getAgentDirectory(): string {
    const userData = app.getPath('userData');
    return path.join(userData, 'playit');
  }

  /**
   * 獲取 Agent 可執行文件路徑
   * Playit agent 可能有多個名稱：playit-windows-x86_64-signed.exe, playit-cli.exe, playit-agent.exe
   */
  private getAgentPath(): string {
    const agentDir = this.getAgentDirectory();
    // 嘗試多個可能的名稱（按優先順序）
    const possibleNames = [
      'playit-windows-x86_64-signed.exe',
      'playit-windows-x86_64.exe',
      'playit-cli.exe',
      'playit-agent.exe',
      'playit.exe'
    ];
    // 返回第一個作為默認，實際使用時會檢查是否存在
    return path.join(agentDir, possibleNames[0]!);
  }

  /**
   * 查找實際的 agent 可執行文件
   */
  private async findAgentExecutable(): Promise<string | null> {
    const agentDir = this.getAgentDirectory();
    
    try {
      // 先嘗試列出目錄中的所有文件，查找任何 playit 相關的 .exe 文件
      const files = await fs.readdir(agentDir);
      const exeFiles = files.filter(f => 
        f.toLowerCase().endsWith('.exe') && 
        (f.toLowerCase().includes('playit') || f.toLowerCase().includes('playit'))
      );
      
      if (exeFiles.length > 0) {
        // 按優先順序排序
        const priority = [
          'playit-windows-x86_64-signed.exe',
          'playit-windows-x86_64.exe',
          'playit-cli.exe',
          'playit-agent.exe',
          'playit.exe'
        ];
        
        for (const priorityName of priority) {
          const found = exeFiles.find(f => f.toLowerCase() === priorityName.toLowerCase());
          if (found) {
            const agentPath = path.join(agentDir, found);
            if (await this.checkAgentExists(agentPath)) {
              return agentPath;
            }
          }
        }
        
        // 如果沒有匹配優先名稱，返回第一個找到的
        const agentPath = path.join(agentDir, exeFiles[0]!);
        if (await this.checkAgentExists(agentPath)) {
          return agentPath;
        }
      }
    } catch {
      // 目錄不存在或讀取失敗，繼續嘗試固定名稱
    }
    
    // 如果目錄掃描失敗，嘗試固定名稱列表
    const possibleNames = [
      'playit-windows-x86_64-signed.exe',
      'playit-windows-x86_64.exe',
      'playit-cli.exe',
      'playit-agent.exe',
      'playit.exe'
    ];
    
    for (const name of possibleNames) {
      const agentPath = path.join(agentDir, name);
      if (await this.checkAgentExists(agentPath)) {
        return agentPath;
      }
    }
    
    // 如果都不存在，返回 null
    return null;
  }

  /**
   * 檢查 Agent 是否存在
   */
  private async checkAgentExists(agentPath: string): Promise<boolean> {
    try {
      await fs.access(agentPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 從 GitHub Releases 獲取最新版本信息
   */
  private async getLatestAgentVersion(): Promise<PlayitAgentInfo> {
    try {
      // Playit agent 的 GitHub releases API
      const releasesUrl = 'https://api.github.com/repos/playit-cloud/playit-agent/releases/latest';
      const release = await fetchJson<{
        tag_name: string;
        assets: Array<{ name: string; browser_download_url: string }>;
      }>(releasesUrl);

      // 查找 Windows x64 版本
      // 優先順序：
      // 1. playit-windows-x86_64-signed.exe (簽名版本)
      // 2. playit-windows-x86_64.exe
      // 3. playit-cli-windows-x64.exe
      // 4. 任何包含 windows 和 x64/x86_64 的文件
      const windowsAsset = 
        release.assets.find(
          (asset) => 
            asset.name.includes('playit') &&
            asset.name.includes('windows') && 
            (asset.name.includes('x86_64') || asset.name.includes('x64')) &&
            asset.name.endsWith('.exe')
        ) || release.assets.find(
          (asset) => 
            asset.name.includes('windows') && 
            (asset.name.includes('x86_64') || asset.name.includes('x64')) &&
            asset.name.endsWith('.exe')
        );

      if (!windowsAsset) {
        throw new Error('找不到 Windows x64 版本的 playit-agent');
      }

      return {
        version: release.tag_name,
        downloadUrl: windowsAsset.browser_download_url,
      };
    } catch (error) {
      // 如果 GitHub API 失敗，拋出錯誤而不是使用可能錯誤的備用鏈接
      console.error('無法從 GitHub 獲取版本信息:', error);
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.TUNNEL_AGENT_NOT_FOUND,
        `無法從 GitHub 獲取 playit-agent 版本信息: ${error instanceof Error ? error.message : String(error)}`
      )));
    }
  }

  /**
   * 下載 Playit Agent（後台靜默下載）
   */
  private async downloadAgent(agentPath: string): Promise<string> {
    if (this.downloadInProgress) {
      // 如果正在下載，等待完成
      while (this.downloadInProgress) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      // 下載完成後，查找實際下載的文件
      const foundPath = await this.findAgentExecutable();
      if (foundPath) {
        return foundPath;
      }
      throw new Error('Agent 下載失敗');
    }

    this.downloadInProgress = true;

    try {
      // 確保目錄存在
      const agentDir = path.dirname(agentPath);
      await fs.mkdir(agentDir, { recursive: true });

      // 獲取最新版本信息
      const agentInfo = await this.getLatestAgentVersion();

      // 從下載 URL 提取文件名，或使用默認名稱
      const urlObj = new URL(agentInfo.downloadUrl);
      const urlFileName = path.basename(urlObj.pathname);
      // 使用下載 URL 中的文件名，如果沒有則使用默認路徑
      const downloadPath = urlFileName && urlFileName.endsWith('.exe')
        ? path.join(agentDir, urlFileName)
        : agentPath;

      // 下載 Agent（最多重試 3 次）
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`正在下載 playit-agent (嘗試 ${attempt}/3)...`);
          await downloadFile(agentInfo.downloadUrl, downloadPath, 0);
          console.log('playit-agent 下載完成');
          
          // 驗證文件是否存在
          if (await this.checkAgentExists(downloadPath)) {
            this.downloadInProgress = false;
            // 返回實際下載的文件路徑
            return downloadPath;
          } else {
            throw new Error('下載的文件不存在');
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`下載失敗 (嘗試 ${attempt}/3):`, lastError.message);
          // 清理失敗的下載文件
          try {
            await fs.unlink(downloadPath);
          } catch {
            // 忽略清理錯誤
          }
          if (attempt < 3) {
            // 等待後重試
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          }
        }
      }

      // 所有重試都失敗
      this.downloadInProgress = false;
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.TUNNEL_AGENT_NOT_FOUND,
        `無法下載 playit-agent: ${lastError?.message || '未知錯誤'}`
      )));
    } catch (error) {
      this.downloadInProgress = false;
      throw error;
    }
  }

  /**
   * 確保 Agent 已安裝（首次使用時自動下載）
   */
  async ensureAgentInstalled(): Promise<string> {
    // 先嘗試查找已存在的可執行文件
    const existingPath = await this.findAgentExecutable();
    if (existingPath) {
      return existingPath;
    }

    // 如果不存在，下載到默認位置
    const agentPath = this.getAgentPath();
    return await this.downloadAgent(agentPath);
  }

  /**
   * 為服務器創建隧道
   */
  async createTunnel(serverId: string, localPort: number): Promise<TunnelInfo> {
    // 確保 Agent 已安裝
    const agentPath = await this.ensureAgentInstalled();

    // 檢查是否已有隧道
    const existingTunnel = this.tunnels.get(serverId);
    if (existingTunnel && existingTunnel.status === 'running') {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.TUNNEL_CREATE_FAILED,
        '該服務器已有運行中的隧道'
      )));
    }

    const tunnel: TunnelInfo = {
      serverId,
      localPort,
      status: 'stopped',
      createdAt: new Date().toISOString(),
    };

    this.tunnels.set(serverId, tunnel);
    return tunnel;
  }

  /**
   * 獲取或生成 Playit secret key
   * 首次使用時，如果沒有 secret，playit-agent 會自動生成 claim code
   */
  private async getOrCreateSecretKey(): Promise<string> {
    const secretFilePath = path.join(this.getAgentDirectory(), 'secret.txt');
    
    try {
      // 嘗試讀取已保存的 secret
      const secret = await fs.readFile(secretFilePath, 'utf-8');
      const trimmed = secret.trim();
      if (trimmed) {
        return trimmed;
      }
    } catch {
      // 文件不存在，將在首次運行時由 playit-agent 處理
    }
    
    // 如果環境變量中有 secret，使用它並保存
    const envSecret = process.env.PLAYIT_SECRET;
    if (envSecret) {
      await fs.writeFile(secretFilePath, envSecret, 'utf-8');
      return envSecret;
    }
    
    // 返回空字符串，playit-agent 會在首次運行時提示用戶進行 claim
    return '';
  }

  /**
   * 創建 playit.toml 配置文件
   * 將配置文件放在 agent 所在目錄，命名為 playit.toml（playit-agent 會自動查找）
   */
  private async createConfigFile(serverId: string, localPort: number, agentDir: string): Promise<string> {
    await fs.mkdir(agentDir, { recursive: true });
    // 將配置文件放在 agent 所在目錄，命名為 playit.toml
    const configPath = path.join(agentDir, 'playit.toml');
    
    // 獲取 secret key（如果沒有，playit-agent 會自動處理）
    const secretKey = await this.getOrCreateSecretKey();
    
    // 將 secret 複製到當前配置目錄，確保每個伺服器都能讀取
    const localSecretPath = path.join(agentDir, 'secret.txt');
    if (secretKey) {
      await fs.writeFile(localSecretPath, secretKey, 'utf-8');
    }
    
    // 使用相對路徑指向同目錄的 secret.txt
    const configContent = secretKey
      ? `agent_name = "lumix-${serverId}"
secret_path = "secret.txt"

[[tunnels]]
name = "minecraft-${serverId}"
proto = "tcp"
port_count = 1
local = ${localPort}
special_lan = true
`
      : `agent_name = "lumix-${serverId}"

[[tunnels]]
name = "minecraft-${serverId}"
proto = "tcp"
port_count = 1
local = ${localPort}
special_lan = true
`;

    await fs.writeFile(configPath, configContent, 'utf-8');
    return configPath;
  }

  /**
   * 啟動隧道
   */
  async startTunnel(serverId: string): Promise<void> {
    const tunnel = this.tunnels.get(serverId);
    if (!tunnel) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.TUNNEL_START_FAILED,
        '找不到指定的隧道'
      )));
    }

    if (tunnel.status === 'running' || tunnel.status === 'starting') {
      return; // 已經在運行或正在啟動
    }

    // 確保 Agent 已安裝
    const agentPath = await this.ensureAgentInstalled();
    
    // 驗證 agent 是否存在
    if (!(await this.checkAgentExists(agentPath))) {
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.TUNNEL_AGENT_NOT_FOUND,
        'playit-agent 未找到，請確保已正確下載'
      )));
    }

    // 為每個服務器創建獨立的配置目錄，避免配置文件衝突
    const configDir = path.join(this.getAgentDirectory(), 'configs', serverId);
    await fs.mkdir(configDir, { recursive: true });
    
    // 創建配置文件（放在獨立的配置目錄，命名為 playit.toml）
    await this.createConfigFile(serverId, tunnel.localPort, configDir);

    // 更新狀態
    tunnel.status = 'starting';
    this.tunnels.set(serverId, tunnel);
    this.emit('status-changed', serverId, 'starting');

    try {
      // 啟動 playit-agent 使用 start 命令
      // playit-agent 會自動在工作目錄查找 playit.toml 配置文件
      // 注意：playit-agent 可能會以交互模式運行，我們需要從輸出中提取信息
      const proc = spawn(agentPath, ['start'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsVerbatimArguments: true,
        cwd: configDir, // 設置工作目錄為配置目錄，playit-agent 會自動查找 playit.toml
      });

      this.processes.set(serverId, proc);

      // 解析輸出以獲取公網地址
      // 同時監聽 stdout 和 stderr，因為 playit-agent 可能將信息輸出到任一通道
      let outputBuffer = '';
      let stderrBuffer = '';
      
      const processOutput = (data: string, isStderr: boolean) => {
        // 清理 ANSI 轉義碼以檢查是否有實際內容
        const cleanData = data.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '').trim();
        
        if (isStderr) {
          stderrBuffer += data;
          // 只記錄有實際內容的 stderr
          if (cleanData) {
            console.log(`[Tunnel ${serverId}] stderr:`, cleanData);
          }
          // 檢查是否為錯誤
          if (data.toLowerCase().includes('error')) {
            tunnel.status = 'error';
            this.tunnels.set(serverId, tunnel);
            this.emit('status-changed', serverId, 'error');
          }
        } else {
          outputBuffer += data;
          // 只記錄有實際內容的 stdout（過濾 TUI 控制碼）
          if (cleanData) {
            console.log(`[Tunnel ${serverId}] stdout:`, cleanData);
          }
        }
        
        // 只在有實際內容時才解析（避免處理純 TUI 更新）
        if (cleanData) {
          this.parseTunnelOutput(serverId, outputBuffer + stderrBuffer);
        }
      };

      proc.stdout?.on('data', (data: Buffer) => {
        processOutput(data.toString(), false);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        processOutput(data.toString(), true);
      });

      proc.on('exit', (code) => {
        this.processes.delete(serverId);
        if (tunnel.status === 'running') {
          tunnel.status = 'stopped';
          this.tunnels.set(serverId, tunnel);
          this.emit('status-changed', serverId, 'stopped');
        }
        console.log(`[Tunnel ${serverId}] 進程退出，代碼: ${code}`);
      });

      proc.on('error', (error) => {
        console.error(`[Tunnel ${serverId}] 進程錯誤:`, error);
        tunnel.status = 'error';
        this.tunnels.set(serverId, tunnel);
        this.emit('status-changed', serverId, 'error');
        this.processes.delete(serverId);
      });

      // 等待一段時間讓隧道啟動並獲取地址信息
      // playit-agent 可能需要一些時間來建立連接並輸出地址
      // 同時嘗試通過命令查詢隧道信息
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // 檢查是否已經解析到地址
        const currentTunnel = this.tunnels.get(serverId);
        if (currentTunnel?.publicAddress && currentTunnel?.publicPort) {
          console.log(`[Tunnel ${serverId}] 已獲取地址信息: ${currentTunnel.publicAddress}:${currentTunnel.publicPort}`);
          break;
        }
        
        // 嘗試通過命令查詢隧道信息（如果輸出中沒有找到）
        if (i >= 2 && !currentTunnel?.publicAddress) {
          await this.queryTunnelInfo(serverId, agentPath, configDir);
        }
        
        // 檢查進程是否已退出（錯誤情況）
        if (proc.killed || proc.exitCode !== null) {
          break;
        }
      }

      // 如果沒有錯誤，標記為運行中
      if (tunnel.status === 'starting') {
        tunnel.status = 'running';
        this.tunnels.set(serverId, tunnel);
        this.emit('status-changed', serverId, 'running');
        this.emit('info-updated', serverId, tunnel);
      }
    } catch (error) {
      tunnel.status = 'error';
      this.tunnels.set(serverId, tunnel);
      this.emit('status-changed', serverId, 'error');
      throw new Error(formatIpcError(createIpcError(
        IpcErrorCode.TUNNEL_START_FAILED,
        `啟動隧道失敗: ${error instanceof Error ? error.message : String(error)}`
      )));
    }
  }

  /**
   * 通過命令查詢隧道信息
   */
  private async queryTunnelInfo(serverId: string, agentPath: string, configDir: string): Promise<void> {
    const tunnel = this.tunnels.get(serverId);
    if (!tunnel || (tunnel.publicAddress && tunnel.publicPort)) {
      return; // 已經有地址信息，不需要查詢
    }

    try {
      // 嘗試使用 playit-agent 的命令查詢隧道信息
      // 可能的命令：tunnels list, tunnels show, 等
      const commands = [
        ['tunnels', 'list', '--json'],
        ['tunnels', 'list'],
        ['tunnel', 'list', '--json'],
        ['tunnel', 'list'],
      ];

      for (const cmd of commands) {
        try {
          const { stdout, stderr } = await execAsync(
            `"${agentPath}" ${cmd.join(' ')}`,
            { 
              cwd: configDir,
              timeout: 5000,
              encoding: 'utf8' as BufferEncoding
            }
          );
          
          const output = stdout || stderr;
          if (output) {
            console.log(`[Tunnel ${serverId}] 查詢命令輸出:`, output);
            this.parseTunnelOutput(serverId, output);
            
            // 如果成功解析到地址，返回
            const currentTunnel = this.tunnels.get(serverId);
            if (currentTunnel?.publicAddress && currentTunnel?.publicPort) {
              return;
            }
          }
        } catch (error) {
          // 命令不存在或失敗，嘗試下一個
          continue;
        }
      }
    } catch (error) {
      // 查詢失敗，忽略錯誤
      console.warn(`[Tunnel ${serverId}] 查詢隧道信息失敗:`, error);
    }
  }

  /**
   * 解析隧道輸出以獲取公網地址
   */
  private parseTunnelOutput(serverId: string, output: string): void {
    const tunnel = this.tunnels.get(serverId);
    if (!tunnel) return;

    // 如果已經有地址，不需要重複解析
    if (tunnel.publicAddress && tunnel.publicPort) {
      return;
    }

    // 清理輸出：移除 ANSI 轉義碼和其他控制字符
    const cleanOutput = output
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '') // 移除 ANSI 轉義碼
      .replace(/\r\n/g, '\n') // 統一換行符
      .replace(/\r/g, '\n');

    // 檢查是否需要 claim（關聯賬戶）
    // 只處理一次，避免重複輸出
    if (!tunnel.tunnelId) {
      const claimMatch = cleanOutput.match(/https?:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)/i);
      if (claimMatch) {
        const claimCode = claimMatch[1];
        const claimUrl = `https://playit.gg/claim/${claimCode}`;
        console.log(`[Tunnel ${serverId}] Claim required, code: ${claimCode}`);
        console.log(`[Tunnel ${serverId}] Claim URL: ${claimUrl}`);
        
        // 發送事件通知前端顯示 claim 對話框
        this.emit('claim-required', serverId, claimUrl, claimCode);
        
        // 將 claim code 存儲在 tunnel 信息中
        tunnel.tunnelId = claimCode;
        this.tunnels.set(serverId, tunnel);
        this.emit('info-updated', serverId, tunnel);
      }
    }

    // 首先嘗試解析 JSON 格式（如果輸出是 JSON）
    try {
      const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        // 嘗試從 JSON 中提取地址信息
        if (jsonData.shared_ip || jsonData.shared_host || jsonData.host) {
          const address = jsonData.shared_ip || jsonData.shared_host || jsonData.host;
          const port = jsonData.port || jsonData.external_port;
          if (address && port) {
            tunnel.publicAddress = address;
            tunnel.publicPort = parseInt(String(port), 10);
            this.tunnels.set(serverId, tunnel);
            this.emit('info-updated', serverId, tunnel);
            await this.saveTunnelInfo(serverId);
            console.log(`[Tunnel ${serverId}] 從 JSON 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
            return;
          }
        }
        // 如果是數組，嘗試查找第一個隧道
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          const firstTunnel = jsonData[0];
          if (firstTunnel.shared_ip || firstTunnel.shared_host || firstTunnel.host) {
            const address = firstTunnel.shared_ip || firstTunnel.shared_host || firstTunnel.host;
            const port = firstTunnel.port || firstTunnel.external_port;
            if (address && port) {
              tunnel.publicAddress = address;
              tunnel.publicPort = parseInt(String(port), 10);
              this.tunnels.set(serverId, tunnel);
              this.emit('info-updated', serverId, tunnel);
              await this.saveTunnelInfo(serverId);
              console.log(`[Tunnel ${serverId}] 從 JSON 數組解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
              return;
            }
          }
        }
      }
    } catch (error) {
      // JSON 解析失敗，繼續嘗試其他格式
    }

    // 嘗試多種輸出格式來解析公網地址
    // 1. tcp://xxx.playit.gg:xxxxx
    let match = cleanOutput.match(/tcp:\/\/([^:\s]+):(\d+)/i);
    if (match) {
      tunnel.publicAddress = match[1];
      tunnel.publicPort = parseInt(match[2], 10);
      this.tunnels.set(serverId, tunnel);
      this.emit('info-updated', serverId, tunnel);
      await this.saveTunnelInfo(serverId); // 保存到檔案
      console.log(`[Tunnel ${serverId}] 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
      return;
    }

    // 2. xxx.playit.gg:xxxxx (不帶協議)
    match = cleanOutput.match(/([a-z0-9-]+\.playit\.gg):(\d+)/i);
    if (match) {
      tunnel.publicAddress = match[1];
      tunnel.publicPort = parseInt(match[2], 10);
      this.tunnels.set(serverId, tunnel);
      this.emit('info-updated', serverId, tunnel);
      await this.saveTunnelInfo(serverId);
      console.log(`[Tunnel ${serverId}] 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
      return;
    }

    // 3. Connected to xxx.playit.gg:xxxxx
    match = cleanOutput.match(/connected\s+to\s+([a-z0-9-]+\.playit\.gg):(\d+)/i);
    if (match) {
      tunnel.publicAddress = match[1];
      tunnel.publicPort = parseInt(match[2], 10);
      this.tunnels.set(serverId, tunnel);
      this.emit('info-updated', serverId, tunnel);
      await this.saveTunnelInfo(serverId);
      console.log(`[Tunnel ${serverId}] 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
      return;
    }

    // 4. Public address: xxx.playit.gg:xxxxx
    match = cleanOutput.match(/public\s+address[:\s]+([a-z0-9-]+\.playit\.gg):(\d+)/i);
    if (match) {
      tunnel.publicAddress = match[1];
      tunnel.publicPort = parseInt(match[2], 10);
      this.tunnels.set(serverId, tunnel);
      this.emit('info-updated', serverId, tunnel);
      await this.saveTunnelInfo(serverId);
      console.log(`[Tunnel ${serverId}] 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
      return;
    }

    // 5. Tunnel URL: tcp://xxx.playit.gg:xxxxx
    match = cleanOutput.match(/tunnel\s+url[:\s]+tcp:\/\/([^:\s]+):(\d+)/i);
    if (match) {
      tunnel.publicAddress = match[1];
      tunnel.publicPort = parseInt(match[2], 10);
      this.tunnels.set(serverId, tunnel);
      this.emit('info-updated', serverId, tunnel);
      await this.saveTunnelInfo(serverId);
      console.log(`[Tunnel ${serverId}] 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
      return;
    }

    // 6. 嘗試從清理後的輸出中查找任何 playit.gg 域名和端口組合
    // 格式可能是：server-region01.ply.gg:19501 或其他變體
    match = cleanOutput.match(/([a-z0-9-]+\.(?:playit|ply)\.gg):(\d{4,5})/i);
    if (match) {
      tunnel.publicAddress = match[1];
      tunnel.publicPort = parseInt(match[2], 10);
      this.tunnels.set(serverId, tunnel);
      this.emit('info-updated', serverId, tunnel);
      await this.saveTunnelInfo(serverId);
      console.log(`[Tunnel ${serverId}] 解析到地址: ${tunnel.publicAddress}:${tunnel.publicPort}`);
      return;
    }
  }

  /**
   * 停止隧道
   */
  async stopTunnel(serverId: string): Promise<void> {
    const tunnel = this.tunnels.get(serverId);
    if (!tunnel) {
      return; // 隧道不存在，視為已停止
    }

    if (tunnel.status === 'stopped') {
      return; // 已經停止
    }

    tunnel.status = 'stopping';
    this.tunnels.set(serverId, tunnel);
    this.emit('status-changed', serverId, 'stopping');

    // 終止進程
    const proc = this.processes.get(serverId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
        // 等待進程結束
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            proc.kill('SIGKILL');
            resolve();
          }, 5000);

          proc.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        console.error(`[Tunnel ${serverId}] 停止進程時出錯:`, error);
      }
      this.processes.delete(serverId);
    }

    tunnel.status = 'stopped';
    this.tunnels.set(serverId, tunnel);
    this.emit('status-changed', serverId, 'stopped');
  }

  /**
   * 獲取隧道狀態
   */
  getTunnelStatus(serverId: string): TunnelStatus {
    const tunnel = this.tunnels.get(serverId);
    return tunnel?.status || 'stopped';
  }

  /**
   * 獲取隧道信息
   */
  getTunnelInfo(serverId: string): TunnelInfo | null {
    return this.tunnels.get(serverId) || null;
  }

  /**
   * 刪除隧道
   */
  async deleteTunnel(serverId: string): Promise<void> {
    // 先停止隧道
    await this.stopTunnel(serverId);
    // 移除隧道記錄
    this.tunnels.delete(serverId);
  }

  /**
   * 清理所有資源
   */
  async cleanup(): Promise<void> {
    // 停止所有隧道
    for (const serverId of this.tunnels.keys()) {
      await this.stopTunnel(serverId);
    }
    this.tunnels.clear();
    this.processes.clear();
  }
}
