import type { BackupSettings } from './ipc-types';

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: false,
  scheduleType: 'daily',
  time: '03:00',
  dayOfWeek: 0,
  intervalHours: 6,
  intervalMinutes: 30,
  includeLogs: false,
  notifyOps: true,
};

export function normalizeBackupSettings(settings?: Partial<BackupSettings>): BackupSettings {
  const merged = { ...DEFAULT_BACKUP_SETTINGS, ...settings };
  const validSchedule = ['hourly', 'daily', 'weekly', 'while-running'].includes(merged.scheduleType)
    ? merged.scheduleType
    : DEFAULT_BACKUP_SETTINGS.scheduleType;
  const time = /^\d{2}:\d{2}$/.test(merged.time) ? merged.time : DEFAULT_BACKUP_SETTINGS.time;
  const intervalHours = Math.min(24, Math.max(1, Number(merged.intervalHours) || 6));
  const intervalMinutes = Math.min(1440, Math.max(5, Number(merged.intervalMinutes) || 30));
  const dayOfWeek = Math.min(6, Math.max(0, Number(merged.dayOfWeek) || 0));

  return {
    ...merged,
    scheduleType: validSchedule,
    time,
    intervalHours,
    intervalMinutes,
    dayOfWeek,
    enabled: Boolean(merged.enabled),
    includeLogs: Boolean(merged.includeLogs),
    notifyOps: merged.notifyOps !== false,
  };
}

export function withNextBackupRun(settings: BackupSettings, now: Date = new Date()): BackupSettings {
  if (!settings.enabled) {
    return { ...settings, nextRunAt: undefined };
  }

  return {
    ...settings,
    nextRunAt: calculateNextBackupRun(settings, now).toISOString(),
  };
}

export function calculateNextBackupRun(settings: BackupSettings, now: Date = new Date()): Date {
  const [hourRaw, minuteRaw] = settings.time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (settings.scheduleType === 'while-running') {
    const intervalMinutes = settings.intervalMinutes ?? DEFAULT_BACKUP_SETTINGS.intervalMinutes ?? 30;
    const base = settings.lastRunAt ? new Date(settings.lastRunAt) : now;
    const next = new Date(base.getTime() + intervalMinutes * 60 * 1000);
    if (next <= now) {
      const missed = Math.floor((now.getTime() - next.getTime()) / (intervalMinutes * 60 * 1000)) + 1;
      next.setMinutes(next.getMinutes() + missed * intervalMinutes);
    }
    return next;
  }

  if (settings.scheduleType === 'hourly') {
    const intervalHours = settings.intervalHours ?? DEFAULT_BACKUP_SETTINGS.intervalHours ?? 6;
    const base = settings.lastRunAt ? new Date(settings.lastRunAt) : now;
    const next = new Date(base);
    next.setHours(next.getHours() + intervalHours, minute, 0, 0);
    if (next <= now) {
      const missed = Math.floor((now.getTime() - next.getTime()) / (intervalHours * 60 * 60 * 1000)) + 1;
      next.setHours(next.getHours() + missed * intervalHours);
    }
    return next;
  }

  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (settings.scheduleType === 'weekly') {
    const targetDay = settings.dayOfWeek ?? 0;
    const dayOffset = (targetDay - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + dayOffset);
    if (next <= now) next.setDate(next.getDate() + 7);
    return next;
  }

  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

export function createBackupId(createdAt: string): string {
  return createdAt.replace(/[:.]/g, '-');
}
