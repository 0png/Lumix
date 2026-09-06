import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Crown, RefreshCcw, Shield, ShieldOff, UserRound, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import type { PlayerActionType, PlayerDto, ServerStatus } from '../../../../shared/ipc-types';

interface PlayerManagementProps {
  serverId: string;
  status: ServerStatus;
}

const REFRESH_INTERVAL_MS = 10000;

function getAvatarUrl(uuid?: string): string | undefined {
  return uuid ? `https://crafthead.net/helm/${uuid.replace(/-/g, '')}/64.png` : undefined;
}

function PlayerAvatar({ player }: { player: PlayerDto }) {
  const avatarUrl = getAvatarUrl(player.uuid);

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-secondary">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover [image-rendering:pixelated]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

export function PlayerManagement({ serverId, status }: PlayerManagementProps) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyPlayer, setBusyPlayer] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const isRunning = status === 'running';

  const loadPlayers = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await window.electronAPI.server.getPlayers(serverId);
      if (result.success && result.data) {
        setPlayers(result.data);
      } else {
        toast.add({ title: t('toast.playersLoadFailed'), description: result.error, type: 'error' });
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [serverId, t]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(loadPlayers, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isRunning, loadPlayers]);

  const handleAction = async (playerName: string, action: PlayerActionType) => {
    setBusyPlayer(`${playerName}:${action}`);
    try {
      const result = await window.electronAPI.server.playerAction({ serverId, playerName, action });
      if (result.success) {
        toast.add({ title: t('toast.playerActionSent'), type: 'success' });
        window.setTimeout(loadPlayers, 800);
      } else {
        toast.add({ title: t('toast.playerActionFailed'), description: result.error, type: 'error' });
      }
    } finally {
      setBusyPlayer(null);
    }
  };

  const onlineCount = players.filter((player) => player.online).length;

  return (
    <Card className="glass animate-fade-in-up">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('players.title')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('players.description')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPlayers}
          disabled={loading}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
          {t('players.refresh')}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant={isRunning ? 'success' : 'ghost'}>
            {isRunning ? t('players.live') : t('players.offline')}
          </Badge>
          <Badge variant="secondary">
            {t('players.onlineCount', { count: onlineCount })}
          </Badge>
          <Badge variant="outline">
            {t('players.knownCount', { count: players.length })}
          </Badge>
        </div>

        {players.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-secondary/20 px-4 py-8 text-center">
            <p className="text-sm font-medium">{t('players.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRunning ? t('players.emptyRunning') : t('players.emptyStopped')}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-3">
            <div className="grid gap-2 lg:grid-cols-2">
              {players.map((player) => (
                <div
                  key={`${player.name}-${player.uuid ?? 'unknown'}`}
                  className="rounded-lg border border-border/60 bg-card/65 p-3"
                >
                  <div className="flex items-start gap-3">
                    <PlayerAvatar player={player} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{player.name}</p>
                        <Badge variant={player.online ? 'success' : 'ghost'} className="text-[10px]">
                          {player.online ? t('players.online') : t('players.notOnline')}
                        </Badge>
                        {player.isOp && (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <Crown className="h-3 w-3" aria-hidden="true" />
                            OP
                          </Badge>
                        )}
                        {player.isBanned && (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <Ban className="h-3 w-3" aria-hidden="true" />
                            {t('players.banned')}
                          </Badge>
                        )}
                        {player.isWhitelisted && (
                          <Badge variant="outline" className="text-[10px]">
                            {t('players.whitelisted')}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground" title={player.uuid}>
                        {player.uuid ?? t('players.uuidPending')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!isRunning || busyPlayer !== null}
                      onClick={() => handleAction(player.name, player.isOp ? 'deop' : 'op')}
                      className="h-7 text-xs"
                    >
                      <Crown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {player.isOp ? t('players.deop') : t('players.op')}
                    </Button>
                    <Button
                      variant={player.isBanned ? 'outline' : 'destructive'}
                      size="sm"
                      disabled={!isRunning || busyPlayer !== null}
                      onClick={() => handleAction(player.name, player.isBanned ? 'pardon' : 'ban')}
                      className="h-7 text-xs"
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {player.isBanned ? t('players.pardon') : t('players.ban')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isRunning || busyPlayer !== null || !player.online}
                      onClick={() => handleAction(player.name, 'kick')}
                      className="h-7 text-xs"
                    >
                      <UserX className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {t('players.kick')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isRunning || busyPlayer !== null}
                      onClick={() => handleAction(player.name, player.isWhitelisted ? 'whitelist-remove' : 'whitelist-add')}
                      className="h-7 text-xs"
                    >
                      <ShieldOff className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {player.isWhitelisted ? t('players.whitelistRemove') : t('players.whitelistAdd')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
