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
    it('renders companion header, title, badge, and dialogue', () => {
      render(
        <ReminderBubble
          title="Come back after 1 min"
          intervalMinutes={1}
          type="interval"
          actionText="Done"
        />
      );

      expect(screen.getByText('Appu')).toBeInTheDocument();
      expect(screen.getByText('Companion')).toBeInTheDocument();
      expect(screen.getByText('Come back after 1 min')).toBeInTheDocument();
      expect(screen.getByText('1m timer')).toBeInTheDocument();
      expect(screen.getByTestId('reminder-done-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reminder-snooze-btn')).toBeInTheDocument();
    });

    it('handles Done action and enters celebrating state', () => {
      const onAction = vi.fn();
      render(
        <ReminderBubble
          title="Stretch Break"
          intervalMinutes={30}
          onAction={onAction}
        />
      );

      const doneBtn = screen.getByTestId('reminder-done-btn');
      fireEvent.click(doneBtn);

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Great Job!')).toBeInTheDocument();
    });

    it('handles Snooze action with 5-minute interval', () => {
      const onSnooze = vi.fn();
      render(
        <ReminderBubble
          id="rem_123"
          title="Call Mum"
          onSnooze={onSnooze}
        />
      );

      const snoozeBtn = screen.getByTestId('reminder-snooze-btn');
      fireEvent.click(snoozeBtn);

      expect(onSnooze).toHaveBeenCalledWith(5);
      expect(screen.getByText('Snoozed 5m')).toBeInTheDocument();
    });

    it('handles Dismiss action via X button', () => {
      const onDismiss = vi.fn();
      render(
        <ReminderBubble
          title="Stand Up"
          onDismiss={onDismiss}
        />
      );

      const closeBtn = screen.getByLabelText('Dismiss reminder');
      fireEvent.click(closeBtn);

      expect(onDismiss).toHaveBeenCalledTimes(1);
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
