import { AppuReminder, ReminderRecurrenceType } from '../types/reminders';

const STORAGE_KEY = 'appu_companion_reminders';

export class RemindersManager {
  private static instance: RemindersManager | null = null;
  private reminders: AppuReminder[] = [];
  private listeners: Set<(reminders: AppuReminder[]) => void> = new Set();
  private triggerCallback: ((reminder: AppuReminder) => void) | null = null;
  private timerId: any = null;

  private constructor() {
    this.load();
    this.startScheduler();
  }

  public static getInstance(): RemindersManager {
    if (!RemindersManager.instance) {
      RemindersManager.instance = new RemindersManager();
    }
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

  public addReminder(params: {
    title: string;
    type: ReminderRecurrenceType;
    intervalMinutes?: number;
    specificTime?: string;
    specificDate?: string;
  }): AppuReminder {
    const now = Date.now();
    const nextTriggerAt = this.calculateNextTrigger(params, now);

    const newReminder: AppuReminder = {
      id: `rem_${now}_${Math.random().toString(36).substring(2, 7)}`,
      title: params.title.trim() || 'Reminder',
      type: params.type,
      intervalMinutes: params.intervalMinutes,
      specificTime: params.specificTime,
      specificDate: params.specificDate,
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
  }

  public toggleReminder(id: string, enabled?: boolean) {
    const item = this.reminders.find((r) => r.id !== id);
    this.reminders = this.reminders.map((r) => {
      if (r.id === id) {
        const nextEnabled = enabled !== undefined ? enabled : !r.enabled;
        const nextTriggerAt = nextEnabled
          ? this.calculateNextTrigger(r, Date.now())
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
          // If repeating daily without a specific date, reschedule for tomorrow
          if (!r.specificDate) {
            return {
              ...r,
              lastTriggeredAt: now,
              nextTriggerAt: this.calculateNextDailyTime(r.specificTime, now + 60000),
            };
          } else {
            // One-off specific date/time, disable once done
            return {
              ...r,
              lastTriggeredAt: now,
              enabled: false,
            };
          }
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
    if (params.type === 'interval' && params.intervalMinutes) {
      return fromTime + Math.max(1, params.intervalMinutes) * 60 * 1000;
    }

    if (params.type === 'specific_time' && params.specificTime) {
      if (params.specificDate) {
        const [year, month, day] = params.specificDate.split('-').map(Number);
        const [hour, minute] = params.specificTime.split(':').map(Number);
        const target = new Date(year, month - 1, day, hour, minute, 0, 0);
        return target.getTime();
      } else {
        return this.calculateNextDailyTime(params.specificTime, fromTime);
      }
    }

    return fromTime + 30 * 60 * 1000;
  }

  private calculateNextDailyTime(timeStr: string, fromTime: number): number {
    const [hour, minute] = timeStr.split(':').map(Number);
    const now = new Date(fromTime);
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

    // If candidate time has already passed today, schedule for tomorrow
    if (candidate.getTime() <= fromTime) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.getTime();
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
        break; // Trigger one at a time to prevent overlapping speech bubbles
      }
    }
  }

  public playReminderSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
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

  private save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reminders));
      }
    } catch (e) {
      console.warn('Failed to save reminders:', e);
    }
    this.notify();
  }

  private load() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.reminders = JSON.parse(raw);
          return;
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
  }

  private notify() {
    const copy = [...this.reminders];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }
}
