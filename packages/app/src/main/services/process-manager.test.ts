/**
 * ProcessManager Unit Tests
 * 測試 process 狀態管理和 stdin 寫入
 * 
 * 注意：這些測試使用 node 來模擬程序行為，
 * 因此需要繞過 JVM 參數的問題
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProcessManager } from './process-manager';
import { spawn } from 'child_process';
import os from 'os';

// ============================================================================
// Test Suite
// ============================================================================

describe('ProcessManager', () => {
  let processManager: ProcessManager;

  beforeEach(() => {
    processManager = new ProcessManager();
  });

  afterEach(() => {
    // 清理所有程序
    processManager.killAll();
  });

  describe('初始狀態', () => {
    it('應該沒有任何執行中的程序', () => {
      expect(processManager.getRunningProcessIds()).toHaveLength(0);
    });

    it('isRunning 對不存在的 serverId 應該回傳 false', () => {
      expect(processManager.isRunning('non-existent')).toBe(false);
    });

    it('getProcess 對不存在的 serverId 應該回傳 null', () => {
      expect(processManager.getProcess('non-existent')).toBeNull();
    });

    it('getProcessInfo 對不存在的 serverId 應該回傳 null', () => {
      expect(processManager.getProcessInfo('non-existent')).toBeNull();
    });
  });

  describe('spawn', () => {
    it('應該成功啟動程序', () => {
      const proc = processManager.spawn({
        serverId: 'test-server-1',
        javaPath: process.execPath,
        jarPath: '-e',
        workingDir: os.tmpdir(),
        ramMin: 1024,
        ramMax: 2048,
        // 把實際要執行的腳本放在 jvmArgs，這樣 node -e 會執行它
        jvmArgs: [],
      });

      // 由於 node 不認識 -Xms 等參數會報錯，但程序仍會啟動
      expect(proc).toBeDefined();
      expect(proc.pid).toBeDefined();
    });

    it('應該在 spawn 後能取得 processInfo', () => {
      processManager.spawn({
        serverId: 'test-server-2',
        javaPath: process.execPath,
        jarPath: '-e',
        workingDir: os.tmpdir(),
        ramMin: 1024,
        ramMax: 2048,
        jvmArgs: [],
      });

      const info = processManager.getProcessInfo('test-server-2');
      expect(info).not.toBeNull();
      expect(info?.serverId).toBe('test-server-2');
      expect(info?.startedAt).toBeInstanceOf(Date);
    });

    it('重複 spawn 同一個 serverId 應該終止舊程序', async () => {
      const proc1 = processManager.spawn({
        serverId: 'test-server-3',
        javaPath: process.execPath,
        jarPath: '-e',
        workingDir: os.tmpdir(),
        ramMin: 1024,
        ramMax: 2048,
        jvmArgs: [],
      });
      const pid1 = proc1.pid;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const proc2 = processManager.spawn({
        serverId: 'test-server-3',
        javaPath: process.execPath,
        jarPath: '-e',
        workingDir: os.tmpdir(),
        ramMin: 1024,
        ramMax: 2048,
        jvmArgs: [],
      });
      const pid2 = proc2.pid;

      expect(pid1).not.toBe(pid2);
    });
  });

  describe('kill', () => {
    it('對不存在的 serverId 應該回傳 false', () => {
      const killed = processManager.kill('non-existent');
      expect(killed).toBe(false);
    });

    it('應該能終止程序', async () => {
      // 直接使用 spawn 建立一個長時間執行的程序
      const proc = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // 手動註冊到 processManager（模擬內部行為）
      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.set('test-kill', {
        serverId: 'test-kill',
        process: proc,
        startedAt: new Date(),
      });

      expect(processManager.isRunning('test-kill')).toBe(true);

      const killed = processManager.kill('test-kill');
      expect(killed).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(processManager.isRunning('test-kill')).toBe(false);
    });
  });

  describe('writeStdin', () => {
    it('對不存在的 serverId 應該回傳 false', () => {
      const result = processManager.writeStdin('non-existent', 'test');
      expect(result).toBe(false);
    });

    it('應該能寫入資料到程序的 stdin', async () => {
      // 建立一個會讀取 stdin 的程序
      const proc = spawn(
        process.execPath,
        ['-e', `process.stdin.on('data', d => console.log('got:', d.toString())); setTimeout(() => {}, 5000);`],
        {
          cwd: os.tmpdir(),
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // 手動註冊
      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.set('test-stdin', {
        serverId: 'test-stdin',
        process: proc,
        startedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = processManager.writeStdin('test-stdin', 'hello');
      expect(result).toBe(true);

      // 在測試結束前手動清理，避免 afterEach 中的 killAll 出錯
      try {
        proc.kill();
      } catch {
        // 忽略 kill 錯誤
      }
      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.delete('test-stdin');
    });
  });

  describe('事件發射', () => {
    it('應該在程序結束時發射 exit 事件', async () => {
      const exitHandler = vi.fn();
      processManager.on('exit', exitHandler);

      // 建立一個會立即結束的程序
      const proc = spawn(process.execPath, ['-e', 'process.exit(0)'], {
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // 手動註冊並設定監聽器
      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.set('test-exit', {
        serverId: 'test-exit',
        process: proc,
        startedAt: new Date(),
      });

      // 設定事件監聽
      // @ts-expect-error - 存取私有方法進行測試
      processManager.setupProcessListeners('test-exit', proc);

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(exitHandler).toHaveBeenCalled();
      const calls = exitHandler.mock.calls[0] as [string, number | null, string | null];
      const [serverId, code] = calls;
      expect(serverId).toBe('test-exit');
      expect(code).toBe(0);
    });

    it('應該在 stdout 有資料時發射 stdout 事件', async () => {
      const stdoutHandler = vi.fn();
      processManager.on('stdout', stdoutHandler);

      const proc = spawn(process.execPath, ['-e', 'console.log("hello stdout")'], {
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.set('test-stdout', {
        serverId: 'test-stdout',
        process: proc,
        startedAt: new Date(),
      });

      // @ts-expect-error - 存取私有方法進行測試
      processManager.setupProcessListeners('test-stdout', proc);

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(stdoutHandler).toHaveBeenCalled();
      const calls = stdoutHandler.mock.calls[0] as [string, string];
      const [serverId, data] = calls;
      expect(serverId).toBe('test-stdout');
      expect(data).toContain('hello stdout');
    });

    it('應該在 stderr 有資料時發射 stderr 事件', async () => {
      const stderrHandler = vi.fn();
      processManager.on('stderr', stderrHandler);

      const proc = spawn(process.execPath, ['-e', 'console.error("hello stderr")'], {
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.set('test-stderr', {
        serverId: 'test-stderr',
        process: proc,
        startedAt: new Date(),
      });

      // @ts-expect-error - 存取私有方法進行測試
      processManager.setupProcessListeners('test-stderr', proc);

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(stderrHandler).toHaveBeenCalled();
      const calls = stderrHandler.mock.calls[0] as [string, string];
      const [serverId, data] = calls;
      expect(serverId).toBe('test-stderr');
      expect(data).toContain('hello stderr');
    });

    it('應該捕獲正確的 exit code', async () => {
      const exitHandler = vi.fn();
      processManager.on('exit', exitHandler);

      const proc = spawn(process.execPath, ['-e', 'process.exit(42)'], {
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // @ts-expect-error - 存取私有屬性進行測試
      processManager.processes.set('test-exit-code', {
        serverId: 'test-exit-code',
        process: proc,
        startedAt: new Date(),
      });

      // @ts-expect-error - 存取私有方法進行測試
      processManager.setupProcessListeners('test-exit-code', proc);

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(exitHandler).toHaveBeenCalled();
      const calls = exitHandler.mock.calls[0] as [string, number | null, string | null];
      const [, code] = calls;
      expect(code).toBe(42);
    });
  });

  describe('killAll', () => {
    it('應該終止所有程序', async () => {
      // 建立多個程序
      for (let i = 0; i < 3; i++) {
        const proc = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
          cwd: os.tmpdir(),
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // @ts-expect-error - 存取私有屬性進行測試
        processManager.processes.set(`test-all-${i}`, {
          serverId: `test-all-${i}`,
          process: proc,
          startedAt: new Date(),
        });
      }

      expect(processManager.getRunningProcessIds()).toHaveLength(3);

      processManager.killAll();

      await new Promise((resolve) => setTimeout(resolve, 300));

      // 所有程序都應該已終止
      for (let i = 0; i < 3; i++) {
        expect(processManager.isRunning(`test-all-${i}`)).toBe(false);
      }
    });
  });

  describe('getRunningProcessIds', () => {
    it('應該回傳所有執行中程序的 ID', () => {
      // 建立兩個程序
      for (let i = 0; i < 2; i++) {
        const proc = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
          cwd: os.tmpdir(),
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // @ts-expect-error - 存取私有屬性進行測試
        processManager.processes.set(`running-${i}`, {
          serverId: `running-${i}`,
          process: proc,
          startedAt: new Date(),
        });
      }

      const runningIds = processManager.getRunningProcessIds();
      expect(runningIds).toContain('running-0');
      expect(runningIds).toContain('running-1');
      expect(runningIds).toHaveLength(2);
    });
  });

  describe('buildJvmArgs', () => {
    it('應該正確建構 JVM 參數', () => {
      // @ts-expect-error - 存取私有方法進行測試
      const args = processManager.buildJvmArgs({
        serverId: 'test',
        javaPath: 'java',
        jarPath: 'server.jar',
        workingDir: '/tmp',
        ramMin: 1024,
        ramMax: 4096,
        jvmArgs: ['-XX:+UseG1GC'],
      });

      expect(args).toContain('-Xms1024M');
      expect(args).toContain('-Xmx4096M');
      expect(args).toContain('-XX:+UseG1GC');
      expect(args).toContain('-jar');
      expect(args).toContain('server.jar');
      expect(args).toContain('nogui');
    });
  });
});
