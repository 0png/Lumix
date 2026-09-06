import { promises as fs } from 'fs';
import path from 'path';

export interface ManagedServerLocation {
  id: string;
  directory: string;
}

interface ManagedServerRegistryFile {
  schemaVersion: 1;
  servers: ManagedServerLocation[];
}

/**
 * Registry for managed servers. A managed server can live outside the current
 * default root after the user changes the storage setting, so discovery must
 * not depend on a single folder.
 */
export class ManagedServerRegistry {
  private readonly registryPath: string;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(basePath: string) {
    this.registryPath = path.join(basePath, 'managed-servers.json');
  }

  async list(): Promise<ManagedServerLocation[]> {
    return this.enqueue(async () => {
      const file = await this.read();
      return file.servers.map((server) => ({
        id: server.id,
        directory: path.resolve(server.directory),
      }));
    });
  }

  async save(location: ManagedServerLocation): Promise<void> {
    return this.enqueue(async () => {
      const file = await this.read();
      const next = file.servers.filter((item) => item.id !== location.id);
      next.push({ id: location.id, directory: path.resolve(location.directory) });
      await this.write({ schemaVersion: 1, servers: next });
    });
  }

  async delete(id: string): Promise<void> {
    return this.enqueue(async () => {
      const file = await this.read();
      await this.write({ schemaVersion: 1, servers: file.servers.filter((item) => item.id !== id) });
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(operation, operation);
    this.operationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async read(): Promise<ManagedServerRegistryFile> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.registryPath, 'utf-8')) as Partial<ManagedServerRegistryFile>;
      const servers = Array.isArray(parsed.servers)
        ? parsed.servers.filter(isLocation).map((server) => ({
          id: server.id,
          directory: path.resolve(server.directory),
        }))
        : [];
      return { schemaVersion: 1, servers };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { schemaVersion: 1, servers: [] };
      }
      console.warn(`[ManagedServerRegistry] Unable to read registry: ${formatError(error)}`);
      return { schemaVersion: 1, servers: [] };
    }
  }

  private async write(file: ManagedServerRegistryFile): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    const temporaryPath = `${this.registryPath}.${process.pid}.${Date.now()}.tmp`;
    const backupPath = `${this.registryPath}.bak`;
    let movedExisting = false;
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, 'utf-8');

      // Windows does not replace an existing destination with rename(). Move
      // the old file aside first, then restore it if the final rename fails.
      await fs.rm(backupPath, { force: true });
      try {
        await fs.rename(this.registryPath, backupPath);
        movedExisting = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }

      await fs.rename(temporaryPath, this.registryPath);
      if (movedExisting) {
        await fs.rm(backupPath, { force: true });
      }
    } catch (error) {
      if (movedExisting) {
        await fs.rename(backupPath, this.registryPath).catch(() => undefined);
      }
      throw error;
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      if (!movedExisting) {
        await fs.rm(backupPath, { force: true }).catch(() => undefined);
      }
    }
  }
}

function isLocation(value: unknown): value is ManagedServerLocation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ManagedServerLocation>;
  return typeof item.id === 'string' && item.id.length > 0
    && typeof item.directory === 'string' && path.isAbsolute(item.directory);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
