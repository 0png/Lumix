import { promises as fs } from 'fs';
import path from 'path';
import type { ServerMetadata } from './file-manager';

interface ImportRegistryFile {
  servers: ImportedServerRecord[];
}

export interface ImportedServerRecord extends ServerMetadata {
  origin: 'imported';
  directory: string;
}

export class ImportRegistry {
  private registryPath: string;

  constructor(basePath: string) {
    this.registryPath = path.join(basePath, 'imported-servers.json');
  }

  async list(): Promise<ImportedServerRecord[]> {
    const file = await this.readRegistry();
    return file.servers.map((server) => ({
      ...server,
      origin: 'imported',
      directory: path.resolve(server.directory),
    }));
  }

  async save(server: ImportedServerRecord): Promise<void> {
    const file = await this.readRegistry();
    const nextServers = file.servers.filter((item) => item.id !== server.id);
    nextServers.push({
      ...server,
      origin: 'imported',
      directory: path.resolve(server.directory),
    });
    await this.writeRegistry({ servers: nextServers });
  }

  async delete(id: string): Promise<void> {
    const file = await this.readRegistry();
    await this.writeRegistry({ servers: file.servers.filter((server) => server.id !== id) });
  }

  private async readRegistry(): Promise<ImportRegistryFile> {
    try {
      const raw = await fs.readFile(this.registryPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ImportRegistryFile>;
      return {
        servers: Array.isArray(parsed.servers) ? parsed.servers as ImportedServerRecord[] : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { servers: [] };
      }
      throw error;
    }
  }

  private async writeRegistry(file: ImportRegistryFile): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify(file, null, 2), 'utf-8');
  }
}
