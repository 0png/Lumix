import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Cpu, MemoryStick } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { ServerStatus } from '../../../../shared/ipc-types';
import { useServerPerformance } from '@/hooks/use-server-performance';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TimeRange = '5m' | '15m' | '30m';

interface ServerPerformanceChartProps {
  serverId: string;
  status: ServerStatus;
}

interface ChartPoint {
  timestamp: number;
  cpu: number;
  memory: number;
}

const RANGE_MINUTES: Record<TimeRange, number> = { '5m': 5, '15m': 15, '30m': 30 };

function formatMemory(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

function PerformanceTooltip({ active, payload, label }: TooltipContentProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length || typeof label !== 'number') return null;

  const cpu = payload.find((item) => item.dataKey === 'cpu')?.value;
  const memory = payload.find((item) => item.dataKey === 'memory')?.value;

  return (
    <div className="server-performance-tooltip">
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">{formatTime(label)}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex min-w-40 items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t('server.performance.cpu')}
          </span>
          <span className="font-mono font-medium tabular-nums">{Number(cpu ?? 0).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            {t('server.performance.memory')}
          </span>
          <span className="font-mono font-medium tabular-nums">{formatMemory(Number(memory ?? 0))}</span>
        </div>
      </div>
    </div>
  );
}

export function ServerPerformanceChart({ serverId, status }: ServerPerformanceChartProps) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('30m');
  const { samples, loading } = useServerPerformance(serverId, status);
  const now = samples.at(-1) ? new Date(samples.at(-1)!.timestamp).getTime() : Date.now();
  const cutoff = now - RANGE_MINUTES[timeRange] * 60_000;

  const data = useMemo<ChartPoint[]>(() => samples
    .map((sample) => ({
      timestamp: new Date(sample.timestamp).getTime(),
      cpu: sample.cpuPercent,
      memory: sample.memoryBytes,
    }))
    .filter((sample) => sample.timestamp >= cutoff), [cutoff, samples]);

  const current = data.at(-1);
  const averages = useMemo(() => {
    if (!data.length) return { cpu: 0, memory: 0 };
    return data.reduce((total, point) => ({
      cpu: total.cpu + point.cpu / data.length,
      memory: total.memory + point.memory / data.length,
    }), { cpu: 0, memory: 0 });
  }, [data]);

  const isRunning = status === 'running';

  return (
    <section className="server-bento-tile server-performance-card xl:col-span-12" aria-labelledby="server-performance-title">
      <div className="server-performance-header">
        <div>
          <div className="server-bento-heading">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <h3 id="server-performance-title">{t('server.performance.title')}</h3>
            {isRunning ? <span className="server-performance-live">{t('server.performance.live')}</span> : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('server.performance.description')}</p>
        </div>

        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
          <SelectTrigger className="h-8 w-[132px] rounded-lg border-border/70 bg-transparent text-xs" aria-label={t('server.performance.rangeLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="5m" className="rounded-lg text-xs">{t('server.performance.last5Minutes')}</SelectItem>
            <SelectItem value="15m" className="rounded-lg text-xs">{t('server.performance.last15Minutes')}</SelectItem>
            <SelectItem value="30m" className="rounded-lg text-xs">{t('server.performance.last30Minutes')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="server-performance-stats" aria-live="polite">
        <div>
          <span className="server-performance-stat-icon bg-emerald-500/10 text-emerald-500"><Cpu className="h-3.5 w-3.5" /></span>
          <div><p>{t('server.performance.cpu')}</p><strong>{current ? `${current.cpu.toFixed(1)}%` : '—'}</strong></div>
          <span className="server-performance-average">
            {t('server.performance.average', { value: data.length ? `${averages.cpu.toFixed(1)}%` : '—' })}
          </span>
        </div>
        <div>
          <span className="server-performance-stat-icon bg-sky-500/10 text-sky-500"><MemoryStick className="h-3.5 w-3.5" /></span>
          <div><p>{t('server.performance.memory')}</p><strong>{current ? formatMemory(current.memory) : '—'}</strong></div>
          <span className="server-performance-average">
            {t('server.performance.average', { value: data.length ? formatMemory(averages.memory) : '—' })}
          </span>
        </div>
      </div>

      <div className="server-performance-chart" role="img" aria-label={t('server.performance.chartLabel')}>
        {!isRunning ? (
          <div className="server-performance-empty"><Activity className="h-5 w-5" /><p>{t('server.performance.stopped')}</p></div>
        ) : loading || data.length === 0 ? (
          <div className="server-performance-empty server-performance-loading"><Activity className="h-5 w-5" /><p>{t('server.performance.waiting')}</p></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`cpu-fill-${serverId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.46} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`memory-fill-${serverId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.42} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                minTickGap={52}
                tickFormatter={formatTime}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <YAxis yAxisId="cpu" domain={[0, 100]} hide />
              <YAxis yAxisId="memory" orientation="right" domain={[0, 'dataMax']} hide />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--foreground))', strokeOpacity: 0.12 }}
                content={(props) => <PerformanceTooltip {...props} />}
              />
              <Area
                yAxisId="memory"
                dataKey="memory"
                type="monotone"
                fill={`url(#memory-fill-${serverId})`}
                stroke="#38bdf8"
                strokeWidth={1.35}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, fill: '#0ea5e9', stroke: 'hsl(var(--background))' }}
                isAnimationActive={false}
              />
              <Area
                yAxisId="cpu"
                dataKey="cpu"
                type="monotone"
                fill={`url(#cpu-fill-${serverId})`}
                stroke="#34d399"
                strokeWidth={1.35}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, fill: '#10b981', stroke: 'hsl(var(--background))' }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="server-performance-legend" aria-hidden="true">
        <span><i className="bg-emerald-400" />{t('server.performance.cpu')}</span>
        <span><i className="bg-sky-400" />{t('server.performance.memory')}</span>
      </div>
    </section>
  );
}
