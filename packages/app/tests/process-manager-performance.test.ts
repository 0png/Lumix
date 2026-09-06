import { availableParallelism } from 'os';
import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pidusage: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('pidusage', () => ({
  default: Object.assign(mocks.pidusage, { clear: mocks.clear }),
}));

import { ProcessManager } from '../src/main/services/process-manager';
import type { ServerPerformanceSample } from '../src/shared/ipc-types';

interface TestableProcessManager extends EventEmitter {
  processes: Map<string, { serverId: string; process: FakeProcess; startedAt: Date }>;
  performanceTimers: Map<string, NodeJS.Timeout>;
  capturePerformanceSample: (serverId: string, process: FakeProcess) => Promise<void>;
  getPerformanceHistory: (serverId: string) => ServerPerformanceSample[];
}

interface FakeProcess {
  pid: number;
  exitCode: number | null;
  signalCode: string | null;
}

describe('ProcessManager performance sampling', () => {
  let manager: TestableProcessManager;
  let process: FakeProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ProcessManager() as unknown as TestableProcessManager;
    process = { pid: 2468, exitCode: null, signalCode: null };
    manager.processes.set('server-1', { serverId: 'server-1', process, startedAt: new Date() });
    const timer = setInterval(() => undefined, 60_000);
    timer.unref();
    manager.performanceTimers.set('server-1', timer);
  });

  it('normalizes multi-core CPU and emits RSS memory samples', async () => {
    mocks.pidusage.mockResolvedValue({
      cpu: availableParallelism() * 42.5,
      memory: 1_610_612_736,
      timestamp: 1_700_000_000_000,
    });
    const samples: ServerPerformanceSample[] = [];
    manager.on('performance-sample', (sample) => samples.push(sample));

    await manager.capturePerformanceSample('server-1', process);

    expect(samples).toEqual([{
      serverId: 'server-1',
      timestamp: new Date(1_700_000_000_000).toISOString(),
      cpuPercent: 42.5,
      memoryBytes: 1_610_612_736,
    }]);
    expect(manager.getPerformanceHistory('server-1')).toEqual(samples);
    clearInterval(manager.performanceTimers.get('server-1'));
  });

  it('drops a late sample after monitoring has stopped', async () => {
    mocks.pidusage.mockResolvedValue({ cpu: 10, memory: 1024, timestamp: Date.now() });
    clearInterval(manager.performanceTimers.get('server-1'));
    manager.performanceTimers.delete('server-1');

    await manager.capturePerformanceSample('server-1', process);

    expect(manager.getPerformanceHistory('server-1')).toEqual([]);
  });
});
