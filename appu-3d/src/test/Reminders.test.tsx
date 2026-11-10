import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { RemindersManager } from '../controllers/RemindersManager';
import { RemindersModal } from '../components/RemindersModal';

describe('Reminders System', () => {
  beforeEach(() => {
    localStorage.clear();
    RemindersManager.resetInstanceForTests();
  });

  describe('RemindersManager', () => {
    it('initializes with default seeded presets', () => {
      const manager = RemindersManager.getInstance();
      const reminders = manager.getReminders();
      expect(reminders.length).toBeGreaterThanOrEqual(2);
      expect(reminders.some((r) => r.title.includes('Water'))).toBe(true);
      expect(reminders.some((r) => r.title.includes('Eyes'))).toBe(true);
    });

    it('adds interval reminder correctly', () => {
      const manager = RemindersManager.getInstance();
      const initialCount = manager.getReminders().length;
      const newReminder = manager.addReminder({
        title: 'Drink Water 45m',
        type: 'interval',
        intervalMinutes: 45,
      });

      expect(newReminder.title).toBe('Drink Water 45m');
      expect(newReminder.enabled).toBe(true);
      expect(newReminder.intervalMinutes).toBe(45);
      expect(manager.getReminders().length).toBe(initialCount + 1);
    });

    it('adds specific time reminder correctly', () => {
      const manager = RemindersManager.getInstance();
      const newReminder = manager.addReminder({
        title: 'Evening Standup',
        type: 'specific_time',
        specificTime: '16:00',
      });

      expect(newReminder.title).toBe('Evening Standup');
      expect(newReminder.specificTime).toBe('16:00');
      expect(newReminder.enabled).toBe(true);
    });

    it('toggles and removes reminders', () => {
      const manager = RemindersManager.getInstance();
      const item = manager.addReminder({
        title: 'Task Test',
        type: 'interval',
        intervalMinutes: 20,
      });

      manager.toggleReminder(item.id, false);
      const paused = manager.getReminders().find((r) => r.id === item.id);
      expect(paused?.enabled).toBe(false);

      manager.removeReminder(item.id);
      const removed = manager.getReminders().find((r) => r.id === item.id);
      expect(removed).toBeUndefined();
    });

    it('triggers callback and reschedules interval when pending time reached', () => {
      const manager = RemindersManager.getInstance();
      const triggerSpy = vi.fn();
      manager.setTriggerCallback(triggerSpy);

      const pastReminder = manager.addReminder({
        title: 'Immediate Test',
        type: 'interval',
        intervalMinutes: 10,
      });

      // Manually set trigger time in past
      const list = manager.getReminders();
      const target = list.find((r) => r.id === pastReminder.id)!;
      target.nextTriggerAt = Date.now() - 1000;

      manager.checkAndTriggerPending();
      expect(triggerSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Immediate Test' }));
    });
  });

  describe('RemindersModal Component', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(<RemindersModal isOpen={false} onClose={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders header, quick presets and list when open', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('Reminders')).toBeInTheDocument();
      expect(screen.getByText('Quick Add:')).toBeInTheDocument();
      expect(screen.getByText('💧 Water (45m)')).toBeInTheDocument();
      expect(screen.getByText('👀 Eye Rest (30m)')).toBeInTheDocument();
      expect(screen.getByText('+ Add Reminder')).toBeInTheDocument();
    });

    it('adds preset when clicking preset chip', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('💧 Water (45m)'));
      const items = screen.getAllByText('Drink Water');
      expect(items.length).toBeGreaterThan(0);
    });

    it('submits custom reminder form', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText(/What to remember/i);
      fireEvent.change(input, { target: { value: 'Complete EOD Report' } });
      fireEvent.click(screen.getByText('+ Add Reminder'));
      expect(screen.getByText('Complete EOD Report')).toBeInTheDocument();
    });

    it('closes on close button click and escape key', () => {
      const onClose = vi.fn();
      render(<RemindersModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByTitle('Close (Esc)'));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });
});
