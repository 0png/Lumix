import { useEffect, useState } from 'react';
import type { ServerPerformanceSample, ServerStatus } from '../../../shared/ipc-types';

const MAX_SAMPLES = 360;

function mergeSamples(
  current: ServerPerformanceSample[],
  incoming: ServerPerformanceSample[]
): ServerPerformanceSample[] {
  const byTimestamp = new Map(current.map((sample) => [sample.timestamp, sample]));
  incoming.forEach((sample) => byTimestamp.set(sample.timestamp, sample));
  return Array.from(byTimestamp.values())
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-MAX_SAMPLES);
}

export function useServerPerformance(serverId: string, status: ServerStatus) {
  const [samples, setSamples] = useState<ServerPerformanceSample[]>([]);
  const [loading, setLoading] = useState(status === 'running');

  useEffect(() => {
    let active = true;
    setSamples([]);
    setLoading(status === 'running');

    if (status !== 'running') return undefined;

    const unsubscribe = window.electronAPI.server.onPerformanceSample((sample) => {
      if (sample.serverId !== serverId || !active) return;
      setSamples((current) => mergeSamples(current, [sample]));
      setLoading(false);
    });

    void window.electronAPI.server.getPerformanceHistory(serverId).then((result) => {
      if (!active) return;
      if (result.success && result.data) {
        setSamples((current) => mergeSamples(current, result.data!));
      }
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [serverId, status]);

  return { samples, loading };
}
