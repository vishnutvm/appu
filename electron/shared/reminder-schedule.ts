/**
 * Pure reminder scheduling rules shared by the renderer (RemindersManager) and the
 * Electron main process (BackendReminderService) so both always agree.
 * Must not import Electron or DOM APIs.
 */

export type ReminderType = 'interval' | 'specific_time';
export type Recurrence = 'none' | 'interval' | 'daily' | 'weekly';

export interface ScheduleFields {
  type: ReminderType;
  intervalMinutes?: number | null;
  specificTime?: string | null; // "HH:mm"
  specificDate?: string | null; // "YYYY-MM-DD"
  recurrence?: string | null;
  nextTriggerAt?: number | null;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Older data (and the built-in presets) has no recurrence. "Every 45m" interval
 * reminders were always meant to repeat, and a time with no date means daily.
 */
export function normalizeRecurrence(fields: ScheduleFields): Recurrence {
  const r = fields.recurrence;
  if (r === 'none' || r === 'interval' || r === 'daily' || r === 'weekly') return r;
  if (fields.type === 'interval') return 'interval';
  return fields.specificDate ? 'none' : 'daily';
}

export function parseTime(timeStr: string | null | undefined): { hour: number; minute: number } | null {
  if (!timeStr) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function parseDate(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Local wall-clock time on a given date (DST-safe: built from calendar fields, not ms arithmetic). */
export function atLocalTime(dateStr: string, timeStr: string): number | null {
  const d = parseDate(dateStr);
  const t = parseTime(timeStr);
  if (!d || !t) return null;
  return new Date(d.year, d.month - 1, d.day, t.hour, t.minute, 0, 0).getTime();
}

/** Next occurrence of HH:mm strictly after `fromTime`. */
export function nextDailyTime(timeStr: string, fromTime: number): number {
  const t = parseTime(timeStr) ?? { hour: 9, minute: 0 };
  const from = new Date(fromTime);
  const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate(), t.hour, t.minute, 0, 0);
  while (candidate.getTime() <= fromTime) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

/** Next occurrence on the anchor date's weekday at HH:mm, strictly after `fromTime`. */
export function nextWeeklyTime(anchorDate: string, timeStr: string, fromTime: number): number {
  const d = parseDate(anchorDate);
  const t = parseTime(timeStr) ?? { hour: 9, minute: 0 };
  if (!d) return nextDailyTime(timeStr, fromTime);
  const candidate = new Date(d.year, d.month - 1, d.day, t.hour, t.minute, 0, 0);
  while (candidate.getTime() <= fromTime) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate.getTime();
}

/**
 * When a reminder should first fire. Returns null for a one-time date/time that is
 * already in the past (callers must reject it rather than fire immediately).
 */
export function computeInitialTrigger(fields: ScheduleFields, now: number = Date.now()): number | null {
  const recurrence = normalizeRecurrence(fields);

  if (fields.type === 'interval') {
    const minutes = Math.max(1, Number(fields.intervalMinutes) || 30);
    return now + minutes * MINUTE_MS;
  }

  const time = fields.specificTime || '09:00';
  if (recurrence === 'weekly' && fields.specificDate) {
    return nextWeeklyTime(fields.specificDate, time, now);
  }
  if (recurrence === 'daily' || !fields.specificDate) {
    return nextDailyTime(time, now);
  }

  const at = atLocalTime(fields.specificDate, time);
  if (at === null || at <= now) return null;
  return at;
}

/**
 * Schedule after a reminder fires. Interval reminders advance from their scheduled
 * slot (no drift); if the app was asleep they resume from now instead of firing a burst.
 */
export function computeAfterFire(
  fields: ScheduleFields,
  firedAt: number = Date.now()
): { enabled: boolean; nextTriggerAt: number } {
  const recurrence = normalizeRecurrence(fields);
  const scheduled = Number(fields.nextTriggerAt) || firedAt;

  if (fields.type === 'interval' && recurrence === 'interval') {
    const step = Math.max(1, Number(fields.intervalMinutes) || 30) * MINUTE_MS;
    let next = scheduled + step;
    if (next <= firedAt) next = firedAt + step;
    return { enabled: true, nextTriggerAt: next };
  }

  if (fields.type === 'specific_time' && recurrence === 'daily') {
    return { enabled: true, nextTriggerAt: nextDailyTime(fields.specificTime || '09:00', firedAt) };
  }

  if (fields.type === 'specific_time' && recurrence === 'weekly') {
    const anchor = fields.specificDate || toLocalDateString(scheduled);
    return { enabled: true, nextTriggerAt: nextWeeklyTime(anchor, fields.specificTime || '09:00', firedAt) };
  }

  return { enabled: false, nextTriggerAt: scheduled };
}

export function toLocalDateString(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toLocalTimeString(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const SCHEDULE_CONSTANTS = { MINUTE_MS, DAY_MS };
