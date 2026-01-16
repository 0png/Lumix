/**
 * ProcessManager Service
 * 管理 Java 子程序的生命週期與 I/O
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface ProcessConfig {
  serverId: string;
  javaPath: string;
  jarPath: string;
  workingDir: string;
  ramMin: number;
  ramMax: number;
  jvmArgs: string[];
  forgeArgsFile?: string; // 新版 Forge 的 args 檔案路徑
}

export interface ProcessInfo {
  serverId: string;
  process: ChildProcess;
  startedAt: Date;
}

export interface ProcessEvents {
  stdout: (serverId: string, data: string) => void;
  stderr: (serverId: string, data: string) => void;
  exit: (serverId: string, code: number | null, signal: string | null) => void;
  error: (serverId: string, error: Error) => void;
}

// ============================================================================
// ProcessManager Class
// ============================================================================

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();

  constructor() {
    super();
  }

  /**
   * 啟動一個新的 Java 程序
   */
  spawn(config: ProcessConfig): ChildProcess {
    // 如果已經有同 serverId 的程序在執行，先終止它
    if (this.isRunning(config.serverId)) {
      this.kill(config.serverId);
    }

    // 建構 JVM 參數
    const args = this.buildJvmArgs(config);

    // 啟動程序（spawn 可能同步拋出 ENOENT 等錯誤）
    let proc: ChildProcess;
    try {
      proc = spawn(config.javaPath, args, {
        cwd: config.workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      // 同步錯誤（如 ENOENT），emit error 事件讓上層處理
      const err = error instanceof Error ? error : new Error(String(error));
      // 使用 setImmediate 確保事件監聽器已設置
      setImmediate(() => {
        this.emit('error', config.serverId, err);
      });
      throw err;
    }

    // 儲存程序資訊
    const processInfo: ProcessInfo = {
      serverId: config.serverId,
      process: proc,
      startedAt: new Date(),
    };
    this.processes.set(config.serverId, processInfo);

    // 設定事件監聯
    this.setupProcessListeners(config.serverId, proc);

    return proc;
  }

  /**
   * 終止指定的程序
   */
  kill(serverId: string): boolean {
    const info = this.processes.get(serverId);
    if (!info) {
      return false;
    }

    try {
      const killed = info.process.kill('SIGTERM');
      
      // 如果 SIGTERM 失敗，嘗試 SIGKILL
      if (!killed) {
        info.process.kill('SIGKILL');
      }

      return true;
    } catch {
      // 程序可能已經結束，忽略錯誤
      return false;
    }
  }

  /**
   * 強制終止指定的程序
   */
  forceKill(serverId: string): boolean {
    const info = this.processes.get(serverId);
    if (!info) {
      return false;
    }

    return info.process.kill('SIGKILL');
  }

  /**
   * 寫入資料到程序的 stdin
   */
  writeStdin(serverId: string, data: string): boolean {
    const info = this.processes.get(serverId);
    if (!info || !info.process.stdin) {
      return false;
    }

    // 確保資料以換行結尾
    const dataWithNewline = data.endsWith('\n') ? data : data + '\n';
    return info.process.stdin.write(dataWithNewline);
  }

  /**
   * 檢查程序是否正在執行
   */
  isRunning(serverId: string): boolean {
    const info = this.processes.get(serverId);
    if (!info) {
      return false;
    }

    // 檢查程序是否還活著
    return info.process.exitCode === null && info.process.signalCode === null;
  }

  /**
   * 取得程序實例
   */
  getProcess(serverId: string): ChildProcess | null {
    const info = this.processes.get(serverId);
    return info?.process ?? null;
  }

  /**
   * 取得程序資訊
   */
  getProcessInfo(serverId: string): ProcessInfo | null {
    return this.processes.get(serverId) ?? null;
  }

  /**
   * 取得所有執行中的程序 ID
   */
  getRunningProcessIds(): string[] {
    return Array.from(this.processes.keys()).filter((id) => this.isRunning(id));
  }

  /**
   * 終止所有程序
   */
  killAll(): void {
    for (const serverId of this.processes.keys()) {
      this.kill(serverId);
    }
  }

  /**
   * 建構 JVM 啟動參數
   */
  private buildJvmArgs(config: ProcessConfig): string[] {
    // 新版 Forge 使用 @args.txt 方式啟動
    if (config.forgeArgsFile) {
      const args: string[] = [
        `-Xms${config.ramMin}M`,
        `-Xmx${config.ramMax}M`,
        ...config.jvmArgs,
        '@user_jvm_args.txt',
        `@${config.forgeArgsFile}`,
        'nogui',
      ];
      return args;
    }

    // 標準 -jar 方式啟動
    const args: string[] = [
      `-Xms${config.ramMin}M`,
      `-Xmx${config.ramMax}M`,
      ...config.jvmArgs,
      '-jar',
      config.jarPath,
      'nogui',
    ];
    return args;
  }

  /**
   * 設定程序事件監聽器
   */
  private setupProcessListeners(serverId: string, proc: ChildProcess): void {
    // stdout 事件
    proc.stdout?.on('data', (data: Buffer) => {
      this.emit('stdout', serverId, data.toString());
    });

    // stderr 事件
    proc.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', serverId, data.toString());
    });

    // 程序結束事件
    proc.on('exit', (code, signal) => {
      this.emit('exit', serverId, code, signal);
      // 從 map 中移除（延遲移除以便讀取最終狀態）
      setTimeout(() => {
        this.processes.delete(serverId);
      }, 1000);
    });

    // 錯誤事件
    proc.on('error', (error: Error) => {
      this.emit('error', serverId, error);
    });
  }
}
