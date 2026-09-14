import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { fetchJson } from '../src/main/services/http-client';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe('HTTP response decoding', () => {
  it('preserves UTF-8 characters split across response chunks', async () => {
    const body = Buffer.from(JSON.stringify({ text: '備份保留控制' }), 'utf8');
    const splitAt = body.indexOf(Buffer.from('備', 'utf8')) + 1;
    const server = createServer((_, response) => {
      response.writeHead(200, {
        'Content-Length': body.length,
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.flushHeaders();
      response.write(body.subarray(0, splitAt));
      setTimeout(() => response.end(body.subarray(splitAt)), 10);
    });
    servers.push(server);

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');

    await expect(fetchJson<{ text: string }>(`http://127.0.0.1:${address.port}`)).resolves.toEqual({
      text: '備份保留控制',
    });
  });
});
