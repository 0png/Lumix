import { afterEach, describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { ImportScanner } from '../src/main/services/import-scanner';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('ImportScanner', () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(createdDirs.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
  });

  it('prefers obvious launch jars and detects paper-style folders', async () => {
    const directory = await createTempDir('lumix-import-paper-');
    createdDirs.push(directory);
    await fs.mkdir(path.join(directory, 'plugins'));
    await fs.mkdir(path.join(directory, 'world'));
    await fs.writeFile(path.join(directory, 'paper-1.20.4-123.jar'), '');
    await fs.writeFile(path.join(directory, 'server.properties'), 'server-port=25565\n', 'utf-8');
    await fs.writeFile(path.join(directory, 'eula.txt'), 'eula=true\n', 'utf-8');

    const scanner = new ImportScanner();
    const candidate = await scanner.scan(directory);

    expect(candidate.detectedCoreType).toBe('paper');
    expect(candidate.detectedMcVersion).toBe('1.20.4');
    expect(candidate.serverJarPath).toBe(path.join(directory, 'paper-1.20.4-123.jar'));
    expect(candidate.hasPluginsFolder).toBe(true);
    expect(candidate.hasWorldData).toBe(true);
    expect(candidate.eulaAccepted).toBe(true);
  });

  it('detects fabric launch jars before generic jars', async () => {
    const directory = await createTempDir('lumix-import-fabric-');
    createdDirs.push(directory);
    await fs.mkdir(path.join(directory, 'mods'));
    await fs.writeFile(path.join(directory, 'fabric-server-launch.jar'), '');
    await fs.writeFile(path.join(directory, 'server.jar'), '');

    const scanner = new ImportScanner();
    const candidate = await scanner.scan(directory);

    expect(candidate.detectedCoreType).toBe('fabric');
    expect(candidate.serverJarPath).toBe(path.join(directory, 'fabric-server-launch.jar'));
    expect(candidate.hasModsFolder).toBe(true);
  });

  it('warns when no usable jar is present', async () => {
    const directory = await createTempDir('lumix-import-empty-');
    createdDirs.push(directory);
    await fs.mkdir(path.join(directory, 'world'));

    const scanner = new ImportScanner();
    const candidate = await scanner.scan(directory);

    expect(candidate.serverJarPath).toBeUndefined();
    expect(candidate.warnings.some((warning) => warning.includes('server jar'))).toBe(true);
  });

  it('does not auto-detect spigot as a supported import core', async () => {
    const directory = await createTempDir('lumix-import-spigot-');
    createdDirs.push(directory);
    await fs.writeFile(path.join(directory, 'spigot-1.20.4.jar'), '');

    const scanner = new ImportScanner();
    const candidate = await scanner.scan(directory);

    expect(candidate.detectedCoreType).toBeUndefined();
    expect(candidate.warnings.some((warning) => warning.includes('Spigot core'))).toBe(true);
  });

  it('parses eula=false as not accepted', async () => {
    const directory = await createTempDir('lumix-import-eula-');
    createdDirs.push(directory);
    await fs.writeFile(path.join(directory, 'server.jar'), '');
    await fs.writeFile(path.join(directory, 'eula.txt'), 'eula=false\n', 'utf-8');

    const scanner = new ImportScanner();
    const candidate = await scanner.scan(directory);

    expect(candidate.hasEula).toBe(true);
    expect(candidate.eulaAccepted).toBe(false);
  });
});
