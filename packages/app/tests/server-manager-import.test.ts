import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { FileManager } from '../src/main/services/file-manager';
import { ImportRegistry } from '../src/main/services/import-registry';
import { ImportScanner } from '../src/main/services/import-scanner';
import { ServerManager } from '../src/main/services/server-manager';

class FakeProcessManager extends EventEmitter {
  public spawned: Array<{
    serverId: string;
    jarPath: string;
    workingDir: string;
    loaderArgsFile?: string;
    userJvmArgsFile?: string;
  }> = [];

  spawn(config: {
    serverId: string;
    jarPath: string;
    workingDir: string;
    loaderArgsFile?: string;
    userJvmArgsFile?: string;
  }) {
    this.spawned.push(config);
    return {} as never;
  }

  writeStdin(): boolean {
    return true;
  }

  kill(): boolean {
    return true;
  }

  forceKill(): boolean {
    return true;
  }

  isRunning(): boolean {
    return false;
  }

  killAll(): void {}
}

describe('ServerManager import flow', () => {
  let rootDir: string;
  let externalDir: string;
  let fileManager: FileManager;
  let importRegistry: ImportRegistry;
  let processManager: FakeProcessManager;
  let manager: ServerManager;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-server-manager-'));
    externalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-external-server-'));
    fileManager = new FileManager(rootDir);
    importRegistry = new ImportRegistry(rootDir);
    processManager = new FakeProcessManager();
    manager = new ServerManager({
      fileManager,
      importRegistry,
      importScanner: new ImportScanner(),
      processManager: processManager as never,
      defaultJavaPath: 'java',
    });
  });

  afterEach(async () => {
    await Promise.all([
      fs.rm(rootDir, { recursive: true, force: true }),
      fs.rm(externalDir, { recursive: true, force: true }),
    ]);
  });

  it('imports existing servers into the registry and reloads them', async () => {
    const jarPath = path.join(externalDir, 'server.jar');
    await fs.writeFile(jarPath, '');
    await fs.writeFile(path.join(externalDir, 'eula.txt'), 'eula=true\n', 'utf-8');

    const imported = await manager.importExistingServer({
      directory: externalDir,
      name: 'Imported Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      launchJarPath: jarPath,
    });

    expect(imported.origin).toBe('imported');
    expect(imported.directory).toBe(path.resolve(externalDir));

    const reloadedManager = new ServerManager({
      fileManager,
      importRegistry,
      importScanner: new ImportScanner(),
      processManager: processManager as never,
      defaultJavaPath: 'java',
    });
    await reloadedManager.loadServers();

    const servers = await reloadedManager.getAllServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]?.origin).toBe('imported');
    expect(servers[0]?.launchJarPath).toBe(path.resolve(jarPath));
  });

  it('rejects duplicate imports of the same directory', async () => {
    const jarPath = path.join(externalDir, 'server.jar');
    await fs.writeFile(jarPath, '');

    await manager.importExistingServer({
      directory: externalDir,
      name: 'Imported Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      launchJarPath: jarPath,
    });

    await expect(manager.importExistingServer({
      directory: externalDir,
      name: 'Imported Server 2',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      launchJarPath: jarPath,
    })).rejects.toThrow('此資料夾已經匯入過');
  });

  it('removes imported servers from Lumix without deleting the original folder', async () => {
    const jarPath = path.join(externalDir, 'server.jar');
    await fs.writeFile(jarPath, '');

    const imported = await manager.importExistingServer({
      directory: externalDir,
      name: 'Imported Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      launchJarPath: jarPath,
    });

    await manager.deleteServer(imported.id);

    await expect(fs.stat(externalDir)).resolves.toBeTruthy();
    expect(await manager.getAllServers()).toHaveLength(0);
    expect(await importRegistry.list()).toHaveLength(0);
  });

  it('starts imported servers with the selected launch jar path', async () => {
    const jarPath = path.join(externalDir, 'custom-launch.jar');
    await fs.writeFile(jarPath, '');

    const imported = await manager.importExistingServer({
      directory: externalDir,
      name: 'Imported Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      launchJarPath: jarPath,
      javaPath: 'java',
    });

    Object.assign(
      manager as unknown as { validateJava: (javaPath: string) => Promise<boolean> },
      { validateJava: async () => true }
    );

    await manager.startServer(imported.id);

    expect(processManager.spawned[0]?.jarPath).toBe(path.resolve(jarPath));
    expect(processManager.spawned[0]?.workingDir).toBe(path.resolve(externalDir));
  });

  it('imports, reloads, and starts NeoForge args-file servers without a root jar', async () => {
    const argsFile = path.join(
      externalDir,
      'libraries',
      'net',
      'neoforged',
      'neoforge',
      '21.1.171',
      'win_args.txt'
    );
    const userJvmArgsFile = path.join(externalDir, 'user_jvm_args.txt');
    await fs.mkdir(path.dirname(argsFile), { recursive: true });
    await fs.writeFile(argsFile, '--launchTarget neoforgeserver\n');
    await fs.writeFile(userJvmArgsFile, '# custom JVM args\n');
    await fs.writeFile(
      path.join(externalDir, 'run.bat'),
      'java @user_jvm_args.txt @libraries/net/neoforged/neoforge/21.1.171/win_args.txt %*\r\n'
    );

    const imported = await manager.importExistingServer({
      directory: externalDir,
      name: 'Imported NeoForge Server',
      coreType: 'neoforge',
      mcVersion: '1.21.1',
      launchArgsFile: argsFile,
      userJvmArgsFile,
      javaPath: 'java',
    });

    const reloadedManager = new ServerManager({
      fileManager,
      importRegistry,
      importScanner: new ImportScanner(),
      processManager: processManager as never,
      defaultJavaPath: 'java',
    });
    await reloadedManager.loadServers();
    Object.assign(
      reloadedManager as unknown as { validateJava: (javaPath: string) => Promise<boolean> },
      { validateJava: async () => true }
    );

    await reloadedManager.startServer(imported.id);

    expect(processManager.spawned[0]?.jarPath).toBe(path.join(externalDir, 'server.jar'));
    expect(processManager.spawned[0]?.loaderArgsFile).toBe(
      path.join('libraries', 'net', 'neoforged', 'neoforge', '21.1.171', 'win_args.txt')
    );
    expect(processManager.spawned[0]?.userJvmArgsFile).toBe('user_jvm_args.txt');
    expect(processManager.spawned[0]?.workingDir).toBe(path.resolve(externalDir));
  });

  it('starts managed servers with a relative launch jar path inside the server directory', async () => {
    const created = await manager.createServer({
      name: 'Managed Server',
      coreType: 'vanilla',
      mcVersion: '1.20.6',
      javaPath: 'java',
    });

    await fs.writeFile(path.join(created.directory, 'server.jar'), '');

    Object.assign(
      manager as unknown as { validateJava: (javaPath: string) => Promise<boolean> },
      { validateJava: async () => true }
    );

    await manager.startServer(created.id);

    expect(processManager.spawned[0]?.jarPath).toBe(path.join(created.directory, 'server.jar'));
    expect(processManager.spawned[0]?.workingDir).toBe(created.directory);
  });

  it('rejects loader args files that escape the managed server directory', async () => {
    const created = await manager.createServer({
      name: 'Unsafe Loader Server',
      coreType: 'neoforge',
      mcVersion: '1.21.1',
      javaPath: 'java',
    });
    await fs.writeFile(path.join(created.directory, '..', 'outside_args.txt'), '--launchTarget neoforgeserver\n');
    await fs.writeFile(
      path.join(created.directory, 'loader-config.json'),
      JSON.stringify({ type: 'args-file', argsFile: '../outside_args.txt' })
    );
    Object.assign(
      manager as unknown as { validateJava: (javaPath: string) => Promise<boolean> },
      { validateJava: async () => true }
    );

    await expect(manager.startServer(created.id)).rejects.toThrow('Loader 啟動檔案不在伺服器目錄內');
    expect(processManager.spawned).toHaveLength(0);
  });
});
