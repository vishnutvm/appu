import { BrowserWindow, Notification, shell } from 'electron';
import { ReminderRepository } from '../database/repositories/reminder-repository';
import { ReminderRecord } from '../database/schema';
import {
  computeAfterFire,
  computeInitialTrigger,
  normalizeRecurrence,
  parseDate,
  parseTime,
  toLocalDateString,
  toLocalTimeString,
  ScheduleFields,
} from '../shared/reminder-schedule';

export class ReminderValidationError extends Error {}

const toFields = (r: ReminderRecord): ScheduleFields => ({
  type: r.type,
  intervalMinutes: r.interval_minutes,
  specificTime: r.specific_time,
  specificDate: r.specific_date,
  recurrence: r.recurrence,
  nextTriggerAt: r.next_trigger_at,
});

export class BackendReminderService {
  private static instance: BackendReminderService | null = null;
  private timer: NodeJS.Timeout | null = null;
  private getWindow: () => BrowserWindow | null;
  private onShowWindow?: () => void;
  /** Reminders only fire once the renderer has registered its trigger listener. */
  private rendererReady = false;
  /** IDs deleted recently, so a stale full-list sync from the renderer cannot resurrect them. */
  private recentlyDeleted = new Map<string, number>();

  constructor(
    private reminderRepo: ReminderRepository,
    getWindow: () => BrowserWindow | null,
    onShowWindow?: () => void
  ) {
    this.getWindow = getWindow;
    this.onShowWindow = onShowWindow;
    this.normalizeLegacyRows();
    this.startScheduler();
  }

  public setRendererReady(ready: boolean): void {
    this.rendererReady = ready;
  }

  /** Rows written before `recurrence` existed: interval reminders repeat, dateless times are daily. */
  private normalizeLegacyRows(): void {
    try {
      for (const r of this.reminderRepo.getAll()) {
        if (!r.recurrence) {
          this.reminderRepo.update(r.id, { recurrence: normalizeRecurrence(toFields(r)) });
        }
      }
    } catch (err) {
      console.warn('Reminder normalization failed:', err);
    }
  }

  public static getInstance(
    reminderRepo?: ReminderRepository,
    getWindow?: () => BrowserWindow | null,
    onShowWindow?: () => void
  ): BackendReminderService {
    if (!BackendReminderService.instance) {
      if (!reminderRepo || !getWindow) {
        throw new Error('BackendReminderService requires reminderRepo and getWindow');
      }
      BackendReminderService.instance = new BackendReminderService(reminderRepo, getWindow, onShowWindow);
    }
    return BackendReminderService.instance;
  }

  public startScheduler(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.checkPendingReminders();
    }, 3000);
  }

  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public checkPendingReminders(): void {
    if (!this.rendererReady) return;
    const now = Date.now();
    const pending = this.reminderRepo.getPending(now);

    for (const reminder of pending) {
      this.triggerReminder(reminder);
      this.rescheduleOrComplete(reminder.id);
      break; // Trigger one at a time to prevent overlapping notification bubbles
    }
  }

  public triggerReminder(reminder: ReminderRecord): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) {
      if (!win.isVisible()) {
        try {
          win.showInactive();
          win.setFullScreenable(false);
          win.setAlwaysOnTop(true, 'screen-saver', 1);
          win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } catch {}
      }

      win.webContents.send('trigger-reminder', {
        id: reminder.id,
        title: reminder.title,
        message: reminder.description || undefined,
        actionText: 'Done',
        intervalMinutes: reminder.interval_minutes || undefined,
        specificTime: reminder.specific_time || undefined,
        type: reminder.type,
        recurrence: reminder.recurrence || undefined,
      });
    }

    // Audible alert on macOS
    try {
      shell.beep();
    } catch {}

    // Native OS notification as fallback/enhancement
    if (Notification.isSupported()) {
      try {
        const notif = new Notification({
          title: `Appu Reminder: ${reminder.title}`,
          body: reminder.description || 'Time for your scheduled reminder!',
          silent: false,
        });

        notif.on('click', () => {
          if (this.onShowWindow) {
            this.onShowWindow();
          }
          if (win && !win.isDestroyed()) {
            if (!win.isVisible()) {
              win.show();
              win.setFullScreenable(false);
              win.setAlwaysOnTop(true, 'screen-saver', 1);
              win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
              win.webContents.send('appu-visibility-changed', true);
            }
            try {
              win.focus();
            } catch {}
          }
        });

        notif.show();
      } catch (err) {
        // Notification failure fallback
      }
    }
  }

  /**
   * Create a reminder from AI tool arguments. Throws ReminderValidationError for
   * requests that cannot be scheduled (past one-time times, missing schedule).
   */
  public createReminder(params: {
    title: string;
    description?: string;
    scheduledAt?: number | string; // Unix ms or ISO string
    timezone?: string;
    recurrence?: string; // 'none' | 'daily' | 'interval' | 'weekly'
    recurrenceInterval?: number;
    recurrenceUnit?: string; // 'minutes' | 'hours' | 'days' | 'weeks'
    intervalMinutes?: number;
    specificTime?: string; // "HH:mm"
    specificDate?: string; // "YYYY-MM-DD"
  }): ReminderRecord {
    const now = Date.now();

    let scheduledAt: number | null = null;
    if (params.scheduledAt !== undefined && params.scheduledAt !== null && params.scheduledAt !== '') {
      const asNumber = Number(params.scheduledAt);
      const parsed = Number.isFinite(asNumber) && asNumber > 1e11 ? asNumber : new Date(String(params.scheduledAt)).getTime();
      if (!Number.isFinite(parsed)) {
        throw new ReminderValidationError(`Could not understand the time "${params.scheduledAt}".`);
      }
      scheduledAt = parsed;
    }

    const unit = String(params.recurrenceUnit || '').toLowerCase();
    const count = Math.max(1, Math.round(Number(params.recurrenceInterval) || 0)) || 1;
    const unitMinutes =
      unit.startsWith('min') ? 1 : unit.startsWith('hour') ? 60 : unit.startsWith('day') ? 24 * 60 : unit.startsWith('week') ? 7 * 24 * 60 : 0;
    let recurrence = String(params.recurrence || 'none').toLowerCase();
    if (!['none', 'daily', 'interval', 'weekly'].includes(recurrence)) recurrence = 'none';
    if (recurrence === 'none' && unitMinutes && params.recurrenceInterval) {
      // "in 10 minutes" with no repeat: one-shot relative timer
      scheduledAt = scheduledAt ?? now + count * unitMinutes * 60 * 1000;
    }
    if (recurrence === 'interval' && unit.startsWith('day') && count === 1) recurrence = 'daily';
    if (recurrence === 'interval' && unit.startsWith('week') && count === 1) recurrence = 'weekly';

    const time = params.specificTime || (scheduledAt !== null ? toLocalTimeString(scheduledAt) : undefined);
    const date = params.specificDate || (scheduledAt !== null ? toLocalDateString(scheduledAt) : undefined);
    if (time && !parseTime(time)) throw new ReminderValidationError(`Invalid time "${time}" (expected HH:mm).`);
    if (date && !parseDate(date)) throw new ReminderValidationError(`Invalid date "${date}" (expected YYYY-MM-DD).`);

    let type: 'interval' | 'specific_time';
    let intervalMinutes: number | null = null;
    let specificTime: string | null = null;
    let specificDate: string | null = null;
    let nextTriggerAt: number;

    if (recurrence === 'interval') {
      const minutes = Number(params.intervalMinutes) || (unitMinutes ? count * unitMinutes : count);
      type = 'interval';
      intervalMinutes = Math.max(1, Math.round(minutes));
      nextTriggerAt = scheduledAt !== null && scheduledAt > now ? scheduledAt : now + intervalMinutes * 60 * 1000;
    } else if (recurrence === 'daily') {
      if (!time) throw new ReminderValidationError('A daily reminder needs a time of day.');
      type = 'specific_time';
      specificTime = time;
      nextTriggerAt = scheduledAt !== null && scheduledAt > now ? scheduledAt : computeInitialTrigger({ type, specificTime, recurrence: 'daily' }, now)!;
    } else if (recurrence === 'weekly') {
      if (!time) throw new ReminderValidationError('A weekly reminder needs a day and time.');
      type = 'specific_time';
      specificTime = time;
      specificDate = date || toLocalDateString(now);
      nextTriggerAt = computeInitialTrigger({ type, specificTime, specificDate, recurrence: 'weekly' }, now)!;
    } else if (scheduledAt !== null) {
      if (scheduledAt <= now) {
        throw new ReminderValidationError(`That time (${new Date(scheduledAt).toLocaleString()}) is already in the past.`);
      }
      type = 'specific_time';
      specificTime = time ?? toLocalTimeString(scheduledAt);
      specificDate = date ?? toLocalDateString(scheduledAt);
      nextTriggerAt = scheduledAt;
    } else if (params.intervalMinutes) {
      type = 'interval';
      intervalMinutes = Math.max(1, Math.round(Number(params.intervalMinutes)));
      nextTriggerAt = now + intervalMinutes * 60 * 1000;
    } else if (time) {
      const at = computeInitialTrigger({ type: 'specific_time', specificTime: time, specificDate: date, recurrence: 'none' }, now);
      if (at === null) throw new ReminderValidationError('That time is already in the past.');
      type = 'specific_time';
      specificTime = time;
      specificDate = date ?? toLocalDateString(at);
      nextTriggerAt = at;
    } else {
      throw new ReminderValidationError('Please give a time, date, or interval for the reminder.');
    }

    const record: ReminderRecord = {
      id: `rem_${now}_${Math.random().toString(36).substring(2, 7)}`,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      type,
      interval_minutes: intervalMinutes,
      specific_time: specificTime,
      specific_date: specificDate,
      next_trigger_at: nextTriggerAt,
      last_triggered_at: null,
      enabled: 1,
      created_at: now,
      timezone: params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      recurrence,
      recurrence_interval: recurrence === 'interval' ? count : null,
      recurrence_unit: recurrence === 'interval' ? unit || 'minutes' : null,
    };

    this.reminderRepo.insert(record);
    this.notifyRendererRemindersChanged();
    return record;
  }

  public listReminders(options?: {
    date?: string;
    status?: 'active' | 'completed' | 'all';
    limit?: number;
  }): ReminderRecord[] {
    const all = this.reminderRepo.getAll();
    let filtered = all;

    if (options?.date) {
      filtered = this.reminderRepo.getByDate(options.date);
    }

    if (options?.status === 'active') {
      filtered = filtered.filter((r) => r.enabled === 1);
    } else if (options?.status === 'completed') {
      filtered = filtered.filter((r) => r.enabled === 0);
    }

    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  public updateReminder(
    id: string,
    updates: Partial<ReminderRecord>
  ): ReminderRecord | null {
    const current = this.reminderRepo.getById(id);
    if (!current) return null;

    const allowed: Partial<ReminderRecord> = {};
    for (const key of ['title', 'description', 'interval_minutes', 'specific_time', 'specific_date', 'enabled', 'recurrence'] as const) {
      if ((updates as any)[key] !== undefined) (allowed as any)[key] = (updates as any)[key];
    }
    if (allowed.specific_time && !parseTime(allowed.specific_time)) {
      throw new ReminderValidationError(`Invalid time "${allowed.specific_time}" (expected HH:mm).`);
    }
    if (allowed.specific_date && !parseDate(allowed.specific_date)) {
      throw new ReminderValidationError(`Invalid date "${allowed.specific_date}" (expected YYYY-MM-DD).`);
    }
    if (allowed.enabled !== undefined) allowed.enabled = allowed.enabled ? 1 : 0;
    if (allowed.interval_minutes !== undefined && allowed.interval_minutes !== null) {
      allowed.interval_minutes = Math.max(1, Math.round(Number(allowed.interval_minutes)));
    }

    const scheduleChanged =
      ['interval_minutes', 'specific_time', 'specific_date', 'recurrence'].some((k) => k in allowed) ||
      (allowed.enabled === 1 && current.enabled === 0);

    const merged: ReminderRecord = { ...current, ...allowed };
    if (allowed.specific_time !== undefined || allowed.specific_date !== undefined) merged.type = 'specific_time';
    else if (allowed.interval_minutes) merged.type = 'interval';

    if (scheduleChanged) {
      const next = computeInitialTrigger(toFields(merged), Date.now());
      if (next === null) {
        throw new ReminderValidationError('The new date/time is already in the past.');
      }
      merged.next_trigger_at = next;
      merged.enabled = allowed.enabled === 0 ? 0 : 1;
    }

    const updated = this.reminderRepo.update(id, merged);
    if (updated) {
      this.notifyRendererRemindersChanged();
    }
    return updated;
  }

  public deleteReminder(id: string): boolean {
    this.recentlyDeleted.set(id, Date.now());
    const success = this.reminderRepo.delete(id);
    if (success) {
      this.notifyRendererRemindersChanged();
    }
    return success;
  }

  public clearAllReminders(): boolean {
    const success = this.reminderRepo.deleteAll();
    if (success) {
      this.notifyRendererRemindersChanged();
    }
    return success;
  }

  public snoozeReminder(id: string, minutes: number = 5): ReminderRecord | null {
    const record = this.reminderRepo.getById(id);
    if (!record) return null;

    const now = Date.now();
    const nextTrigger = now + minutes * 60 * 1000;
    const updated = this.reminderRepo.update(id, {
      next_trigger_at: nextTrigger,
      enabled: 1,
    });
    this.notifyRendererRemindersChanged();
    return updated;
  }

  /** User/AI marked it done: recurring reminders move to their next slot, one-time ones switch off. */
  public completeReminder(id: string): ReminderRecord | null {
    const record = this.reminderRepo.getById(id);
    if (!record) return null;
    const now = Date.now();
    const { enabled, nextTriggerAt } = computeAfterFire(toFields({ ...record, next_trigger_at: Math.max(record.next_trigger_at, now) }), now);
    const updated = this.reminderRepo.update(id, {
      last_triggered_at: now,
      next_trigger_at: nextTriggerAt,
      enabled: enabled ? 1 : 0,
    });
    this.notifyRendererRemindersChanged();
    return updated;
  }

  private rescheduleOrComplete(id: string): ReminderRecord | null {
    const record = this.reminderRepo.getById(id);
    if (!record) return null;
    const now = Date.now();
    const { enabled, nextTriggerAt } = computeAfterFire(toFields(record), now);
    const updated = this.reminderRepo.update(id, {
      last_triggered_at: now,
      next_trigger_at: nextTriggerAt,
      enabled: enabled ? 1 : 0,
    });
    this.notifyRendererRemindersChanged();
    return updated;
  }

  public notifyRendererRemindersChanged(): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) {
      const allReminders = this.reminderRepo.getAll();
      win.webContents.send('appu-reminders-synced', allReminders);
    }
  }

  /**
   * Upsert the renderer's list. Deletions are explicit IPC calls, so rows missing from
   * the list are left alone, and rows the scheduler fired more recently than the
   * renderer knows about keep their DB schedule.
   */
  public syncFromRenderer(reminders: any[]): void {
    if (!Array.isArray(reminders)) return;
    const tombstoneCutoff = Date.now() - 60_000;
    for (const [id, at] of this.recentlyDeleted) {
      if (at < tombstoneCutoff) this.recentlyDeleted.delete(id);
    }

    for (const r of reminders) {
      if (!r || typeof r.id !== 'string' || !r.id) continue;
      if (this.recentlyDeleted.has(r.id)) continue;
      const type: 'interval' | 'specific_time' = r.type === 'specific_time' ? 'specific_time' : 'interval';
      const enabledNum = r.enabled === true || r.enabled === 1 ? 1 : 0;
      const schedule = {
        type,
        interval_minutes: Number.isFinite(Number(r.intervalMinutes)) && r.intervalMinutes ? Number(r.intervalMinutes) : null,
        specific_time: typeof r.specificTime === 'string' ? r.specificTime : null,
        specific_date: typeof r.specificDate === 'string' ? r.specificDate : null,
        recurrence: typeof r.recurrence === 'string' ? r.recurrence : null,
      };
      const existing = this.reminderRepo.getById(r.id);

      if (!existing) {
        this.reminderRepo.insert({
          id: r.id,
          title: String(r.title || 'Reminder').slice(0, 200),
          description: typeof r.description === 'string' ? r.description : null,
          ...schedule,
          recurrence: schedule.recurrence ?? normalizeRecurrence({ type, specificDate: schedule.specific_date }),
          next_trigger_at: Number(r.nextTriggerAt) || Date.now() + 30 * 60 * 1000,
          last_triggered_at: r.lastTriggeredAt ?? null,
          enabled: enabledNum,
          created_at: Number(r.createdAt) || Date.now(),
        });
        continue;
      }

      const dbIsNewer = (existing.last_triggered_at ?? 0) > (Number(r.lastTriggeredAt) || 0);
      this.reminderRepo.update(r.id, {
        title: String(r.title || existing.title).slice(0, 200),
        description: typeof r.description === 'string' ? r.description : existing.description,
        ...schedule,
        recurrence: schedule.recurrence ?? existing.recurrence,
        ...(dbIsNewer
          ? {}
          : {
              next_trigger_at: Number(r.nextTriggerAt) || existing.next_trigger_at,
              last_triggered_at: r.lastTriggeredAt ?? existing.last_triggered_at,
              enabled: enabledNum,
            }),
      });
    }
  }
}
