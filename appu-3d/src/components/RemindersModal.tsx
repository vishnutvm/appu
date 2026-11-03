import React, { useState, useEffect } from 'react';
import { RemindersManager } from '../controllers/RemindersManager';
import { AppuReminder, ReminderRecurrenceType } from '../types/reminders';
import './RemindersModal.css';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemindersModal: React.FC<RemindersModalProps> = ({ isOpen, onClose }) => {
  const manager = RemindersManager.getInstance();
  const [reminders, setReminders] = useState<AppuReminder[]>([]);
  const [title, setTitle] = useState('');
  const [scheduleOption, setScheduleOption] = useState('45m');

  useEffect(() => {
    return manager.subscribe((list) => {
      setReminders(list);
    });
  }, [manager]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (scheduleOption === '16:00') {
      manager.addReminder({
        title: title.trim(),
        type: 'specific_time',
        specificTime: '16:00',
      });
    } else if (scheduleOption === '17:30') {
      manager.addReminder({
        title: title.trim(),
        type: 'specific_time',
        specificTime: '17:30',
      });
    } else {
      const mins = parseInt(scheduleOption, 10) || 45;
      manager.addReminder({
        title: title.trim(),
        type: 'interval',
        intervalMinutes: mins,
      });
    }

    setTitle('');
  };

  const handleAddPreset = (preset: {
    title: string;
    type: ReminderRecurrenceType;
    intervalMinutes?: number;
    specificTime?: string;
  }) => {
    manager.addReminder(preset);
  };

  const formatCountdown = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Due now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `in ${hrs}h ${remMins > 0 ? remMins + 'm' : ''}`;
  };

  return (
    <div
      className="reminders-overlay"
      onClick={onClose}
      onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
    >
      <div
        className="reminders-modal-card compact"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
      >
        {/* Header with prominent, easily reachable close button */}
        <div className="reminders-header">
          <div className="header-left">
            <span className="header-title">Reminders</span>
            <span className="reminder-count-pill">
              {reminders.filter((r) => r.enabled).length} active
            </span>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close Reminders"
          >
            ✕
          </button>
        </div>

        {/* 1-Click Quick Chips */}
        <div className="presets-section-compact">
          <span className="presets-label">Quick Add:</span>
          <div className="presets-row compact">
            <button
              type="button"
              className="preset-chip"
              onClick={() =>
                handleAddPreset({
                  title: 'Drink Water',
                  type: 'interval',
                  intervalMinutes: 45,
                })
              }
            >
              💧 Water (45m)
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() =>
                handleAddPreset({
                  title: 'Rest Eyes (20-20-20)',
                  type: 'interval',
                  intervalMinutes: 30,
                })
              }
            >
              👀 Eye Rest (30m)
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() =>
                handleAddPreset({
                  title: 'EOD Wrap-up',
                  type: 'specific_time',
                  specificTime: '17:30',
                })
              }
            >
              🕔 5:30 PM
            </button>
          </div>
        </div>

        {/* Minimal 1-row add form */}
        <form className="compact-add-form" onSubmit={handleAddCustom}>
          <input
            type="text"
            className="compact-input"
            placeholder="What to remember? (e.g. Water)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select
            className="compact-select"
            value={scheduleOption}
            onChange={(e) => setScheduleOption(e.target.value)}
          >
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="45m">45m</option>
            <option value="60m">1h</option>
            <option value="120m">2h</option>
            <option value="16:00">4:00 PM</option>
            <option value="17:30">5:30 PM</option>
          </select>
          <button type="submit" className="compact-add-btn">
            + Add Reminder
          </button>
        </form>

        {/* Compact Reminders List */}
        <div className="compact-list-container">
          {reminders.length === 0 ? (
            <div className="empty-state">No reminders set. Click a chip above!</div>
          ) : (
            <div className="compact-list">
              {reminders.map((r) => (
                <div key={r.id} className={`compact-card ${r.enabled ? 'is-enabled' : 'is-paused'}`}>
                  <div className="card-info">
                    <span className="reminder-title-text">{r.title}</span>
                    <span className="reminder-schedule-text">
                      {r.type === 'interval'
                        ? `Every ${r.intervalMinutes && r.intervalMinutes >= 60 ? r.intervalMinutes / 60 + 'h' : r.intervalMinutes + 'm'}`
                        : `At ${r.specificTime}`}
                      {r.enabled && ` • ${formatCountdown(r.nextTriggerAt)}`}
                    </span>
                  </div>

                  <div className="card-controls">
                    <button
                      type="button"
                      className={`toggle-enable-pill ${r.enabled ? 'on' : 'off'}`}
                      onClick={() => manager.toggleReminder(r.id)}
                      title={r.enabled ? 'Pause' : 'Resume'}
                    >
                      {r.enabled ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => manager.removeReminder(r.id)}
                      title="Remove reminder"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
