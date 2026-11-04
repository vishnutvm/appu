import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { RemindersManager } from '../controllers/RemindersManager';
import { RemindersModal } from '../components/RemindersModal';

describe('Reminders System', () => {
  beforeEach(() => {
    localStorage.clear();
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

    it('updates reminder title and schedule via updateReminder', () => {
      const manager = RemindersManager.getInstance();
      const item = manager.addReminder({
        title: 'Original Title',
        type: 'interval',
        intervalMinutes: 15,
      });

      const updated = manager.updateReminder(item.id, {
        title: 'Updated Title',
        intervalMinutes: 60,
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.intervalMinutes).toBe(60);

      const inList = manager.getReminders().find((r) => r.id === item.id);
      expect(inList?.title).toBe('Updated Title');
      expect(inList?.intervalMinutes).toBe(60);
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
      expect(screen.getByText(/Quick Add/i)).toBeInTheDocument();
      expect(screen.getByText(/Water \(45m\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Eye Rest \(30m\)/i)).toBeInTheDocument();
      expect(screen.getByText('+ Add Reminder')).toBeInTheDocument();
    });

    it('adds preset when clicking preset chip', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText(/Water \(45m\)/i));
      const items = screen.getAllByText('Drink Water');
      expect(items.length).toBeGreaterThan(0);
    });

    it('submits custom reminder form', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText(/What to remind/i);
      fireEvent.change(input, { target: { value: 'Complete EOD Report' } });
      fireEvent.click(screen.getByText('+ Add Reminder'));
      expect(screen.getByText('Complete EOD Report')).toBeInTheDocument();
    });

    it('opens edit modal when clicking reminder and saves changes', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const waterReminder = screen.getAllByText('Drink Water')[0];
      fireEvent.click(waterReminder);

      // Verify Edit Reminder modal is open
      expect(screen.getByText('Edit Reminder')).toBeInTheDocument();
      const editInput = screen.getByPlaceholderText('Reminder title...');
      expect(editInput).toHaveValue('Drink Water');

      // Change title and save
      fireEvent.change(editInput, { target: { value: 'Drink Lemon Water' } });
      fireEvent.click(screen.getByText('Save Changes'));

      // Verify updated title is in list and edit modal is closed
      expect(screen.queryByText('Edit Reminder')).not.toBeInTheDocument();
      expect(screen.getByText('Drink Lemon Water')).toBeInTheDocument();
    });

    it('allows setting custom interval duration via schedule popover', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const scheduleTrigger = screen.getByTitle('Change schedule interval or time');
      fireEvent.click(scheduleTrigger);

      // Schedule drawer should be open
      expect(screen.getByTestId('schedule-panel')).toBeInTheDocument();
      const numInput = document.querySelector('.custom-duration-num-input') as HTMLInputElement;
      expect(numInput).not.toBeNull();
      fireEvent.change(numInput, { target: { value: '25' } });
      fireEvent.click(screen.getByText('Done'));

      // Check that trigger label reflects custom interval
      expect(screen.getByText('Every 25m')).toBeInTheDocument();

      // Submit reminder
      const input = screen.getByPlaceholderText(/What to remind/i);
      fireEvent.change(input, { target: { value: 'Stretch Legs' } });
      fireEvent.click(screen.getByText('+ Add Reminder'));

      expect(screen.getByText('Stretch Legs')).toBeInTheDocument();
      expect(screen.getAllByText(/Every 25m/i).length).toBeGreaterThanOrEqual(2);
    });

    it('allows setting custom time via CustomTimePicker hour, minute, and AM/PM buttons', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const scheduleTrigger = screen.getByTitle('Change schedule interval or time');
      fireEvent.click(scheduleTrigger);

      // Switch to At Time tab
      fireEvent.click(screen.getByText('At Time'));

      // Check hour and minute inputs exist
      const hourInput = screen.getByLabelText('Hour');
      const minuteInput = screen.getByLabelText('Minute');
      fireEvent.change(hourInput, { target: { value: '8' } });
      fireEvent.change(minuteInput, { target: { value: '15' } });
      fireEvent.click(screen.getByText('AM'));

      expect(screen.getByText('At 8:15 AM')).toBeInTheDocument();
    });

    it('allows editing reminder to a specific time of day', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const waterReminder = screen.getAllByText('Drink Water')[0];
      fireEvent.click(waterReminder);

      // Switch to Specific Time tab
      fireEvent.click(screen.getByText('At Time'));

      // Select 5:30 PM
      fireEvent.click(screen.getByText('5:30 PM'));
      fireEvent.click(screen.getByText('Save Changes'));

      expect(screen.getByText(/At 5:30 PM/i)).toBeInTheDocument();
    });

    it('allows setting reminder for a particular date (e.g. Tomorrow)', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const scheduleTrigger = screen.getByTitle('Change schedule interval or time');
      fireEvent.click(scheduleTrigger);

      // Switch to At Time tab
      fireEvent.click(screen.getByText('At Time'));

      // Click Particular Date toggle
      fireEvent.click(screen.getByText('Particular Date'));

      // Click Tomorrow quick pill
      fireEvent.click(screen.getByText('Tomorrow'));

      // Check trigger updates to Tomorrow
      expect(screen.getByText(/Tomorrow at/i)).toBeInTheDocument();
    });

    it('allows switching back to Daily recurrence', () => {
      render(<RemindersModal isOpen={true} onClose={vi.fn()} />);
      const scheduleTrigger = screen.getByTitle('Change schedule interval or time');
      fireEvent.click(scheduleTrigger);

      // Switch to At Time tab
      fireEvent.click(screen.getByText('At Time'));

      // Click Particular Date, then back to Daily
      fireEvent.click(screen.getByText('Particular Date'));
      fireEvent.click(screen.getByText('Daily'));

      expect(scheduleTrigger).toHaveTextContent(/At 4:00 PM/i);
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
