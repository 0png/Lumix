import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModpackService, resolveSafeDestination } from '../src/main/services/modpack-service';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

describe('ModpackService', () => {
  it('scans a Modrinth pack and applies server overrides after shared overrides', async () => {
    const workspace = await createTemporaryDirectory();
    const archivePath = path.join(workspace, 'example.mrpack');
    const targetDir = path.join(workspace, 'server');
    await fs.mkdir(targetDir);

    await writeStoredZip(archivePath, {
      'modrinth.index.json': JSON.stringify({
        formatVersion: 1,
        game: 'minecraft',
        versionId: '1.0.0',
        name: 'Example Pack',
        dependencies: {
          minecraft: '1.20.1',
          'fabric-loader': '0.15.11',
        },
        files: [
          {
            path: 'mods/client-only.jar',
            hashes: {},
            env: { client: 'required', server: 'unsupported' },
            downloads: ['https://example.invalid/client-only.jar'],
          },
        ],
      }),
      'overrides/config/example.toml': 'source = "shared"\n',
      'server-overrides/config/example.toml': 'source = "server"\n',
      'server-overrides/kubejs/server_scripts/example.js': 'console.log("server")\n',
      'overrides/server.json': '{"malicious":true}',
    });

    const service = new ModpackService();
    const candidate = await service.scan(archivePath);

    expect(candidate).toMatchObject({
      format: 'modrinth',
      name: 'Example Pack',
      mcVersion: '1.20.1',
      coreType: 'fabric',
      loaderVersion: '0.15.11',
      clientOnlyFiles: 1,
      canInstall: true,
    });
    expect(candidate.content.configs).toBe(2);
    expect(candidate.content.scripts).toBe(1);
    expect(candidate.warnings.some((warning) => warning.code === 'reservedFiles')).toBe(true);

    const result = await service.install(archivePath, targetDir);
    expect(result.skippedClientOnlyFiles).toBe(1);
    expect(await fs.readFile(path.join(targetDir, 'config', 'example.toml'), 'utf-8')).toBe('source = "server"\n');
    expect(await fs.readFile(path.join(targetDir, 'kubejs', 'server_scripts', 'example.js'), 'utf-8')).toContain('server');
    await expect(fs.access(path.join(targetDir, 'server.json'))).rejects.toThrow();
  });

  it('reports unresolved CurseForge manifest files while still discovering bundled config', async () => {
    const workspace = await createTemporaryDirectory();
    const archivePath = path.join(workspace, 'curseforge.zip');
    await writeStoredZip(archivePath, {
      'manifest.json': JSON.stringify({
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        name: 'Curse Pack',
        version: '2.0',
        overrides: 'overrides',
        minecraft: {
          version: '1.19.2',
          modLoaders: [{ id: 'forge-43.3.0', primary: true }],
        },
        files: [{ projectID: 1, fileID: 2, required: true }],
      }),
      'overrides/config/server-config.toml': 'enabled = true\n',
      'overrides/defaultconfigs/world-config.toml': 'difficulty = "normal"\n',
    });

    const candidate = await new ModpackService().scan(archivePath);
    expect(candidate).toMatchObject({
      format: 'curseforge',
      coreType: 'forge',
      loaderVersion: '43.3.0',
      unresolvedFiles: 1,
      canInstall: false,
    });
    expect(candidate.content.configs).toBe(2);
  });

  it('rejects paths that escape the server directory', () => {
    expect(() => resolveSafeDestination('C:\\servers\\example', '..\\other\\file.jar')).toThrow('不安全的路徑');
    expect(() => resolveSafeDestination('C:\\servers\\example', 'mods/safe.jar')).not.toThrow();
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lumix-modpack-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeStoredZip(filePath: string, entries: Record<string, string>): Promise<void> {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [entryName, value] of Object.entries(entries)) {
    const name = Buffer.from(entryName.replace(/\\/g, '/'));
    const data = Buffer.from(value);
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, name, data);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(centralParts.length / 2, 8);
  endRecord.writeUInt16LE(centralParts.length / 2, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);

  await fs.writeFile(filePath, Buffer.concat([...localParts, centralDirectory, endRecord]));
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
