import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';
import { ConnectionDiagnosticsService } from '../src/main/services/connection-diagnostics';

class FakeSocket extends EventEmitter {
  setTimeout(_timeout: number): this {
    return this;
  }

  destroy(): this {
    return this;
  }
}

function createService(options?: {
  lanIp?: string;
  listening?: boolean;
  publicIp?: string;
  publicIpError?: boolean;
  firewallStatus?: 'unknown' | 'allowed' | 'blocked' | 'warning';
}) {
  const lanIp = options?.lanIp;
  const listening = options?.listening ?? false;

  return new ConnectionDiagnosticsService({
    getNetworkInterfaces: () => ({
      Ethernet: lanIp
        ? [{ address: lanIp, family: 'IPv4', internal: false, netmask: '255.255.255.0', cidr: '192.168.0.2/24', mac: '00:00:00:00:00:00' }]
        : [],
    }),
    fetchPublicIpText: async () => {
      if (options?.publicIpError) {
        throw new Error('lookup failed');
      }

      return options?.publicIp ?? '203.0.113.10';
    },
    createConnection: (() => {
      const socket = new FakeSocket();
      queueMicrotask(() => {
        socket.emit(listening ? 'connect' : 'error');
      });
      return socket;
    }) as never,
    checkFirewallPort: async () => options?.firewallStatus ?? 'allowed',
  });
}

describe('ConnectionDiagnosticsService', () => {
  it('returns a pending warning when server.properties is unavailable', async () => {
    const service = createService();

    const info = await service.getConnectionInfo({
      serverId: 'server-1',
      status: 'stopped',
      hasServerProperties: false,
    });

    expect(info.port).toBeUndefined();
    expect(info.hasServerProperties).toBe(false);
    expect(info.diagnostics[0]?.code).toBe('PORT_NOT_LISTENING');
  });

  it('reports LAN, binding, and non-listening diagnostics for a running server', async () => {
    const service = createService({
      lanIp: '192.168.50.20',
      listening: false,
      publicIp: '198.51.100.25',
      firewallStatus: 'warning',
    });

    const info = await service.getConnectionInfo({
      serverId: 'server-2',
      status: 'running',
      hasServerProperties: true,
      serverPortRaw: '25565',
      serverIpRaw: '192.168.50.20',
    });

    expect(info.localhostAddress).toBe('localhost:25565');
    expect(info.lanAddress).toBe('192.168.50.20:25565');
    expect(info.isListeningOnPort).toBe(false);
    expect(info.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      'SERVER_IP_BOUND',
      'PORT_NOT_LISTENING',
      'WAN_REQUIRES_PORT_FORWARDING',
      'FIREWALL_MAY_BLOCK',
    ]));
  });

  it('adds public IP and CGNAT warnings without failing the whole result', async () => {
    const service = createService({
      lanIp: '192.168.1.12',
      listening: true,
      publicIp: '100.64.10.5',
      firewallStatus: 'allowed',
    });

    const info = await service.getConnectionInfo({
      serverId: 'server-3',
      status: 'running',
      hasServerProperties: true,
      serverPortRaw: '25565',
      serverIpRaw: '',
    });

    expect(info.publicIp).toBe('100.64.10.5');
    expect(info.diagnostics.some((item) => item.code === 'CGNAT_SUSPECTED')).toBe(true);
    expect(info.diagnostics.some((item) => item.code === 'FIREWALL_MAY_BLOCK')).toBe(false);
  });

  it('downgrades public IP lookup failure to a warning', async () => {
    const service = createService({
      lanIp: undefined,
      listening: true,
      publicIpError: true,
      firewallStatus: 'allowed',
    });

    const info = await service.getConnectionInfo({
      serverId: 'server-4',
      status: 'stopped',
      hasServerProperties: true,
      serverPortRaw: '25565',
      serverIpRaw: '',
    });

    expect(info.publicIp).toBeUndefined();
    expect(info.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      'LAN_IP_UNAVAILABLE',
      'SERVER_NOT_RUNNING',
      'PUBLIC_IP_UNAVAILABLE',
    ]));
  });
});
