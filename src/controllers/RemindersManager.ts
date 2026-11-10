import { AppuReminder, ReminderRecurrence, ReminderRecurrenceType } from '../types/reminders';
import {
  computeAfterFire,
  computeInitialTrigger,
  normalizeRecurrence,
} from '../../electron/shared/reminder-schedule';

const STORAGE_KEY = 'appu_companion_reminders';

let reminderAudioCtx: AudioContext | null = null;
const getReminderAudioContext = (): AudioContext | null => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!reminderAudioCtx || reminderAudioCtx.state === 'closed') {
      reminderAudioCtx = new AudioCtx();
    }
    if (reminderAudioCtx.state === 'suspended') {
      reminderAudioCtx.resume().catch(() => {});
    }
    return reminderAudioCtx;
  } catch {
    return null;
  }
};

export class ReminderScheduleError extends Error {}

const fromDbRow = (r: any): AppuReminder => {
  const reminder: AppuReminder = {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    type: r.type,
    intervalMinutes: r.interval_minutes ?? r.intervalMinutes ?? undefined,
    specificTime: r.specific_time ?? r.specificTime ?? undefined,
    specificDate: r.specific_date ?? r.specificDate ?? undefined,
    recurrence: r.recurrence ?? undefined,
    nextTriggerAt: r.next_trigger_at ?? r.nextTriggerAt,
    lastTriggeredAt: r.last_triggered_at ?? r.lastTriggeredAt ?? undefined,
    enabled: r.enabled === 1 || r.enabled === true,
    createdAt: r.created_at ?? r.createdAt ?? Date.now(),
  };
  reminder.recurrence = normalizeRecurrence(reminder);
  return reminder;
};

export class RemindersManager {
  private static instance: RemindersManager | null = null;
  private reminders: AppuReminder[] = [];
  private listeners: Set<(reminders: AppuReminder[]) => void> = new Set();
  private triggerCallback: ((reminder: AppuReminder) => void) | null = null;
  private timerId: any = null;

  private constructor() {
    this.load();
    this.startScheduler();
    this.initDesktopSync();
  }

  private initDesktopSync() {
    if (typeof window !== 'undefined' && window.desktopAPI?.ai) {
      // Backend (SQLite) is the source of truth; it pushes the full list after every change
      window.desktopAPI.ai.onRemindersSynced((dbList: any[]) => {
        if (Array.isArray(dbList)) {
          this.reminders = dbList.map(fromDbRow);
          this.persistLocal();
          this.notify();
        }
      });

      window.desktopAPI.ai
        .getReminders()
        .then((dbList: any[]) => {
          const fromDb = Array.isArray(dbList) ? dbList.map(fromDbRow) : [];
          const dbIds = new Set(fromDb.map((r) => r.id));
          // Keep local-only reminders (e.g. added before the DB answered) and push them up
          const localOnly = this.reminders.filter((r) => !dbIds.has(r.id));
          this.reminders = [...fromDb, ...localOnly];
          this.persistLocal();
          this.notify();
          if (localOnly.length > 0) {
            window.desktopAPI?.ai?.syncReminders(this.reminders).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  public static getInstance(): RemindersManager {
    if (!RemindersManager.instance) {
      RemindersManager.instance = new RemindersManager();
    }
    return RemindersManager.instance;
  }

  public static resetInstanceForTesting(): void {
    if (RemindersManager.instance?.timerId) {
      clearInterval(RemindersManager.instance.timerId);
    }
    RemindersManager.instance = null;
  }

  public setTriggerCallback(cb: ((reminder: AppuReminder) => void) | null) {
    this.triggerCallback = cb;
  }

  public subscribe(listener: (reminders: AppuReminder[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.reminders]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getReminders(): AppuReminder[] {
    return [...this.reminders];
  }

  /** Throws ReminderScheduleError when a one-time date/time is already in the past. */
  public addReminder(params: {
    title: string;
    type: ReminderRecurrenceType;
    intervalMinutes?: number;
    specificTime?: string;
    specificDate?: string;
    recurrence?: ReminderRecurrence;
  }): AppuReminder {
    const now = Date.now();
    const recurrence = normalizeRecurrence(params);
    const nextTriggerAt = computeInitialTrigger({ ...params, recurrence }, now);
    if (nextTriggerAt === null) {
      throw new ReminderScheduleError('That date and time is already in the past.');
    }

    const newReminder: AppuReminder = {
      id: `rem_${now}_${Math.random().toString(36).substring(2, 7)}`,
      title: params.title.trim() || 'Reminder',
      type: params.type,
      intervalMinutes: params.type === 'interval' ? params.intervalMinutes : undefined,
      specificTime: params.type === 'specific_time' ? params.specificTime : undefined,
      specificDate: params.type === 'specific_time' && recurrence !== 'daily' ? params.specificDate : undefined,
      recurrence,
      nextTriggerAt,
      enabled: true,
      createdAt: now,
    };

    this.reminders.unshift(newReminder);
    this.save();
    return newReminder;
  }

  public removeReminder(id: string) {
    this.reminders = this.reminders.filter((r) => r.id !== id);
    this.save();
    if (typeof window !== 'undefined' && window.desktopAPI?.ai?.deleteReminder) {
      window.desktopAPI.ai.deleteReminder(id).catch(() => {});
    }
  }

  public clearAll() {
    this.reminders = [];
    this.save();
    if (typeof window !== 'undefined' && window.desktopAPI?.ai?.clearReminders) {
      window.desktopAPI.ai.clearReminders().catch(() => {});
    }
  }

  /**
   * Pass a key with value `undefined` to clear that field (e.g. specificDate when
   * switching to Daily). Editing the schedule re-enables the reminder.
   * Throws ReminderScheduleError when the new one-time date/time is in the past.
   */
  public updateReminder(
    id: string,
    updates: {
      title?: string;
      type?: ReminderRecurrenceType;
      intervalMinutes?: number;
      specificTime?: string;
      specificDate?: string;
      recurrence?: ReminderRecurrence;
    }
  ): AppuReminder | null {
    const current = this.reminders.find((r) => r.id === id);
    if (!current) return null;

    const candidate: AppuReminder = { ...current };
    if (updates.title !== undefined) candidate.title = updates.title.trim() || current.title;
    for (const key of ['type', 'intervalMinutes', 'specificTime', 'specificDate', 'recurrence'] as const) {
      if (key in updates) (candidate as any)[key] = updates[key];
    }

    const scheduleChanged = (['type', 'intervalMinutes', 'specificTime', 'specificDate', 'recurrence'] as const).some(
      (key) => key in updates && updates[key] !== (current as any)[key]
    );
    if (scheduleChanged) {
      candidate.recurrence = normalizeRecurrence(candidate);
      const next = computeInitialTrigger(candidate, Date.now());
      if (next === null) {
        throw new ReminderScheduleError('That date and time is already in the past.');
      }
      candidate.nextTriggerAt = next;
      candidate.enabled = true;
    }

    this.reminders = this.reminders.map((r) => (r.id === id ? candidate : r));
    this.save();
    return candidate;
  }

  /** Returns false when a finished one-time reminder cannot be restarted because its time has passed. */
  public toggleReminder(id: string, enabled?: boolean): boolean {
    const current = this.reminders.find((r) => r.id === id);
    if (!current) return false;
    const nextEnabled = enabled !== undefined ? enabled : !current.enabled;
    let nextTriggerAt = current.nextTriggerAt;
    if (nextEnabled) {
      const computed = computeInitialTrigger(current, Date.now());
      if (computed === null) return false;
      nextTriggerAt = computed;
    }
    this.reminders = this.reminders.map((r) => (r.id === id ? { ...r, enabled: nextEnabled, nextTriggerAt } : r));
    this.save();
    return true;
  }

  public snoozeReminder(id: string, minutes: number = 5) {
    const snoozeMs = minutes * 60 * 1000;
    this.reminders = this.reminders.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          enabled: true,
          nextTriggerAt: Date.now() + snoozeMs,
        };
      }
      return r;
    });
    this.save();
    if (typeof window !== 'undefined' && window.desktopAPI?.ai?.snoozeReminder) {
      window.desktopAPI.ai.snoozeReminder(id, minutes).catch(() => {});
    }
  }

  /** Advance a reminder after it fired (browser mode scheduler; Electron does this in the backend). */
  public markCompletedOrReschedule(id: string) {
    const now = Date.now();
    this.reminders = this.reminders.map((r) => {
      if (r.id !== id) return r;
      const { enabled, nextTriggerAt } = computeAfterFire(r, now);
      return { ...r, lastTriggeredAt: now, enabled, nextTriggerAt };
    });
    this.save();
  }

  public calculateNextTrigger(
    params: {
      type: ReminderRecurrenceType;
      intervalMinutes?: number;
      specificTime?: string;
      specificDate?: string;
      recurrence?: ReminderRecurrence;
    },
    fromTime: number = Date.now()
  ): number {
    return computeInitialTrigger(params, fromTime) ?? fromTime;
  }

  private startScheduler() {
    // In Electron Desktop mode, BackendReminderService handles background scheduling
    if (typeof window !== 'undefined' && (window as any).desktopAPI?.ai) {
      return;
    }
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.checkAndTriggerPending();
    }, 4000);
  }

  public checkAndTriggerPending() {
    const now = Date.now();
    for (const r of this.reminders) {
      if (r.enabled && r.nextTriggerAt <= now) {
        this.playReminderSound();
        if (this.triggerCallback) {
          this.triggerCallback(r);
        }
        this.markCompletedOrReschedule(r.id);
        break; // Trigger one at a time to prevent overlapping speech bubbles
      }
    }
  }

  public playReminderSound() {
    try {
      const ctx = getReminderAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two-tone cheerful glass bell chime (G5 -> C6)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(783.99, now); // G5
      osc1.frequency.setValueAtTime(1046.5, now + 0.15); // C6

      osc2.frequency.setValueAtTime(392.0, now);
      osc2.frequency.setValueAtTime(523.25, now + 0.15);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.0);
      osc2.stop(now + 1.0);
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
  }

  private persistLocal() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reminders));
      }
    } catch (e) {
      console.warn('Failed to save reminders:', e);
    }
  }

  private save() {
    this.persistLocal();
    if (typeof window !== 'undefined' && window.desktopAPI?.ai) {
      window.desktopAPI.ai.syncReminders(this.reminders).catch(() => {});
    }
    this.notify();
  }

  private load() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.reminders = parsed.map((r: AppuReminder) => ({ ...r, recurrence: normalizeRecurrence(r) }));
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load reminders:', e);
    }

    // Default seeded presets on first launch
    const now = Date.now();
    this.reminders = [
      {
        id: 'preset_water',
        title: 'Drink Water',
        type: 'interval',
        intervalMinutes: 45,
        recurrence: 'interval',
        nextTriggerAt: now + 45 * 60 * 1000,
        enabled: true,
        createdAt: now,
      },
      {
        id: 'preset_eye_rest',
        title: 'Rest Eyes (20-20-20 rule)',
        type: 'interval',
        intervalMinutes: 30,
        recurrence: 'interval',
        nextTriggerAt: now + 30 * 60 * 1000,
        enabled: true,
        createdAt: now,
      },
    ];
  }

  private notify() {
    const copy = [...this.reminders];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }
}
