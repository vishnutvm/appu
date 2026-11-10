import { AppuReminder, ReminderRecurrenceType } from '../types/reminders';
import {
  BackendReminderService,
  PastReminderTimeError,
  REMINDERS_STORAGE_KEY,
} from './BackendReminderService';

export { PastReminderTimeError };

export class RemindersManager {
  private static instance: RemindersManager | null = null;
  private backend: BackendReminderService;
  private reminders: AppuReminder[] = [];
  private listeners: Set<(reminders: AppuReminder[]) => void> = new Set();
  private triggerCallback: ((reminder: AppuReminder) => void) | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;

  private constructor(backend?: BackendReminderService) {
    this.backend = backend ?? new BackendReminderService();
    this.load();
    this.startScheduler();
  }

  public static getInstance(): RemindersManager {
    if (!RemindersManager.instance) {
      RemindersManager.instance = new RemindersManager();
    }
    return RemindersManager.instance;
  }

  /** Test helper — resets the singleton against a fresh storage-backed backend. */
  public static resetInstanceForTests(backend?: BackendReminderService): RemindersManager {
    if (RemindersManager.instance?.timerId) {
      clearInterval(RemindersManager.instance.timerId);
    }
    RemindersManager.instance = new RemindersManager(backend);
    return RemindersManager.instance;
  }

  public setTriggerCallback(cb: (reminder: AppuReminder) => void) {
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

  /** Re-read storage through the backend; deleted reminders stay gone. */
  public syncFromBackend(): AppuReminder[] {
    this.reminders = this.backend.sync();
    this.notify();
    return this.getReminders();
  }

  public addReminder(params: {
    title: string;
    type: ReminderRecurrenceType;
    intervalMinutes?: number;
    specificTime?: string;
    specificDate?: string;
  }): AppuReminder {
    const newReminder = this.backend.createReminder(params);
    this.reminders = this.backend.getReminders();
    this.notify();
    return newReminder;
  }

  public removeReminder(id: string) {
    this.backend.deleteReminder(id);
    this.reminders = this.backend.getReminders();
    this.notify();
  }

  public toggleReminder(id: string, enabled?: boolean) {
    this.reminders = this.reminders.map((r) => {
      if (r.id === id) {
        const nextEnabled = enabled !== undefined ? enabled : !r.enabled;
        const nextTriggerAt = nextEnabled
          ? this.backend.calculateNextTrigger(r, Date.now())
          : r.nextTriggerAt;
        return { ...r, enabled: nextEnabled, nextTriggerAt };
      }
      return r;
    });
    this.save();
  }

  public snoozeReminder(id: string, minutes: number = 5) {
    const snoozeMs = minutes * 60 * 1000;
    this.reminders = this.reminders.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          nextTriggerAt: Date.now() + snoozeMs,
        };
      }
      return r;
    });
    this.save();
  }

  public markCompletedOrReschedule(id: string) {
    const now = Date.now();
    this.reminders = this.reminders.map((r) => {
      if (r.id === id) {
        if (r.type === 'interval' && r.intervalMinutes) {
          return {
            ...r,
            lastTriggeredAt: now,
            nextTriggerAt: now + r.intervalMinutes * 60 * 1000,
          };
        } else if (r.type === 'specific_time' && r.specificTime) {
          if (!r.specificDate) {
            return {
              ...r,
              lastTriggeredAt: now,
              nextTriggerAt: this.backend.calculateNextTrigger(
                { type: 'specific_time', specificTime: r.specificTime },
                now + 60000
              ),
            };
          }
          return {
            ...r,
            lastTriggeredAt: now,
            enabled: false,
          };
        }
      }
      return r;
    });
    this.save();
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
    return this.backend.calculateNextTrigger(params, fromTime);
  }

  private startScheduler() {
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
        break;
      }
    }
  }

  public playReminderSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(783.99, now);
      osc1.frequency.setValueAtTime(1046.5, now + 0.15);

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

  private save() {
    this.backend.replaceAll(this.reminders);
    this.notify();
  }

  private load() {
    this.reminders = this.backend.getReminders();
    if (this.reminders.length === 0) {
      // Seed defaults only when storage has never held reminders.
      const hasStored =
        typeof window !== 'undefined' &&
        window.localStorage &&
        window.localStorage.getItem(REMINDERS_STORAGE_KEY) !== null;

      if (!hasStored) {
        const now = Date.now();
        const seeded: AppuReminder[] = [
          {
            id: 'preset_water',
            title: 'Drink Water',
            type: 'interval',
            intervalMinutes: 45,
            nextTriggerAt: now + 45 * 60 * 1000,
            enabled: true,
            createdAt: now,
          },
          {
            id: 'preset_eye_rest',
            title: 'Rest Eyes (20-20-20 rule)',
            type: 'interval',
            intervalMinutes: 30,
            nextTriggerAt: now + 30 * 60 * 1000,
            enabled: true,
            createdAt: now,
          },
        ];
        this.reminders = seeded;
        this.backend.replaceAll(seeded);
      }
    }
  }

  private notify() {
    const copy = [...this.reminders];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }
}
