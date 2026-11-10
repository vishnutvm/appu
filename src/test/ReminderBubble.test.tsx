import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import {
  ReminderBubble,
  getCompanionReminderVoice,
  AppuAvatarFace,
} from '../components/ReminderBubble';

describe('ReminderBubble Component & Companion Voice', () => {
  describe('getCompanionReminderVoice', () => {
    it('generates warm natural voice for 1-minute timer reminder', () => {
      const voice = getCompanionReminderVoice('Come back after 1 min', 1, undefined, 'interval');
      expect(voice).toContain('1-minute');
      expect(voice).not.toContain('Time for your 1m reminder');
    });

    it('generates health-focused companion copy for water reminders', () => {
      const voice = getCompanionReminderVoice('Drink Water', 45, undefined, 'interval');
      expect(voice).toMatch(/water|hydrat/i);
    });

    it('generates vision care copy for eye rest reminders', () => {
      const voice = getCompanionReminderVoice('Rest Eyes', 20, undefined, 'interval');
      expect(voice).toMatch(/eyes|screen/i);
    });

    it('generates movement copy for stretch/walk reminders', () => {
      const voice = getCompanionReminderVoice('Stretch and Stand', 60, undefined, 'interval');
      expect(voice).toMatch(/stretch|stand|shoulders/i);
    });

    it('generates scheduled meeting copy for specific time meetings', () => {
      const voice = getCompanionReminderVoice('Team Sync', undefined, '16:00', 'specific_time');
      expect(voice).toMatch(/meeting|sync|connect/i);
    });
  });

  describe('AppuAvatarFace Component', () => {
    it('renders avatar badge with SVG visor and active status dot', () => {
      render(<AppuAvatarFace />);
      const badge = screen.getByTestId('appu-avatar-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.querySelector('.avatar-status-dot')).toBeInTheDocument();
    });

    it('applies celebrating class and happy eyes when isCelebrating is true', () => {
      render(<AppuAvatarFace isCelebrating={true} />);
      const badge = screen.getByTestId('appu-avatar-badge');
      expect(badge).toHaveClass('celebrating');
    });
  });

  describe('ReminderBubble Rendering & Interactions', () => {
    it('renders pill with alarm icon, Reminder label, title, and action buttons', () => {
      render(
        <ReminderBubble
          title="Come back after 1 min"
          intervalMinutes={1}
          type="interval"
        />
      );

      expect(screen.getByText('Reminder')).toBeInTheDocument();
      expect(screen.getByText('Come back after 1 min')).toBeInTheDocument();
      expect(screen.getByTestId('reminder-speech-bubble')).toHaveClass('minimal-reminder-pill');
      // Action buttons
      expect(screen.getByTestId('reminder-done-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reminder-snooze-btn')).toBeInTheDocument();
      expect(screen.getByText('Snooze (5m)')).toBeInTheDocument();
      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    it('handles OK button click', () => {
      const onAction = vi.fn();
      render(
        <ReminderBubble
          title="Stretch Break"
          onAction={onAction}
        />
      );

      const okBtn = screen.getByTestId('reminder-done-btn');
      fireEvent.click(okBtn);

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('handles Snooze button click with 5 minutes', () => {
      const onSnooze = vi.fn();
      render(
        <ReminderBubble
          title="Stretch Break"
          onSnooze={onSnooze}
        />
      );

      const snoozeBtn = screen.getByTestId('reminder-snooze-btn');
      fireEvent.click(snoozeBtn);

      expect(onSnooze).toHaveBeenCalledWith(5);
    });

    it('handles dismiss when clicked anywhere on the bubble', () => {
      const onAction = vi.fn();
      render(
        <ReminderBubble
          title="Stretch Break"
          onAction={onAction}
        />
      );

      const bubble = screen.getByTestId('reminder-speech-bubble');
      fireEvent.click(bubble);

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('auto-dismisses after autoDismissSeconds elapses when positive', () => {
      vi.useFakeTimers();
      const onAction = vi.fn();

      render(
        <ReminderBubble
          title="Stand Up"
          autoDismissSeconds={3}
          onAction={onAction}
        />
      );

      expect(onAction).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3100);

      expect(onAction).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('does not auto-dismiss by default or when autoDismissSeconds is 0 (stays until OK or Snooze)', () => {
      vi.useFakeTimers();
      const onAction = vi.fn();

      render(
        <ReminderBubble
          title="Stay On Screen Meeting"
          onAction={onAction}
        />
      );

      vi.advanceTimersByTime(60000); // 1 minute elapses
      expect(onAction).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('points speech tail towards Appu based on side prop', () => {
      const { rerender } = render(
        <ReminderBubble
          title="Side Left Test"
          side="left"
        />
      );

      const bubbleLeft = screen.getByTestId('reminder-speech-bubble');
      expect(bubbleLeft).toHaveClass('tail-right');

      rerender(
        <ReminderBubble
          title="Side Right Test"
          side="right"
        />
      );

      const bubbleRight = screen.getByTestId('reminder-speech-bubble');
      expect(bubbleRight).toHaveClass('tail-left');
    });
  });
});
