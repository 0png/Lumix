import { describe, expect, it } from 'vitest';
import {
  calculateNextBackupRun,
  createBackupId,
  normalizeBackupSettings,
  withNextBackupRun,
} from '../src/shared/backup-utils';

function localDateParts(date: Date): [number, number, number, number, number] {
  return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()];
}

describe('backup-utils', () => {
  it('normalizes invalid backup settings to safe defaults', () => {
    const settings = normalizeBackupSettings({
      enabled: true,
      scheduleType: 'bad' as never,
      time: '99',
      dayOfWeek: 99,
      intervalHours: -3,
      intervalMinutes: 2,
      includeLogs: 1 as never,
    });

    expect(settings).toMatchObject({
      enabled: true,
      scheduleType: 'daily',
      time: '03:00',
      dayOfWeek: 6,
      intervalHours: 1,
      intervalMinutes: 5,
      includeLogs: true,
      notifyOps: true,
    });
  });

  it('normalizes regular and pre-restore retention independently', () => {
    expect(normalizeBackupSettings({ regularRetention: 0, preRestoreRetention: 99 }))
      .toMatchObject({ regularRetention: 1, preRestoreRetention: 50 });
    expect(normalizeBackupSettings({ regularRetention: '7' as never, preRestoreRetention: '2' as never }))
      .toMatchObject({ regularRetention: 7, preRestoreRetention: 2 });
  });

  it('schedules daily backups later on the same day when possible', () => {
    const nextRun = calculateNextBackupRun(
      normalizeBackupSettings({ enabled: true, scheduleType: 'daily', time: '15:30' }),
      new Date(2026, 4, 15, 8, 0, 0)
    );

    expect(localDateParts(nextRun)).toEqual([2026, 4, 15, 15, 30]);
  });

  it('moves daily backups to tomorrow when the configured time has passed', () => {
    const nextRun = calculateNextBackupRun(
      normalizeBackupSettings({ enabled: true, scheduleType: 'daily', time: '03:00' }),
      new Date(2026, 4, 15, 8, 0, 0)
    );

    expect(localDateParts(nextRun)).toEqual([2026, 4, 16, 3, 0]);
  });

  it('schedules weekly backups on the selected weekday', () => {
    const nextRun = calculateNextBackupRun(
      normalizeBackupSettings({ enabled: true, scheduleType: 'weekly', time: '04:00', dayOfWeek: 1 }),
      new Date(2026, 4, 15, 8, 0, 0)
    );

    expect(localDateParts(nextRun)).toEqual([2026, 4, 18, 4, 0]);
  });

  it('schedules hourly backups from the last run time', () => {
    const nextRun = calculateNextBackupRun(
      normalizeBackupSettings({
        enabled: true,
        scheduleType: 'hourly',
        intervalHours: 6,
        time: '00:15',
        lastRunAt: new Date(2026, 4, 15, 1, 0, 0).toISOString(),
      }),
      new Date(2026, 4, 15, 8, 0, 0)
    );

    expect(localDateParts(nextRun)).toEqual([2026, 4, 15, 13, 15]);
  });

  it('schedules running-only backups by minute interval', () => {
    const nextRun = calculateNextBackupRun(
      normalizeBackupSettings({
        enabled: true,
        scheduleType: 'while-running',
        intervalMinutes: 15,
        lastRunAt: new Date(2026, 4, 15, 8, 0, 0).toISOString(),
      }),
      new Date(2026, 4, 15, 8, 20, 0)
    );

    expect(localDateParts(nextRun)).toEqual([2026, 4, 15, 8, 30]);
  });

  it('adds nextRunAt only when automatic backups are enabled', () => {
    expect(withNextBackupRun(normalizeBackupSettings({ enabled: false })).nextRunAt).toBeUndefined();

    const enabled = withNextBackupRun(
      normalizeBackupSettings({ enabled: true, scheduleType: 'daily', time: '10:00' }),
      new Date(2026, 4, 15, 8, 0, 0)
    );
    expect(localDateParts(new Date(enabled.nextRunAt!))).toEqual([2026, 4, 15, 10, 0]);
  });

  it('creates file-system friendly backup ids', () => {
    expect(createBackupId('2026-05-15T08:09:10.123Z')).toBe('2026-05-15T08-09-10-123Z');
  });
});
