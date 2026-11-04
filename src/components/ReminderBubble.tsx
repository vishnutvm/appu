import React, { useState } from 'react';
import { Check, Clock, X, Sparkles } from 'lucide-react';
import './ReminderBubble.css';

export interface ReminderBubbleProps {
  id?: string;
  title: string;
  message?: string;
  actionText?: string;
  intervalMinutes?: number;
  specificTime?: string;
  type?: 'interval' | 'specific_time';
  side?: 'left' | 'right';
  onAction?: () => void;
  onSnooze?: (minutes?: number) => void;
  onDismiss?: () => void;
}

/**
 * Animated Mini Appu Avatar Face
 * Expressive robot visor with glowing cyan eyes and gold ear fixtures
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

        {/* Golden Left & Right Ear Fixtures */}
        <rect x="1" y="11" width="3" height="9" rx="1.5" fill="url(#goldEarGrad)" />
        <rect x="28" y="11" width="3" height="9" rx="1.5" fill="url(#goldEarGrad)" />

        {/* Main Curved White Helmet */}
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

        {/* Visor Area */}
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

        {/* Expressive Eyes: Arc happy eyes if celebrating, glowing circles otherwise */}
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

        {/* Cute Warm Smile */}
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
 * Natural companion voice generator (Never repetitive AI slop)
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

export const ReminderBubble: React.FC<ReminderBubbleProps> = ({
  id,
  title,
  message,
  actionText = 'Done',
  intervalMinutes,
  specificTime,
  type,
  side = 'left',
  onAction,
  onSnooze,
  onDismiss,
}) => {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);

  // Pick badge label
  const badgeText = (() => {
    if (intervalMinutes) {
      return intervalMinutes === 1 ? '1m timer' : `Every ${intervalMinutes}m`;
    }
    if (specificTime) {
      return `At ${specificTime}`;
    }
    if (type === 'interval') return 'Interval';
    return 'Reminder';
  })();

  // Natural companion dialogue
  const companionVoice = message || getCompanionReminderVoice(title, intervalMinutes, specificTime, type);

  const handleDone = () => {
    if (isCelebrating || isSnoozed) return;
    setIsCelebrating(true);
    onAction?.();
  };

  const handleSnooze = () => {
    if (isCelebrating || isSnoozed) return;
    setIsSnoozed(true);
    onSnooze?.(5);
  };

  return (
    <div
      className={`reminder-speech-bubble ${side === 'right' ? 'tail-left' : 'tail-right'} ${
        isCelebrating ? 'celebrating-state' : ''
      }`}
      data-testid="reminder-speech-bubble"
      onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
      onMouseLeave={() => window.desktopAPI?.setIgnoreMouseEvents(true)}
    >
      {/* Golden Glowing Bezel / Header with Mini Appu Face */}
      <div className="bubble-header">
        <div className="bubble-author-row">
          <AppuAvatarFace isCelebrating={isCelebrating} />
          <div className="bubble-author-info">
            <span className="bubble-author-name">Appu</span>
            <span className="bubble-author-role">Companion</span>
          </div>
        </div>

        <div className="bubble-header-actions">
          <span className="bubble-badge">
            <Clock size={11} className="badge-icon" />
            <span>{badgeText}</span>
          </span>

          {onDismiss && (
            <button
              className="bubble-close-btn"
              onClick={onDismiss}
              title="Dismiss"
              aria-label="Dismiss reminder"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Prominent Task Title Card */}
      <div className="bubble-task-container">
        <div className="bubble-task-lead">Reminder</div>
        <div className="bubble-task-title">{title}</div>
      </div>

      {/* Warm Companion Voice Message */}
      <p className="bubble-message">{companionVoice}</p>

      {/* Action Buttons Row */}
      <div className="bubble-actions">
        <button
          className={`bubble-action-primary ${isCelebrating ? 'celebrating' : ''}`}
          onClick={handleDone}
          disabled={isCelebrating || isSnoozed}
          data-testid="reminder-done-btn"
        >
          {isCelebrating ? (
            <>
              <Sparkles size={14} className="action-icon-spin" />
              <span>Great Job!</span>
            </>
          ) : (
            <>
              <Check size={14} />
              <span>{actionText}</span>
            </>
          )}
        </button>

        <button
          className="bubble-action-secondary"
          onClick={handleSnooze}
          disabled={isCelebrating || isSnoozed}
          data-testid="reminder-snooze-btn"
          title="Snooze for 5 minutes"
        >
          <Clock size={13} />
          <span>{isSnoozed ? 'Snoozed 5m' : 'Snooze 5m'}</span>
        </button>
      </div>

      {/* Cartoon Speech Tail pointing directly at Appu */}
      <div className="speech-tail-point" aria-hidden="true" />
    </div>
  );
};
