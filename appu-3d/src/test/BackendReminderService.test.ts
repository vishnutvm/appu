import { describe, it, expect, beforeEach } from 'vitest';
import {
  BackendReminderService,
  PastReminderTimeError,
  REMINDERS_STORAGE_KEY,
  REMINDERS_DELETED_KEY,
} from '../controllers/BackendReminderService';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('BackendReminderService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects one-shot reminders scheduled in the past', () => {
    const service = new BackendReminderService(memoryStorage());
    const now = Date.parse('2026-11-10T12:00:00');

    expect(() =>
      service.createReminder({
        title: 'Too late',
        type: 'specific_time',
        specificTime: '09:00',
        specificDate: '2026-11-10',
        now,
      })
    ).toThrow(PastReminderTimeError);

    expect(service.getReminders()).toHaveLength(0);
  });

  it('accepts future one-shot and daily specific times', () => {
    const service = new BackendReminderService(memoryStorage());
    const now = Date.parse('2026-11-10T12:00:00');

    const future = service.createReminder({
      title: 'Later today',
      type: 'specific_time',
      specificTime: '18:00',
      specificDate: '2026-11-10',
      now,
    });
    expect(future.nextTriggerAt).toBeGreaterThan(now);

    const daily = service.createReminder({
      title: 'Every afternoon',
      type: 'specific_time',
      specificTime: '09:00',
      now,
    });
    // 09:00 already passed today → tomorrow
    expect(daily.nextTriggerAt).toBeGreaterThan(now);
  });

  it('does not return deleted reminders after sync', () => {
    const storage = memoryStorage();
    const service = new BackendReminderService(storage);

    const created = service.createReminder({
      title: 'Temp',
      type: 'interval',
      intervalMinutes: 20,
    });

    service.deleteReminder(created.id);
    expect(service.getReminders().find((r) => r.id === created.id)).toBeUndefined();

    // Simulate a stale writer putting the deleted row back into storage.
    storage.setItem(
      REMINDERS_STORAGE_KEY,
      JSON.stringify([
        {
          ...created,
          title: 'Resurrected',
        },
      ])
    );

    const synced = service.sync();
    expect(synced.find((r) => r.id === created.id)).toBeUndefined();
    expect(JSON.parse(storage.getItem(REMINDERS_DELETED_KEY) || '[]')).toContain(created.id);
  });

  it('migrates old reminder rows into the current format', () => {
    const legacyDue = Date.parse('2026-11-11T15:30:00');
    const storage = memoryStorage({
      [REMINDERS_STORAGE_KEY]: JSON.stringify([
        {
          id: 'legacy_due',
          title: 'Legacy due field',
          due: legacyDue,
          enabled: true,
        },
        {
          id: 'legacy_interval',
          title: 'Legacy interval',
          interval: 45,
          enabled: true,
        },
        {
          id: 'legacy_seconds',
          title: 'Epoch seconds',
          dueAt: Math.floor(legacyDue / 1000),
        },
      ]),
    });

    const service = new BackendReminderService(storage);
    const rows = service.getReminders();

    const dueRow = rows.find((r) => r.id === 'legacy_due')!;
    expect(dueRow.type).toBe('specific_time');
    expect(dueRow.nextTriggerAt).toBe(legacyDue);
    expect(dueRow.specificTime).toBe('15:30');
    expect(dueRow.specificDate).toBe('2026-11-11');

    const intervalRow = rows.find((r) => r.id === 'legacy_interval')!;
    expect(intervalRow.type).toBe('interval');
    expect(intervalRow.intervalMinutes).toBe(45);
    expect(intervalRow.nextTriggerAt).toBeGreaterThan(0);

    const secondsRow = rows.find((r) => r.id === 'legacy_seconds')!;
    expect(secondsRow.nextTriggerAt).toBe(legacyDue);
  });
});
