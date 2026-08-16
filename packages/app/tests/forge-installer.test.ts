import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'child_process';
import { runNeoForgeInstaller } from '../src/main/services/forge-installer';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

class FakeInstallerProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe('NeoForge installer setup', () => {
  const createdDirectories: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(createdDirectories.splice(0).map((directory) => (
      fs.rm(directory, { recursive: true, force: true })
    )));
  });

  it('records args-file launch metadata after the installer completes', async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-neoforge-installer-'));
    createdDirectories.push(targetDir);
    const relativeArgsFile = path.join(
      'libraries',
      'net',
      'neoforged',
      'neoforge',
      '21.1.171',
      'win_args.txt'
    );
    const installerPath = path.join(targetDir, 'neoforge-installer.jar');
    await fs.mkdir(path.dirname(path.join(targetDir, relativeArgsFile)), { recursive: true });
    await fs.writeFile(installerPath, 'installer');
    await fs.writeFile(path.join(targetDir, relativeArgsFile), '--launchTarget neoforgeserver\n');
    await fs.writeFile(
      path.join(targetDir, 'run.bat'),
      `java @user_jvm_args.txt @${relativeArgsFile} %*\r\n`
    );

    const process = new FakeInstallerProcess();
    vi.mocked(spawn).mockImplementation(() => {
      queueMicrotask(() => process.emit('close', 0));
      return process as never;
    });

    await runNeoForgeInstaller(installerPath, targetDir, 'C:\\Java\\bin\\java.exe');

    expect(spawn).toHaveBeenCalledWith(
      'C:\\Java\\bin\\java.exe',
      ['-jar', installerPath, '--installServer'],
      expect.objectContaining({ cwd: targetDir })
    );
    await expect(fs.readFile(path.join(targetDir, 'loader-config.json'), 'utf-8')).resolves.toContain(
      '"loader": "neoforge"'
    );
    await expect(fs.readFile(path.join(targetDir, 'user_jvm_args.txt'), 'utf-8')).resolves.toContain(
      'custom JVM arguments'
    );
    await expect(fs.access(path.join(targetDir, 'server.jar'))).rejects.toThrow();
    await expect(fs.access(installerPath)).rejects.toThrow();
  });
});
