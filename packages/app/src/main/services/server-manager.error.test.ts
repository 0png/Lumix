/**
 * ServerManager Error Handling Property Tests
 * 驗證錯誤處理的正確性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerManager } from './server-manager';
import { FileManager } from './file-manager';
import { ProcessManager } from './process-manager';
import { IpcErrorCode, parseIpcError } from '../../shared/ipc-types';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('./file-manager');
vi.mock('./process-manager');

function createMockFileManager(): FileManager {
  return {
    createServerDirectory: vi.fn().mockResolvedValue('/mock/servers/test'),
    deleteServerDirectory: vi.fn().mockResolvedValue(undefined),
    writeEula: vi.fn().mockResolvedValue(undefined),
    writeRunBat: vi.fn().mockResolvedValue(undefined),
    writeServerJson: vi.fn().mockResolvedValue(undefined),
    readServerJson: vi.fn().mockResolvedValue(null),
    discoverServers: vi.fn().mockResolvedValue([]),
    serverExists: vi.fn().mockResolvedValue(false),
    getServerPath: vi.fn().mockReturnValue('/mock/servers/test'),
  } as unknown as FileManager;
}

function createMockProcessManager(): ProcessManager {
  const pm = new (ProcessManager as unknown as new () => ProcessManager)();
  vi.spyOn(pm, 'spawn').mockReturnValue({} as ReturnType<ProcessManager['spawn']>);
  vi.spyOn(pm, 'kill').mockReturnValue(true);
  vi.spyOn(pm, 'forceKill').mockReturnValue(true);
  vi.spyOn(pm, 'writeStdin').mockReturnValue(true);
  vi.spyOn(pm, 'isRunning').mockReturnValue(false);
  return pm;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('ServerManager Error Handling', () => {
  let serverManager: ServerManager;
  let mockFileManager: FileManager;
  let mockProcessManager: ProcessManager;

  beforeEach(() => {
    mockFileManager = createMockFileManager();
    mockProcessManager = createMockProcessManager();
    serverManager = new ServerManager({
      fileManager: mockFileManager,
      processManager: mockProcessManager,
    });
  });

  // Property 23: Error Messages Are Descriptive
  describe('Property 23: Error Messages Are Descriptive', () => {
    it('should include error code in empty name error', async () => {
      await expect(serverManager.createServer({
        name: '',
        coreType: 'vanilla',
        mcVersion: '1.20.4',
      })).rejects.toThrow();

      try {
        await serverManager.createServer({
          name: '   ',
          coreType: 'vanilla',
          mcVersion: '1.20.4',
        });
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_INVALID_NAME);
        expect(parsed.message).toBeTruthy();
        expect(parsed.message.length).toBeGreaterThan(5);
      }
    });

    it('should include error code in duplicate name error', async () => {
      await serverManager.createServer({
        name: 'TestServer',
        coreType: 'vanilla',
        mcVersion: '1.20.4',
      });

      try {
        await serverManager.createServer({
          name: 'TestServer',
          coreType: 'paper',
          mcVersion: '1.20.4',
        });
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_DUPLICATE_NAME);
        expect(parsed.message).toBeTruthy();
      }
    });

    it('should include error code in not found error', async () => {
      try {
        await serverManager.getServerById('non-existent-id');
        await serverManager.startServer('non-existent-id');
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_NOT_FOUND);
      }
    });

    it('should include error code in invalid state error', async () => {
      const server = await serverManager.createServer({
        name: 'TestServer',
        coreType: 'vanilla',
        mcVersion: '1.20.4',
      });

      try {
        await serverManager.stopServer(server.id);
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_INVALID_STATE);
        expect(parsed.message).toContain('停止');
      }
    });
  });

  // Property 24: Startup Failure Reverts Status
  describe('Property 24: Startup Failure Reverts Status', () => {
    it('should revert status to stopped when Java validation fails', async () => {
      const server = await serverManager.createServer({
        name: 'TestServer',
        coreType: 'vanilla',
        mcVersion: '1.20.4',
        javaPath: '/invalid/java/path',
      });

      expect(server.status).toBe('stopped');

      try {
        await serverManager.startServer(server.id);
      } catch {
        // Expected to fail
      }

      const updatedServer = await serverManager.getServerById(server.id);
      expect(updatedServer?.status).toBe('stopped');
    });

    it('should include JAVA_NOT_FOUND code when Java is invalid', async () => {
      // 使用一個絕對不存在的 Java 路徑，並且設定 defaultJavaPath 也無效
      const isolatedManager = new ServerManager({
        fileManager: mockFileManager,
        processManager: mockProcessManager,
        defaultJavaPath: '/absolutely/invalid/java/path/that/does/not/exist',
      });

      const server = await isolatedManager.createServer({
        name: 'TestServer',
        coreType: 'vanilla',
        mcVersion: '1.20.4',
        javaPath: '/another/invalid/java/path',
      });

      try {
        await isolatedManager.startServer(server.id);
        // 如果沒有拋出錯誤，測試應該失敗
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        // 可能是 JAVA_NOT_FOUND 或 SERVER_JAR_NOT_FOUND，取決於系統環境
        expect([IpcErrorCode.JAVA_NOT_FOUND, IpcErrorCode.SERVER_JAR_NOT_FOUND]).toContain(parsed.code);
      }
    });
  });

  // Additional error handling tests
  describe('Error Code Consistency', () => {
    it('should use consistent error codes across operations', async () => {
      // Test delete non-existent
      try {
        await serverManager.deleteServer('non-existent');
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_NOT_FOUND);
      }

      // Test update non-existent
      try {
        await serverManager.updateServer({ id: 'non-existent', name: 'New Name' });
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_NOT_FOUND);
      }

      // Test sendCommand non-existent
      try {
        await serverManager.sendCommand('non-existent', 'help');
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_NOT_FOUND);
      }
    });

    it('should use SERVER_INVALID_STATE for state-related errors', async () => {
      const server = await serverManager.createServer({
        name: 'TestServer',
        coreType: 'vanilla',
        mcVersion: '1.20.4',
      });

      // Test sendCommand on stopped server
      try {
        await serverManager.sendCommand(server.id, 'help');
      } catch (error) {
        const parsed = parseIpcError((error as Error).message);
        expect(parsed.code).toBe(IpcErrorCode.SERVER_INVALID_STATE);
      }
    });
  });
});
