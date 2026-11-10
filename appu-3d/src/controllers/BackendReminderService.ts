import { AppuReminder, ReminderRecurrenceType } from '../types/reminders';

export const REMINDERS_STORAGE_KEY = 'appu_companion_reminders';
export const REMINDERS_DELETED_KEY = 'appu_companion_reminders_deleted';

/** Legacy / partially-shaped rows that may appear in older localStorage payloads. */
export type LegacyReminderRow = Partial<AppuReminder> & {
  id?: string;
  title?: string;
  /** Old absolute due timestamp (ms or seconds). */
  due?: number;
  dueAt?: number;
  time?: string;
  interval?: number;
  date?: string;
  status?: string;
};

export class PastReminderTimeError extends Error {
  constructor(message = 'Cannot schedule a reminder in the past.') {
    super(message);
    this.name = 'PastReminderTimeError';
  }
}

export interface CreateReminderInput {
  title: string;
  type: ReminderRecurrenceType;
  intervalMinutes?: number;
  specificTime?: string;
  specificDate?: string;
  now?: number;
}

/**
 * Persistence + validation layer for companion reminders.
 * Keeps deleted IDs so a later sync cannot resurrect removed rows,
 * migrates legacy shapes, and rejects one-shot times that are already past.
 */
export class BackendReminderService {
  private reminders: AppuReminder[] = [];
  private deletedIds: Set<string> = new Set();
  private storage: Storage | null;

  constructor(storage?: Storage | null) {
    this.storage =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : null;
    this.loadDeletedIds();
    this.sync();
  }

  /** Reload from storage, migrate legacy rows, and drop any deleted IDs. */
  public sync(): AppuReminder[] {
    const hadStoredKey =
      this.storage != null && this.storage.getItem(REMINDERS_STORAGE_KEY) !== null;
    const raw = this.readRawRows();
    const migrated = raw
      .map((row) => this.migrateRow(row))
      .filter((r): r is AppuReminder => r !== null);
    this.reminders = migrated.filter((r) => !this.deletedIds.has(r.id));
    // Avoid writing an empty array on first launch so callers can still seed defaults.
    if (hadStoredKey || this.reminders.length > 0) {
      this.persistReminders();
    }
    return this.getReminders();
  }

  public getReminders(): AppuReminder[] {
    return this.reminders.map((r) => ({ ...r }));
  }

  public createReminder(input: CreateReminderInput): AppuReminder {
    const now = input.now ?? Date.now();
    const title = input.title.trim() || 'Reminder';
    const nextTriggerAt = this.calculateNextTrigger(input, now);

    if (input.type === 'specific_time' && input.specificDate) {
      if (nextTriggerAt <= now) {
        throw new PastReminderTimeError();
      }
    }

    const reminder: AppuReminder = {
      id: `rem_${now}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      type: input.type,
      intervalMinutes: input.intervalMinutes,
      specificTime: input.specificTime,
      specificDate: input.specificDate,
      nextTriggerAt,
      enabled: true,
      createdAt: now,
    };

    this.deletedIds.delete(reminder.id);
    this.persistDeletedIds();
    this.reminders.unshift(reminder);
    this.persistReminders();
    return { ...reminder };
  }

  public deleteReminder(id: string): void {
    this.reminders = this.reminders.filter((r) => r.id !== id);
    this.deletedIds.add(id);
    this.persistReminders();
    this.persistDeletedIds();
  }

  public replaceAll(reminders: AppuReminder[]): void {
    this.reminders = reminders
      .filter((r) => !this.deletedIds.has(r.id))
      .map((r) => ({ ...r }));
    this.persistReminders();
  }

  public calculateNextTrigger(
    params: {
      type: ReminderRecurrenceType;
      intervalMinutes?: number;
      specificTime?: string;
      specificDate?: string;
    },
    fromTime: number = Date.now()
  ): number {
    if (params.type === 'interval' && params.intervalMinutes) {
      return fromTime + Math.max(1, params.intervalMinutes) * 60 * 1000;
    }

    if (params.type === 'specific_time' && params.specificTime) {
      if (params.specificDate) {
        const [year, month, day] = params.specificDate.split('-').map(Number);
        const [hour, minute] = params.specificTime.split(':').map(Number);
        const target = new Date(year, month - 1, day, hour, minute, 0, 0);
        return target.getTime();
      }
      return this.calculateNextDailyTime(params.specificTime, fromTime);
    }

    return fromTime + 30 * 60 * 1000;
  }

  public migrateRow(row: LegacyReminderRow): AppuReminder | null {
    if (!row || typeof row !== 'object') return null;

    const id =
      typeof row.id === 'string' && row.id.length > 0
        ? row.id
        : `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (this.deletedIds.has(id)) return null;

    const title = (row.title ?? 'Reminder').toString().trim() || 'Reminder';
    const createdAt = typeof row.createdAt === 'number' ? row.createdAt : Date.now();
    const enabled = row.enabled !== false && row.status !== 'cancelled' && row.status !== 'completed';

    let type: ReminderRecurrenceType =
      row.type === 'specific_time' || row.type === 'interval' ? row.type : 'interval';
    let intervalMinutes = row.intervalMinutes ?? row.interval;
    let specificTime = row.specificTime ?? row.time;
    let specificDate = row.specificDate ?? row.date;
    let nextTriggerAt = row.nextTriggerAt;

    const legacyDue = row.dueAt ?? row.due;
    if (nextTriggerAt == null && typeof legacyDue === 'number') {
      // Support accidental seconds-since-epoch values from older stores.
      nextTriggerAt = legacyDue < 1e12 ? legacyDue * 1000 : legacyDue;
      type = 'specific_time';
    }

    if (type === 'interval' && !intervalMinutes && !specificTime) {
      intervalMinutes = 30;
    }

    if (type === 'specific_time' && !specificTime && nextTriggerAt != null) {
      const d = new Date(nextTriggerAt);
      specificTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      specificDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    if (nextTriggerAt == null) {
      nextTriggerAt = this.calculateNextTrigger(
        { type, intervalMinutes, specificTime, specificDate },
        createdAt
      );
    }

    return {
      id,
      title,
      type,
      intervalMinutes,
      specificTime,
      specificDate,
      nextTriggerAt,
      lastTriggeredAt: row.lastTriggeredAt,
      enabled,
      createdAt,
    };
  }

  private calculateNextDailyTime(timeStr: string, fromTime: number): number {
    const [hour, minute] = timeStr.split(':').map(Number);
    const now = new Date(fromTime);
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (candidate.getTime() <= fromTime) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.getTime();
  }

  private readRawRows(): LegacyReminderRow[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(REMINDERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persistReminders(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(this.reminders));
    } catch (e) {
      console.warn('Failed to save reminders:', e);
    }
  }

  private loadDeletedIds(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(REMINDERS_DELETED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.deletedIds = new Set(parsed.filter((id) => typeof id === 'string'));
      }
    } catch {
      this.deletedIds = new Set();
    }
  }

  private persistDeletedIds(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(REMINDERS_DELETED_KEY, JSON.stringify([...this.deletedIds]));
    } catch (e) {
      console.warn('Failed to save deleted reminder ids:', e);
    }
  }
}
