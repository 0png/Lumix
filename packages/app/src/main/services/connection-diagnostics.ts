import { execFile as execFileCallback } from 'child_process';
import net from 'net';
import os from 'os';
import { promisify } from 'util';
import type { ConnectionDiagnostic, ConnectionInfoDto, ServerStatus } from '../../shared/ipc-types';
import { fetchText } from './http-client';

const execFile = promisify(execFileCallback);
const DEFAULT_PUBLIC_IP_URL = 'https://api.ipify.org';
const PUBLIC_IP_TIMEOUT_MS = 2000;
const PORT_CHECK_TIMEOUT_MS = 750;
const FIREWALL_TIMEOUT_MS = 2000;

interface ConnectionDiagnosticsOptions {
  getNetworkInterfaces?: typeof os.networkInterfaces;
  fetchPublicIpText?: (url: string) => Promise<string>;
  createConnection?: typeof net.createConnection;
  checkFirewallPort?: (port: number) => Promise<'unknown' | 'allowed' | 'blocked' | 'warning'>;
}

export interface ConnectionDiagnosticsInput {
  serverId: string;
  status: ServerStatus;
  hasServerProperties: boolean;
  serverPortRaw?: string;
  serverIpRaw?: string;
}

export class ConnectionDiagnosticsService {
  private readonly getNetworkInterfaces: typeof os.networkInterfaces;
  private readonly fetchPublicIpText: (url: string) => Promise<string>;
  private readonly createConnection: typeof net.createConnection;
  private readonly checkFirewallPortImpl: (port: number) => Promise<'unknown' | 'allowed' | 'blocked' | 'warning'>;

  constructor(options: ConnectionDiagnosticsOptions = {}) {
    this.getNetworkInterfaces = options.getNetworkInterfaces ?? (() => os.networkInterfaces());
    this.fetchPublicIpText = options.fetchPublicIpText ?? ((url: string) => fetchText(url));
    this.createConnection = options.createConnection ?? net.createConnection;
    this.checkFirewallPortImpl = options.checkFirewallPort ?? this.checkFirewallPort;
  }

  async getConnectionInfo(input: ConnectionDiagnosticsInput): Promise<ConnectionInfoDto> {
    const checkedAt = new Date().toISOString();
    const diagnostics: ConnectionDiagnostic[] = [];
    const serverIp = normalizeServerIp(input.serverIpRaw);
    const port = parsePort(input.serverPortRaw);
    const isRunning = input.status === 'running';
    const localhostAddress = port ? `localhost:${port}` : undefined;
    const lanIp = this.pickLanIpv4();
    const lanAddress = port && lanIp ? `${lanIp}:${port}` : undefined;

    let isListeningOnPort = false;
    let publicIp: string | undefined;
    let firewallStatus: ConnectionInfoDto['firewallStatus'] = 'unknown';

    if (!input.hasServerProperties || !port) {
      diagnostics.push({
        level: 'warn',
        code: 'PORT_NOT_LISTENING',
        message: 'Lumix 目前還讀不到 server.properties 內的連接埠，請先確認伺服器已生成設定檔。',
      });

      return {
        serverId: input.serverId,
        port,
        serverIp,
        localhostAddress,
        lanAddress,
        publicIp,
        isRunning,
        isListeningOnPort,
        diagnostics,
        checkedAt,
        hasServerProperties: input.hasServerProperties,
        firewallStatus,
      };
    }

    isListeningOnPort = await this.checkPortListening(port);

    if (!lanIp) {
      diagnostics.push({
        level: 'warn',
        code: 'LAN_IP_UNAVAILABLE',
        message: 'Lumix 目前找不到可用的區域網路 IPv4 位址。',
      });
    }

    if (serverIp) {
      diagnostics.push({
        level: 'warn',
        code: 'SERVER_IP_BOUND',
        message: '此伺服器綁定了特定 IP，可能影響 localhost 或 LAN 的連線方式。',
      });
    }

    if (!isRunning) {
      diagnostics.push({
        level: 'warn',
        code: 'SERVER_NOT_RUNNING',
        message: '伺服器目前未運行，其他玩家暫時無法連入。',
      });
    } else if (!isListeningOnPort) {
      diagnostics.push({
        level: 'error',
        code: 'PORT_NOT_LISTENING',
        message: '伺服器看起來正在運行，但本機尚未在設定的連接埠上接受連線。',
      });
    }

    diagnostics.push({
      level: 'info',
      code: 'WAN_REQUIRES_PORT_FORWARDING',
      message: '外網連線通常仍需要路由器做 port forwarding，Lumix 無法自動完成這一步。',
    });

    const [publicIpResult, firewallResult] = await Promise.allSettled([
      this.lookupPublicIp(),
      this.checkFirewallPortImpl(port),
    ]);

    if (publicIpResult.status === 'fulfilled') {
      publicIp = publicIpResult.value;
      if (publicIp && isCgnatOrNonPublicIpv4(publicIp)) {
        diagnostics.push({
          level: 'warn',
          code: 'CGNAT_SUSPECTED',
          message: '目前偵測到的 public IP 看起來不像一般公網 IPv4，外網連線可能受 ISP 或 CGNAT 影響。',
        });
      }
    } else {
      diagnostics.push({
        level: 'warn',
        code: 'PUBLIC_IP_UNAVAILABLE',
        message: 'Lumix 這次無法取得 public IP，但這不代表伺服器一定無法從外網連入。',
      });
    }

    if (firewallResult.status === 'fulfilled') {
      firewallStatus = firewallResult.value;
      if (firewallStatus !== 'allowed' && isRunning) {
        diagnostics.push({
          level: 'warn',
          code: 'FIREWALL_MAY_BLOCK',
          message: 'Windows 防火牆可能仍會阻擋外部裝置連到這個連接埠，請手動確認 inbound 規則。',
        });
      }
    } else if (isRunning) {
      firewallStatus = 'warning';
      diagnostics.push({
        level: 'warn',
        code: 'FIREWALL_MAY_BLOCK',
        message: 'Lumix 這次無法確認 Windows 防火牆規則，外部連線仍可能被系統防火牆擋下。',
      });
    }

    return {
      serverId: input.serverId,
      port,
      serverIp,
      localhostAddress,
      lanAddress,
      publicIp,
      isRunning,
      isListeningOnPort,
      diagnostics,
      checkedAt,
      hasServerProperties: input.hasServerProperties,
      firewallStatus,
    };
  }

  private pickLanIpv4(): string | undefined {
    const interfaces = this.getNetworkInterfaces();

    for (const addresses of Object.values(interfaces)) {
      for (const info of addresses ?? []) {
        if (info.family !== 'IPv4' || info.internal) {
          continue;
        }

        if (isApipaIpv4(info.address)) {
          continue;
        }

        if (isPrivateIpv4(info.address)) {
          return info.address;
        }
      }
    }

    for (const addresses of Object.values(interfaces)) {
      for (const info of addresses ?? []) {
        if (info.family === 'IPv4' && !info.internal && !isApipaIpv4(info.address)) {
          return info.address;
        }
      }
    }

    return undefined;
  }

  private async checkPortListening(port: number): Promise<boolean> {
    await Promise.resolve();

    return new Promise<boolean>((resolve) => {
      const socket = this.createConnection({ host: '127.0.0.1', port });
      let settled = false;

      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(value);
      };

      socket.setTimeout(PORT_CHECK_TIMEOUT_MS);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
  }

  private async lookupPublicIp(): Promise<string | undefined> {
    const response = await withTimeout(
      this.fetchPublicIpText(DEFAULT_PUBLIC_IP_URL),
      PUBLIC_IP_TIMEOUT_MS,
      'public-ip-timeout'
    );
    const trimmed = response.trim();
    return isIpv4(trimmed) ? trimmed : undefined;
  }

  private async checkFirewallPort(port: number): Promise<'unknown' | 'allowed' | 'blocked' | 'warning'> {
    if (process.platform !== 'win32') {
      return 'unknown';
    }

    const script = [
      `$port = ${port}`,
      `$rule = Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -ErrorAction Stop | Get-NetFirewallPortFilter | Where-Object { $_.Protocol -eq 'TCP' -and $_.LocalPort -eq $port } | Select-Object -First 1`,
      'if ($rule) { Write-Output "allowed" } else { Write-Output "warning" }',
    ].join('; ');

    try {
      const result = await withTimeout(
        execFile('powershell.exe', ['-NoProfile', '-Command', script], {
          windowsHide: true,
        }),
        FIREWALL_TIMEOUT_MS,
        'firewall-timeout'
      );
      const status = result.stdout.trim().toLowerCase();
      return status === 'allowed' ? 'allowed' : 'warning';
    } catch {
      return 'warning';
    }
  }
}

function normalizeServerIp(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(value?: string): number | undefined {
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}

function isIpv4(value: string): boolean {
  return net.isIP(value) === 4;
}

function isApipaIpv4(value: string): boolean {
  return value.startsWith('169.254.');
}

function isPrivateIpv4(value: string): boolean {
  const [a = Number.NaN, b = Number.NaN] = value.split('.').map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isCgnatOrNonPublicIpv4(value: string): boolean {
  if (!isIpv4(value)) {
    return false;
  }

  const [a = Number.NaN, b = Number.NaN] = value.split('.').map(Number);

  return (
    isPrivateIpv4(value) ||
    value.startsWith('127.') ||
    value.startsWith('0.') ||
    value.startsWith('169.254.') ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(reason));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
