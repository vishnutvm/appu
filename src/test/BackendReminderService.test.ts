/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppuDatabase } from '../../electron/database/database';
import { ReminderRepository } from '../../electron/database/repositories/reminder-repository';
import {
  BackendReminderService,
  ReminderValidationError,
} from '../../electron/services/backend-reminder-service';

describe('BackendReminderService', () => {
  let db: AppuDatabase;
  let reminderRepo: ReminderRepository;
  let service: BackendReminderService;
  let mockWindow: { isDestroyed: () => boolean; webContents: { send: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    db = new AppuDatabase(':memory:');
    reminderRepo = new ReminderRepository(db.getRawDatabase());
    mockWindow = {
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
    };
    service = new BackendReminderService(reminderRepo, () => mockWindow as any);
  });

  afterEach(() => {
    service.stopScheduler();
    db.close();
  });

  it('rejects one-shot reminders scheduled in the past', () => {
    const past = Date.now() - 60_000;
    expect(() =>
      service.createReminder({
        title: 'Too late',
        scheduledAt: past,
        recurrence: 'none',
      })
    ).toThrow(ReminderValidationError);

    expect(service.listReminders()).toHaveLength(0);
  });

  it('accepts future one-shot reminders', () => {
    const future = Date.now() + 60 * 60_000;
    const created = service.createReminder({
      title: 'Later',
      scheduledAt: future,
      recurrence: 'none',
    });
    expect(created.next_trigger_at).toBeGreaterThan(Date.now());
    expect(service.listReminders({ status: 'active' })).toHaveLength(1);
  });

  it('keeps deleted reminders gone across a stale renderer sync', () => {
    const created = service.createReminder({
      title: 'Temp',
      recurrence: 'interval',
      recurrenceInterval: 20,
      recurrenceUnit: 'minutes',
    });

    expect(service.deleteReminder(created.id)).toBe(true);
    expect(service.listReminders().find((r) => r.id === created.id)).toBeUndefined();

    // Stale full-list sync tries to resurrect the deleted row
    service.syncFromRenderer([
      {
        id: created.id,
        title: 'Resurrected',
        type: created.type,
        intervalMinutes: created.interval_minutes,
        specificTime: created.specific_time,
        specificDate: created.specific_date,
        recurrence: created.recurrence,
        nextTriggerAt: created.next_trigger_at,
        enabled: true,
        createdAt: created.created_at,
      },
    ]);

    expect(service.listReminders().find((r) => r.id === created.id)).toBeUndefined();
  });

  it('migrates legacy rows missing recurrence into the current format', () => {
    const now = Date.now();
    reminderRepo.insert({
      id: 'legacy_interval',
      title: 'Legacy interval',
      description: null,
      type: 'interval',
      interval_minutes: 45,
      specific_time: null,
      specific_date: null,
      next_trigger_at: now + 45 * 60_000,
      last_triggered_at: null,
      enabled: 1,
      created_at: now,
      timezone: null,
      recurrence: null,
      recurrence_interval: null,
      recurrence_unit: null,
    });
    reminderRepo.insert({
      id: 'legacy_daily_time',
      title: 'Legacy daily',
      description: null,
      type: 'specific_time',
      interval_minutes: null,
      specific_time: '09:00',
      specific_date: null,
      next_trigger_at: now + 60_000,
      last_triggered_at: null,
      enabled: 1,
      created_at: now,
      timezone: null,
      recurrence: null,
      recurrence_interval: null,
      recurrence_unit: null,
    });

    // Constructor normalizeLegacyRows already ran on empty DB; re-run via a fresh service
    service.stopScheduler();
    service = new BackendReminderService(reminderRepo, () => mockWindow as any);

    const interval = reminderRepo.getById('legacy_interval')!;
    expect(interval.recurrence).toBe('interval');

    const daily = reminderRepo.getById('legacy_daily_time')!;
    expect(daily.recurrence).toBe('daily');
  });
});
