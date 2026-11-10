import { describe, it, expect } from 'vitest';
import {
  computeAfterFire,
  computeInitialTrigger,
  normalizeRecurrence,
  nextDailyTime,
  nextWeeklyTime,
  parseTime,
} from '../../electron/shared/reminder-schedule';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).getTime();

describe('reminder-schedule', () => {
  it('normalizes legacy reminders without recurrence', () => {
    expect(normalizeRecurrence({ type: 'interval' })).toBe('interval');
    expect(normalizeRecurrence({ type: 'specific_time', specificTime: '09:00' })).toBe('daily');
    expect(normalizeRecurrence({ type: 'specific_time', specificTime: '09:00', specificDate: '2030-01-01' })).toBe('none');
    expect(normalizeRecurrence({ type: 'interval', recurrence: 'none' })).toBe('none');
  });

  it('rejects invalid times', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9:5')).toBeNull();
    expect(parseTime('09:05')).toEqual({ hour: 9, minute: 5 });
  });

  it('returns null for a one-time reminder in the past', () => {
    const now = at(2030, 5, 10, 12);
    expect(
      computeInitialTrigger({ type: 'specific_time', specificTime: '09:00', specificDate: '2030-05-10', recurrence: 'none' }, now)
    ).toBeNull();
    expect(
      computeInitialTrigger({ type: 'specific_time', specificTime: '13:00', specificDate: '2030-05-10', recurrence: 'none' }, now)
    ).toBe(at(2030, 5, 10, 13));
  });

  it('daily reminders roll to tomorrow once today has passed', () => {
    const now = at(2030, 5, 10, 12);
    expect(nextDailyTime('09:00', now)).toBe(at(2030, 5, 11, 9));
    expect(nextDailyTime('13:30', now)).toBe(at(2030, 5, 10, 13, 30));
  });

  it('weekly reminders keep the weekday of the anchor date', () => {
    const now = at(2030, 5, 10, 12);
    const next = nextWeeklyTime('2030-05-01', '08:00', now);
    expect(next).toBe(at(2030, 5, 15, 8));
    expect(new Date(next).getDay()).toBe(new Date(at(2030, 5, 1)).getDay());
  });

  it('interval reminders advance from the scheduled slot without drift', () => {
    const scheduled = at(2030, 5, 10, 12);
    const firedLate = scheduled + 2_000;
    const result = computeAfterFire(
      { type: 'interval', intervalMinutes: 30, recurrence: 'interval', nextTriggerAt: scheduled },
      firedLate
    );
    expect(result).toEqual({ enabled: true, nextTriggerAt: scheduled + 30 * 60_000 });
  });

  it('interval reminders resume from now after a long sleep instead of bursting', () => {
    const scheduled = at(2030, 5, 10, 12);
    const firedAt = scheduled + 5 * 60 * 60_000;
    const result = computeAfterFire(
      { type: 'interval', intervalMinutes: 30, recurrence: 'interval', nextTriggerAt: scheduled },
      firedAt
    );
    expect(result.nextTriggerAt).toBe(firedAt + 30 * 60_000);
  });

  it('one-time reminders and timers are disabled after firing', () => {
    const firedAt = at(2030, 5, 10, 12);
    expect(computeAfterFire({ type: 'interval', intervalMinutes: 5, recurrence: 'none', nextTriggerAt: firedAt }, firedAt).enabled).toBe(false);
    expect(
      computeAfterFire({ type: 'specific_time', specificTime: '12:00', specificDate: '2030-05-10', recurrence: 'none', nextTriggerAt: firedAt }, firedAt).enabled
    ).toBe(false);
  });

  it('daily reminders reschedule for the next day after firing', () => {
    const firedAt = at(2030, 5, 10, 9);
    expect(computeAfterFire({ type: 'specific_time', specificTime: '09:00', recurrence: 'daily' }, firedAt)).toEqual({
      enabled: true,
      nextTriggerAt: at(2030, 5, 11, 9),
    });
  });
});
