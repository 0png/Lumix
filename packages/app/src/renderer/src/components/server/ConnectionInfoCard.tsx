import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Copy,
  Globe2,
  Info,
  Loader2,
  MonitorSmartphone,
  Network,
  RefreshCw,
  Router,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConnectionDiagnostic, ConnectionInfoDto } from '../../../../shared/ipc-types';

interface ConnectionInfoCardProps {
  serverId: string;
  serverStatus?: string;
  hasServerProperties?: boolean;
  embedded?: boolean;
}

function DiagnosticBadge({ diagnostic }: { diagnostic: ConnectionDiagnostic }) {
  const { t } = useTranslation();
  const variant = diagnostic.level === 'error'
    ? 'destructive'
    : diagnostic.level === 'warn'
      ? 'warning'
      : 'secondary';

  return (
    <div className="rounded-lg border border-border/60 bg-card/45 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">{t(`server.connection.diagnostics.${diagnostic.code}.title`)}</p>
        <Badge variant={variant}>{t(`server.connection.level.${diagnostic.level}`)}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{diagnostic.message}</p>
    </div>
  );
}

function AddressRow({
  label,
  value,
  helper,
  disabled = false,
  onCopy,
}: {
  label: string;
  value?: string;
  helper: string;
  disabled?: boolean;
  onCopy?: () => Promise<void> | void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border/60 bg-card/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 break-all font-mono text-sm">{value || '—'}</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={onCopy} disabled={disabled || !value}>
          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('server.connection.copy')}
        </Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

export function ConnectionInfoCard({
  serverId,
  serverStatus,
  hasServerProperties,
  embedded = false,
}: ConnectionInfoCardProps) {
  const { t } = useTranslation();
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfoDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadConnectionInfo = useCallback(async (refreshing: boolean = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await window.electronAPI.server.getConnectionInfo(serverId);
      if (!result.success || !result.data) {
        toast.error(t('toast.connectionInfoLoadFailed'));
        return;
      }

      setConnectionInfo(result.data);
    } catch {
      toast.error(t('toast.connectionInfoLoadFailed'));
    } finally {
      if (refreshing) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [serverId, t]);

  useEffect(() => {
    loadConnectionInfo().catch(() => {});
  }, [loadConnectionInfo]);

  useEffect(() => {
    if (isLoading) return;
    loadConnectionInfo(true).catch(() => {});
  }, [hasServerProperties, isLoading, loadConnectionInfo, serverStatus]);

  const copyValue = useCallback(async (value: string | undefined) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('toast.connectionAddressCopied'));
    } catch {
      toast.error(t('toast.connectionAddressCopyFailed'));
    }
  }, [t]);

  const cardContent = isLoading ? (
    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      {t('common.loading')}
    </div>
  ) : (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-3">
        <AddressRow
          label={t('server.connection.local.title')}
          value={connectionInfo?.localhostAddress}
          helper={t('server.connection.local.description')}
          disabled={!connectionInfo?.port}
          onCopy={() => copyValue(connectionInfo?.localhostAddress)}
        />
        <AddressRow
          label={t('server.connection.lan.title')}
          value={connectionInfo?.lanAddress}
          helper={connectionInfo?.lanAddress ? t('server.connection.lan.description') : t('server.connection.lan.unavailable')}
          disabled={!connectionInfo?.lanAddress}
          onCopy={() => copyValue(connectionInfo?.lanAddress)}
        />
        <div className="rounded-lg border border-border/60 bg-card/45 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('server.connection.wan.title')}
          </p>
          <p className="mt-1 break-all font-mono text-sm">{connectionInfo?.publicIp || '—'}</p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {t('server.connection.wan.description')}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('server.connection.statusTitle')}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {connectionInfo?.isRunning ? t('server.connection.running') : t('server.connection.stopped')}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {connectionInfo?.isListeningOnPort ? t('server.connection.listening') : t('server.connection.notListening')}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('server.connection.bindingTitle')}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {connectionInfo?.serverIp
              ? t('server.connection.boundToSpecificIp', { ip: connectionInfo.serverIp })
              : t('server.connection.boundToAllInterfaces')}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-2">
            <Router className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('server.connection.firewallTitle')}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t(`server.connection.firewall.${connectionInfo?.firewallStatus || 'unknown'}`)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border/70 bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p>{t('server.connection.help.sameDevice')}</p>
            <p>{t('server.connection.help.sameNetwork')}</p>
            <p>{t('server.connection.help.wan')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{t('server.connection.diagnosticsTitle')}</p>
        </div>
        <div className="grid gap-3">
          {connectionInfo?.diagnostics.map((diagnostic) => (
            <DiagnosticBadge key={`${diagnostic.code}-${diagnostic.level}`} diagnostic={diagnostic} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('server.connection.lastChecked', { value: connectionInfo?.checkedAt ? new Date(connectionInfo.checkedAt).toLocaleString() : '—' })}</span>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => loadConnectionInfo(true)} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          )}
          {t('server.connection.refresh')}
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return cardContent;
  }

  return (
    <Card className="glass">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Network className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t('server.connection.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {cardContent}
      </CardContent>
    </Card>
  );
}
