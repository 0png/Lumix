import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileManager } from '../src/main/services/file-manager';

describe('FileManager runtime script', () => {
  let rootDir: string;
  let serverDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-run-bat-'));
    serverDir = path.join(rootDir, 'server');
    await fs.mkdir(serverDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('preserves JVM arguments with spaces and keeps loader args after user args', async () => {
    await new FileManager(rootDir).writeRunBat(serverDir, {
      javaPath: 'C:\\Program Files\\Java\\bin\\java.exe',
      ramMin: 2048,
      ramMax: 4096,
      jvmArgs: ['-Dmessage=hello world', '-XX:+UseG1GC'],
      loaderArgsFile: 'libraries\\net\\loader args.txt',
      userJvmArgsFile: 'user jvm args.txt',
    });

    const content = await fs.readFile(path.join(serverDir, 'run.bat'), 'utf-8');
    expect(content).toContain('"C:\\Program Files\\Java\\bin\\java.exe"');
    expect(content).toContain('"-Dmessage=hello world"');
    expect(content.indexOf('@user jvm args.txt')).toBeLessThan(content.indexOf('@libraries\\net\\loader args.txt'));
    expect(content).not.toContain(' -jar ');
  });
});
