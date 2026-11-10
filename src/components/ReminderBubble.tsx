import React, { useEffect, useState, useRef } from 'react';
import { AlarmClock, Clock, Check } from 'lucide-react';
import './ReminderBubble.css';

export interface ReminderBubbleProps {
  id?: string;
  title: string;
  message?: string;
  actionText?: string;
  intervalMinutes?: number;
  specificTime?: string;
  type?: 'interval' | 'specific_time';
  recurrence?: 'none' | 'interval' | 'daily' | 'weekly';
  side?: 'left' | 'right';
  variant?: 'medium' | 'compact';
  autoDismissSeconds?: number;
  onAction?: () => void;
  onSnooze?: (minutes?: number) => void;
  onDismiss?: () => void;
}

/**
 * Animated Mini Appu Avatar Face (Retained for component and test compatibility)
 */
export const AppuAvatarFace: React.FC<{ isCelebrating?: boolean }> = ({ isCelebrating }) => {
  return (
    <div
      className={`appu-avatar-badge ${isCelebrating ? 'celebrating' : ''}`}
      data-testid="appu-avatar-badge"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="appuHeadGrad" x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.75" stopColor="#dbeafe" />
            <stop offset="1" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="goldEarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#fde047" />
            <stop offset="1" stopColor="#f6c344" />
          </linearGradient>
        </defs>

        <rect x="1" y="11" width="3" height="9" rx="1.5" fill="url(#goldEarGrad)" />
        <rect x="28" y="11" width="3" height="9" rx="1.5" fill="url(#goldEarGrad)" />

        <rect
          x="3.5"
          y="4"
          width="25"
          height="23"
          rx="11.5"
          fill="url(#appuHeadGrad)"
          stroke="#f6c344"
          strokeWidth="1.2"
        />

        <rect
          x="6.5"
          y="9"
          width="19"
          height="12"
          rx="6"
          fill="#060c18"
          stroke="rgba(0, 210, 238, 0.4)"
          strokeWidth="0.8"
        />

        {isCelebrating ? (
          <>
            <path
              d="M10.5 15.5C11.5 13.5 13.5 13.5 14.5 15.5"
              stroke="#00d2ee"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M17.5 15.5C18.5 13.5 20.5 13.5 21.5 15.5"
              stroke="#00d2ee"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="12" cy="15" r="2.2" fill="#00d2ee" className="avatar-eye" />
            <circle cx="20" cy="15" r="2.2" fill="#00d2ee" className="avatar-eye" />
          </>
        )}

        <path
          d="M14 18.2C15 19.1 17 19.1 18 18.2"
          stroke={isCelebrating ? '#f6c344' : '#00d2ee'}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <span className="avatar-status-dot" title="Appu is active" />
    </div>
  );
};

/**
 * Natural companion voice generator (Retained for compatibility)
 */
export function getCompanionReminderVoice(
  title: string,
  intervalMinutes?: number,
  specificTime?: string,
  type?: 'interval' | 'specific_time'
): string {
  const lower = (title || '').toLowerCase();

  if (lower.includes('water') || lower.includes('drink') || lower.includes('hydrate')) {
    return 'Take a quick pause and grab a refreshing glass of water! 💧';
  }
  if (lower.includes('eye') || lower.includes('screen') || lower.includes('rest') || lower.includes('look')) {
    return 'Look 20 feet away to give your eyes a quick rest away from the screen. 👀';
  }
  if (lower.includes('stretch') || lower.includes('stand') || lower.includes('walk') || lower.includes('posture')) {
    return 'Stand up, roll your shoulders back, and take a quick stretch! 🧘‍♂️';
  }
  if (lower.includes('walk') || lower.includes('stroll')) {
    return 'Time for a brief stroll to refresh your mind and recharge! 🚶';
  }
  if (lower.includes('lunch') || lower.includes('eat') || lower.includes('snack') || lower.includes('dinner')) {
    return 'Time to nourish yourself with a good meal! 🥗';
  }
  if (lower.includes('standup') || lower.includes('meeting') || lower.includes('sync') || lower.includes('call')) {
    return 'Your meeting is starting soon. Ready to connect? 🎙️';
  }
  if (
    lower.includes('1 min') ||
    lower.includes('1m') ||
    lower.includes('come back') ||
    (type === 'interval' && intervalMinutes === 1)
  ) {
    return 'Ding ding! Your 1-minute timer is up. Ready to pick back up? ⏱️';
  }
  if (type === 'interval' && intervalMinutes) {
    if (intervalMinutes < 60) {
      return `Hey! Your ${intervalMinutes}-minute check-in is here. Keep up the great pace! 🚀`;
    } else {
      const hours = Math.round(intervalMinutes / 60);
      return `Hey! Your ${hours}h interval check-in is here. How is everything going? ✨`;
    }
  }
  if (type === 'specific_time' && specificTime) {
    return `Scheduled for ${specificTime} — here is your reminder! Ready to tackle it? ⏰`;
  }
  return "Hey friend! Just popping in with your reminder. You've got this! ✨";
}

/**
 * Minimal & Lightweight Reminder UI (2026 Redesign)
 *
 * - Minimal pill capsule (240 x 56 px) with golden glow and dark glassmorphism
 * - Golden ringing AlarmClock icon + "Reminder" category + reminder title
 * - No buttons (clean, unobtrusive)
 * - Directional speech bubble tail pointing straight at Appu
 * - Auto-dismisses after 6 seconds (or click anywhere to complete/dismiss)
 */
export const ReminderBubble: React.FC<ReminderBubbleProps> = ({
  id,
  title,
  side = 'left',
  variant = 'medium',
  autoDismissSeconds = 0,
  intervalMinutes,
  recurrence,
  actionText = 'OK',
  onAction,
  onSnooze,
  onDismiss,
}) => {
  const [isDismissing, setIsDismissing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isTimer = recurrence === 'none';
  const kickerLabel = isTimer
    ? (intervalMinutes ? `${intervalMinutes}m Timer` : 'Timer')
    : 'Reminder';

  const handleOk = () => {
    if (isDismissing) return;
    setIsDismissing(true);
    if (onAction) {
      onAction();
    } else if (onDismiss) {
      onDismiss();
    }
  };

  const handleSnooze = (minutes: number = 5) => {
    if (isDismissing) return;
    setIsDismissing(true);
    if (onSnooze) {
      onSnooze(minutes);
    } else if (onDismiss) {
      onDismiss();
    }
  };

  // Auto-dismiss countdown
  useEffect(() => {
    if (isPaused || isDismissing || autoDismissSeconds <= 0) return;

    timerRef.current = setTimeout(() => {
      handleOk();
    }, autoDismissSeconds * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, isDismissing, autoDismissSeconds]);

  return (
    <div
      className={`reminder-speech-bubble minimal-reminder-pill ${
        side === 'right' ? 'tail-left' : 'tail-right'
      } variant-${variant} ${isDismissing ? 'is-dismissing' : ''}`}
      data-testid="reminder-speech-bubble"
      role="status"
      aria-live="polite"
      onClick={handleOk}
      onMouseEnter={() => {
        setIsPaused(true);
        window.desktopAPI?.setIgnoreMouseEvents(false);
      }}
      onMouseLeave={() => {
        setIsPaused(false);
        window.desktopAPI?.setIgnoreMouseEvents(true);
      }}
    >
      <div className="reminder-header-row">
        {/* Golden Alarm Clock Icon */}
        <div className="reminder-icon-container" aria-hidden="true">
          <AlarmClock size={22} className="reminder-alarm-icon" strokeWidth={2.2} />
        </div>

        {/* Vertical Divider */}
        <div className="reminder-divider" aria-hidden="true" />

        {/* Reminder Text Block */}
        <div className="reminder-text-content">
          {variant !== 'compact' && <div className="reminder-kicker">{kickerLabel}</div>}
          <div className="reminder-title" title={title}>
            {title}
          </div>
        </div>
      </div>

      {/* Action Buttons: Snooze (5m) and OK */}
      <div className="reminder-actions-row">
        <button
          type="button"
          className="reminder-action-btn reminder-snooze-btn"
          data-testid="reminder-snooze-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleSnooze(5);
          }}
          title="Snooze for 5 minutes"
        >
          <Clock size={12} className="btn-icon" />
          <span>Snooze (5m)</span>
        </button>

        <button
          type="button"
          className="reminder-action-btn reminder-ok-btn"
          data-testid="reminder-done-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOk();
          }}
          title="Mark done"
        >
          <Check size={13} strokeWidth={2.6} className="btn-icon" />
          <span>{actionText || 'OK'}</span>
        </button>
      </div>

      {/* Directional speech tail pointing towards Appu */}
      <div className="speech-tail-point" aria-hidden="true" />

      {/* Subtle bottom auto-dismiss progress line */}
      {autoDismissSeconds > 0 && !isDismissing && (
        <div
          className={`reminder-progress-line ${isPaused ? 'paused' : ''}`}
          style={{ animationDuration: `${autoDismissSeconds}s` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
