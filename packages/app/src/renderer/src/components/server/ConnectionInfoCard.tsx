import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  Copy,
  Globe2,
  Info,
  Loader2,
  MonitorSmartphone,
  Network,
  RefreshCw,
  Router,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConnectionDiagnostic, ConnectionInfoDto } from '../../../../shared/ipc-types';

type ConnectionAppearance = 'default' | 'bento';
type CopyTarget = 'local' | 'lan';

interface ConnectionInfoCardProps {
  serverId: string;
  serverStatus?: string;
  hasServerProperties?: boolean;
  embedded?: boolean;
  appearance?: ConnectionAppearance;
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

function BentoAddressRow({
  label,
  value,
  helper,
  disabled,
  copied,
  onCopy,
}: {
  label: string;
  value?: string;
  helper: string;
  disabled?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="server-address-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 break-all font-mono text-sm font-medium text-foreground/90">{value || '—'}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="server-copy-button server-bento-pressable h-8 min-w-[76px] shrink-0 px-2 text-[11px]"
          data-copied={copied}
          onClick={onCopy}
          disabled={disabled || !value}
          aria-label={`${t('server.connection.copy')} ${label}`}
        >
          <span className="server-copy-content">
            <span data-copy-layer="idle">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {t('server.connection.copy')}
            </span>
            <span data-copy-layer="copied">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {t('server.connection.copied')}
            </span>
          </span>
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

function BentoStatusRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MonitorSmartphone;
  title: string;
  description: string;
}) {
  return (
    <div className="server-connection-status-row">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground/85">{title}</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function ConnectionInfoCard({
  serverId,
  serverStatus,
  hasServerProperties,
  embedded = false,
  appearance = 'default',
}: ConnectionInfoCardProps) {
  const { t } = useTranslation();
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfoDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshKeyRef = useRef(`${serverStatus}:${String(hasServerProperties)}`);

  const loadConnectionInfo = useCallback(async (refreshing: boolean = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setLoadError(false);
    }

    try {
      const result = await window.electronAPI.server.getConnectionInfo(serverId);
      if (!result.success || !result.data) {
        if (!refreshing) setLoadError(true);
        toast.add({ title: t('toast.connectionInfoLoadFailed'), type: 'error' });
        return;
      }

      setConnectionInfo(result.data);
      setLoadError(false);
    } catch {
      if (!refreshing) setLoadError(true);
      toast.add({ title: t('toast.connectionInfoLoadFailed'), type: 'error' });
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
    const refreshKey = `${serverStatus}:${String(hasServerProperties)}`;
    if (refreshKeyRef.current === refreshKey) return;
    refreshKeyRef.current = refreshKey;
    loadConnectionInfo(true).catch(() => {});
  }, [hasServerProperties, loadConnectionInfo, serverStatus]);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  const copyValue = useCallback(async (value: string | undefined, target: CopyTarget) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      if (appearance === 'bento') {
        if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
        setCopiedTarget(target);
        copyResetTimer.current = setTimeout(() => setCopiedTarget(null), 1400);
      } else {
        toast.add({ title: t('toast.connectionAddressCopied'), type: 'success' });
      }
    } catch {
      toast.add({ title: t('toast.connectionAddressCopyFailed'), type: 'error' });
    }
  }, [appearance, t]);

  if (appearance === 'bento') {
    return (
      <section className="server-bento-tile flex min-h-0 flex-col xl:col-span-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="server-bento-heading">
              <Network className="h-4 w-4" aria-hidden="true" />
              <h3>{t('server.connection.title')}</h3>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              {t('server.connection.bentoDescription')}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="server-bento-pressable h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => loadConnectionInfo(true)}
            disabled={isLoading || isRefreshing}
            aria-label={t('server.connection.refresh')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          </Button>
        </div>

        {isLoading ? (
          <div className="server-connection-skeleton mt-5" aria-label={t('common.loading')} role="status">
            <div /><div /><div /><div />
          </div>
        ) : loadError && !connectionInfo ? (
          <div className="server-connection-error mt-5">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{t('server.connection.unavailableTitle')}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {t('server.connection.unavailableDescription')}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="server-bento-pressable h-8 shrink-0 text-xs"
              onClick={() => loadConnectionInfo(false)}
            >
              {t('server.connection.retry')}
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-0 overflow-hidden rounded-[10px] bg-[hsl(var(--server-bento-inset))] sm:grid-cols-2 sm:divide-x sm:divide-border/45">
              <BentoAddressRow
                label={t('server.connection.local.title')}
                value={connectionInfo?.localhostAddress}
                helper={t('server.connection.local.description')}
                disabled={!connectionInfo?.port}
                copied={copiedTarget === 'local'}
                onCopy={() => copyValue(connectionInfo?.localhostAddress, 'local')}
              />
              <BentoAddressRow
                label={t('server.connection.lan.title')}
                value={connectionInfo?.lanAddress}
                helper={connectionInfo?.lanAddress
                  ? t('server.connection.lan.description')
                  : t('server.connection.lan.unavailable')}
                disabled={!connectionInfo?.lanAddress}
                copied={copiedTarget === 'lan'}
                onCopy={() => copyValue(connectionInfo?.lanAddress, 'lan')}
              />
            </div>

            <div className="mt-3 flex items-start gap-3 border-b border-border/45 px-1 pb-4">
              <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {t('server.connection.wan.title')}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-foreground/85">{connectionInfo?.publicIp || '—'}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  {t('server.connection.wan.description')}
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/45">
              <BentoStatusRow
                icon={MonitorSmartphone}
                title={t('server.connection.statusTitle')}
                description={`${connectionInfo?.isRunning ? t('server.connection.running') : t('server.connection.stopped')} ${connectionInfo?.isListeningOnPort ? t('server.connection.listening') : t('server.connection.notListening')}`}
              />
              <BentoStatusRow
                icon={Network}
                title={t('server.connection.bindingTitle')}
                description={connectionInfo?.serverIp
                  ? t('server.connection.boundToSpecificIp', { ip: connectionInfo.serverIp })
                  : t('server.connection.boundToAllInterfaces')}
              />
              <BentoStatusRow
                icon={Router}
                title={t('server.connection.firewallTitle')}
                description={t(`server.connection.firewall.${connectionInfo?.firewallStatus || 'unknown'}`)}
              />
            </div>

            {connectionInfo?.diagnostics.length ? (
              <div className="mt-2 border-t border-border/45 pt-3">
                <div className="mb-1 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs font-medium text-foreground/80">{t('server.connection.diagnosticsTitle')}</p>
                </div>
                <div className="divide-y divide-border/40">
                  {connectionInfo.diagnostics.map((diagnostic) => (
                    <div key={`${diagnostic.code}-${diagnostic.level}`} className="server-diagnostic-row" data-level={diagnostic.level}>
                      <span className="server-diagnostic-dot" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-foreground/80">
                            {t(`server.connection.diagnostics.${diagnostic.code}.title`)}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {t(`server.connection.level.${diagnostic.level}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{diagnostic.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-auto flex items-center gap-2 border-t border-border/45 pt-3 text-[10px] text-muted-foreground">
              <Globe2 className="h-3 w-3" aria-hidden="true" />
              <span>{t('server.connection.lastChecked', {
                value: connectionInfo?.checkedAt ? new Date(connectionInfo.checkedAt).toLocaleString() : '—',
              })}</span>
            </div>
          </>
        )}
      </section>
    );
  }

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
          onCopy={() => copyValue(connectionInfo?.localhostAddress, 'local')}
        />
        <AddressRow
          label={t('server.connection.lan.title')}
          value={connectionInfo?.lanAddress}
          helper={connectionInfo?.lanAddress ? t('server.connection.lan.description') : t('server.connection.lan.unavailable')}
          disabled={!connectionInfo?.lanAddress}
          onCopy={() => copyValue(connectionInfo?.lanAddress, 'lan')}
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
