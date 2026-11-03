import React from 'react';
import { Bell, X } from 'lucide-react';

interface ReminderBubbleProps {
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export const ReminderBubble: React.FC<ReminderBubbleProps> = ({
  title,
  message,
  actionText = 'Join Meeting',
  onAction,
  onDismiss,
}) => {
  return (
    <div
      className="reminder-speech-bubble"
      onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
      onMouseLeave={() => window.desktopAPI?.setIgnoreMouseEvents(true)}
    >
      {/* Golden Glowing Bezel / Header */}
      <div className="bubble-header">
        <div className="bubble-title-row">
          <Bell size={15} className="bell-gold-icon" />
          <span className="bubble-title-text">{title}</span>
        </div>
        {onDismiss && (
          <button className="bubble-close-btn" onClick={onDismiss} title="Dismiss">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Message Body */}
      <p className="bubble-message">{message}</p>

      {/* Action Buttons Row */}
      <div className="bubble-actions">
        <button className="bubble-action-primary" onClick={onAction}>
          <span>{actionText}</span>
        </button>
        <button className="bubble-action-secondary" onClick={onDismiss}>
          <span>Snooze</span>
        </button>
      </div>

      {/* Cartoon Speech Tail pointing down to Appu's head */}
      <div className="speech-tail-point"></div>
    </div>
  );
};
