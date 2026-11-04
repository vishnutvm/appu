import React, { useState, useEffect, useRef } from 'react';
import { RemindersManager } from '../controllers/RemindersManager';
import { AppuReminder, ReminderRecurrenceType } from '../types/reminders';
import {
  Calendar,
  MoreHorizontal,
  X,
  Droplet,
  Eye,
  Plus,
  ChevronDown,
  Clock,
  Trash2,
  Check,
  Play,
  Pause,
  Pencil,
  Repeat,
} from 'lucide-react';
import './RemindersModal.css';

interface CustomTimePickerProps {
  value: string;
  onChange: (time: string) => void;
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange }) => {
  const [hStr, mStr] = (value || '16:00').split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;

  const handleHourChange = (newHour: number) => {
    let clamped = Math.max(1, Math.min(12, isNaN(newHour) ? 1 : newHour));
    let h24 = clamped % 12;
    if (period === 'PM') h24 += 12;
    onChange(`${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  const handleMinuteChange = (newMin: number) => {
    let clamped = Math.max(0, Math.min(59, isNaN(newMin) ? 0 : newMin));
    let h24 = hour12 % 12;
    if (period === 'PM') h24 += 12;
    onChange(`${h24.toString().padStart(2, '0')}:${clamped.toString().padStart(2, '0')}`);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    let h24 = hour12 % 12;
    if (newPeriod === 'PM') h24 += 12;
    onChange(`${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  return (
    <div className="custom-time-picker" data-testid="custom-time-picker">
      <div className="time-digit-block">
        <input
          type="number"
          min="1"
          max="12"
          className="time-digit-input"
          value={hour12}
          onChange={(e) => handleHourChange(parseInt(e.target.value, 10))}
          aria-label="Hour"
        />
        <span className="time-digit-sublabel">Hour</span>
      </div>

      <span className="time-colon">:</span>

      <div className="time-digit-block">
        <input
          type="number"
          min="0"
          max="59"
          className="time-digit-input"
          value={m.toString().padStart(2, '0')}
          onChange={(e) => handleMinuteChange(parseInt(e.target.value, 10))}
          aria-label="Minute"
        />
        <span className="time-digit-sublabel">Minute</span>
      </div>

      <div className="time-ampm-switch">
        <button
          type="button"
          className={`ampm-btn ${period === 'AM' ? 'active' : ''}`}
          onClick={() => handlePeriodChange('AM')}
        >
          AM
        </button>
        <button
          type="button"
          className={`ampm-btn ${period === 'PM' ? 'active' : ''}`}
          onClick={() => handlePeriodChange('PM')}
        >
          PM
        </button>
      </div>
    </div>
  );
};

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskTyping?: () => void;
  onTaskAdded?: (title: string) => void;
}

export const RemindersModal: React.FC<RemindersModalProps> = ({
  isOpen,
  onClose,
  onTaskTyping,
  onTaskAdded,
}) => {
  const manager = RemindersManager.getInstance();
  const [reminders, setReminders] = useState<AppuReminder[]>([]);
  const [title, setTitle] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  // Flexible Schedule for Add Form
  const [scheduleType, setScheduleType] = useState<'interval' | 'specific_time'>('interval');
  const [intervalValue, setIntervalValue] = useState(45);
  const [intervalUnit, setIntervalUnit] = useState<'m' | 'h'>('m');
  const [specificTime, setSpecificTime] = useState('16:00');
  const [dateScheduleMode, setDateScheduleMode] = useState<'daily' | 'particular_date'>('daily');
  const [specificDate, setSpecificDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [showSchedulePopover, setShowSchedulePopover] = useState(false);

  // Flexible Schedule for Edit Modal
  const [editingReminder, setEditingReminder] = useState<AppuReminder | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editScheduleType, setEditScheduleType] = useState<'interval' | 'specific_time'>('interval');
  const [editIntervalValue, setEditIntervalValue] = useState(45);
  const [editIntervalUnit, setEditIntervalUnit] = useState<'m' | 'h'>('m');
  const [editSpecificTime, setEditSpecificTime] = useState('16:00');
  const [editDateScheduleMode, setEditDateScheduleMode] = useState<'daily' | 'particular_date'>('daily');
  const [editSpecificDate, setEditSpecificDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const today = getTodayDateStr();
    const tomorrow = getTomorrowDateStr();
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTimeDisplay = (timeStr?: string) => {
    if (!timeStr) return '4:00 PM';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const minFormatted = m < 10 ? `0${m}` : `${m}`;
    return `${hour12}:${minFormatted} ${period}`;
  };

  const getScheduleDisplay = (
    type: 'interval' | 'specific_time',
    val: number,
    unit: 'm' | 'h',
    timeStr: string,
    mode: 'daily' | 'particular_date' = 'daily',
    dateStr?: string
  ) => {
    if (type === 'interval') {
      if (unit === 'h') {
        return `Every ${val}h`;
      }
      if (val >= 60 && val % 60 === 0) {
        return `Every ${val / 60}h`;
      }
      return `Every ${val}m`;
    }
    if (mode === 'particular_date' && dateStr) {
      return `${formatDateDisplay(dateStr)} at ${formatTimeDisplay(timeStr)}`;
    }
    return `At ${formatTimeDisplay(timeStr)}`;
  };

  useEffect(() => {
    return manager.subscribe((list) => {
      setReminders(list);
    });
  }, [manager]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSchedulePopover) {
          setShowSchedulePopover(false);
        } else if (editingReminder) {
          setEditingReminder(null);
        } else if (showHeaderMenu) {
          setShowHeaderMenu(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showSchedulePopover, editingReminder, showHeaderMenu]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showHeaderMenu && !showSchedulePopover) return;
    const handleClickOutside = () => {
      setShowHeaderMenu(false);
      setShowSchedulePopover(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showHeaderMenu, showSchedulePopover]);

  if (!isOpen) return null;

  const handleStartEdit = (reminder: AppuReminder) => {
    setEditingReminder(reminder);
    setEditTitle(reminder.title);
    if (reminder.type === 'specific_time' && reminder.specificTime) {
      setEditScheduleType('specific_time');
      setEditSpecificTime(reminder.specificTime);
      if (reminder.specificDate) {
        setEditDateScheduleMode('particular_date');
        setEditSpecificDate(reminder.specificDate);
      } else {
        setEditDateScheduleMode('daily');
        setEditSpecificDate(getTodayDateStr());
      }
    } else {
      setEditScheduleType('interval');
      const mins = reminder.intervalMinutes || 45;
      if (mins >= 60 && mins % 60 === 0) {
        setEditIntervalUnit('h');
        setEditIntervalValue(mins / 60);
      } else {
        setEditIntervalUnit('m');
        setEditIntervalValue(mins);
      }
    }
    setShowHeaderMenu(false);
    setShowSchedulePopover(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    if (editScheduleType === 'specific_time') {
      const isParticular = editDateScheduleMode === 'particular_date';
      manager.updateReminder(editingReminder.id, {
        title: trimmedTitle,
        type: 'specific_time',
        specificTime: editSpecificTime || '16:00',
        specificDate: isParticular ? editSpecificDate : undefined,
        intervalMinutes: undefined,
      });
    } else {
      const mins = Math.max(
        1,
        editIntervalUnit === 'h' ? editIntervalValue * 60 : editIntervalValue
      );
      manager.updateReminder(editingReminder.id, {
        title: trimmedTitle,
        type: 'interval',
        intervalMinutes: mins,
        specificTime: undefined,
        specificDate: undefined,
      });
    }

    onTaskAdded?.(trimmedTitle);
    setEditingReminder(null);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const taskTitle = title.trim();
    if (scheduleType === 'specific_time') {
      const isParticular = dateScheduleMode === 'particular_date';
      manager.addReminder({
        title: taskTitle,
        type: 'specific_time',
        specificTime: specificTime || '16:00',
        specificDate: isParticular ? specificDate : undefined,
      });
    } else {
      const mins = Math.max(
        1,
        intervalUnit === 'h' ? intervalValue * 60 : intervalValue
      );
      manager.addReminder({
        title: taskTitle,
        type: 'interval',
        intervalMinutes: mins,
      });
    }

    onTaskAdded?.(taskTitle);
    setTitle('');
    setShowSchedulePopover(false);
  };

  const handleAddPreset = (preset: {
    title: string;
    type: ReminderRecurrenceType;
    intervalMinutes?: number;
    specificTime?: string;
  }) => {
    manager.addReminder(preset);
    onTaskAdded?.(preset.title);
  };

  const formatCountdown = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Next in 1m';
    const mins = Math.max(1, Math.floor(diff / 60000));
    if (mins < 60) return `Next in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `Next in ${hrs}h ${remMins > 0 ? remMins + 'm' : ''}`;
  };

  const getCardIcon = (cardTitle: string) => {
    const lower = cardTitle.toLowerCase();
    if (lower.includes('water') || lower.includes('drink')) {
      return <Droplet size={18} strokeWidth={2} className="card-icon-svg water" />;
    }
    if (lower.includes('eye') || lower.includes('rest')) {
      return <Eye size={18} strokeWidth={2} className="card-icon-svg eye" />;
    }
    return <Clock size={18} strokeWidth={2} className="card-icon-svg default" />;
  };

  return (
    <div
      className="reminders-overlay"
      onClick={onClose}
      onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
    >
      <div
        className="reminders-modal-card"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
      >
        {editingReminder ? (
          <div className="edit-reminder-view">
            <div className="reminders-header">
              <div className="header-left">
                <div className="header-icon-box" aria-hidden="true">
                  <Pencil size={18} strokeWidth={2} />
                </div>
                <h2 className="header-title">Edit Reminder</h2>
              </div>

              <div className="header-right">
                <button
                  type="button"
                  className="header-circle-btn close-btn"
                  onClick={() => setEditingReminder(null)}
                  title="Close edit"
                  aria-label="Close edit"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="edit-modal-form">
              <div className="edit-form-field">
                <div className="edit-form-label-row">
                  <label className="edit-form-label">REMINDER TITLE</label>
                  <span className="edit-form-char-count">{editTitle.length}/60</span>
                </div>
                <div className="edit-input-wrapper">
                  <Pencil size={14} className="edit-input-icon" />
                  <input
                    type="text"
                    maxLength={60}
                    className="edit-text-input"
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      onTaskTyping?.();
                    }}
                    placeholder="Reminder title..."
                    autoFocus
                  />
                  {editTitle && (
                    <button
                      type="button"
                      className="edit-input-clear-btn"
                      onClick={() => setEditTitle('')}
                      title="Clear text"
                      aria-label="Clear text"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="edit-form-field">
                <label className="edit-form-label">SCHEDULE TYPE</label>
                <div className="popover-tabs edit-modal-tabs">
                  <button
                    type="button"
                    className={`popover-tab-btn ${editScheduleType === 'interval' ? 'active' : ''}`}
                    onClick={() => setEditScheduleType('interval')}
                  >
                    <Repeat size={12} />
                    <span>Interval</span>
                  </button>
                  <button
                    type="button"
                    className={`popover-tab-btn ${editScheduleType === 'specific_time' ? 'active' : ''}`}
                    onClick={() => setEditScheduleType('specific_time')}
                  >
                    <Clock size={12} />
                    <span>At Time</span>
                  </button>
                </div>
              </div>

              {editScheduleType === 'interval' ? (
                <div className="edit-form-field">
                  <label className="edit-form-label">REPEAT INTERVAL</label>
                  <div className="preset-grid edit-presets">
                    {[15, 30, 45, 60, 120].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`preset-pill ${
                          (editIntervalUnit === 'm' && editIntervalValue === mins) ||
                          (editIntervalUnit === 'h' && editIntervalValue * 60 === mins)
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => {
                          if (mins >= 60 && mins % 60 === 0) {
                            setEditIntervalUnit('h');
                            setEditIntervalValue(mins / 60);
                          } else {
                            setEditIntervalUnit('m');
                            setEditIntervalValue(mins);
                          }
                        }}
                      >
                        {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                      </button>
                    ))}
                  </div>
                  <div className="custom-duration-row edit-custom-duration">
                    <span className="duration-prefix">Every</span>
                    <div className="custom-duration-unified">
                      <input
                        type="number"
                        min="1"
                        max="720"
                        className="custom-duration-num-input"
                        value={editIntervalValue}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setEditIntervalValue(isNaN(val) ? 1 : Math.max(1, val));
                        }}
                      />
                      <select
                        className="custom-duration-unit-select"
                        value={editIntervalUnit}
                        onChange={(e) => setEditIntervalUnit(e.target.value as 'm' | 'h')}
                      >
                        <option value="m">minutes</option>
                        <option value="h">hours</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="edit-form-field">
                  <label className="edit-form-label">SCHEDULE RECURRENCE & TIME</label>

                  <div className="schedule-mode-selector">
                    <button
                      type="button"
                      className={`schedule-mode-pill ${editDateScheduleMode === 'daily' ? 'active' : ''}`}
                      onClick={() => setEditDateScheduleMode('daily')}
                    >
                      <Repeat size={11} />
                      <span>Daily</span>
                    </button>
                    <button
                      type="button"
                      className={`schedule-mode-pill ${editDateScheduleMode === 'particular_date' ? 'active' : ''}`}
                      onClick={() => setEditDateScheduleMode('particular_date')}
                    >
                      <Calendar size={11} />
                      <span>Particular Date</span>
                    </button>
                  </div>

                  {editDateScheduleMode === 'particular_date' && (
                    <div className="date-picker-section">
                      <div className="date-quick-pills">
                        <button
                          type="button"
                          className={`preset-pill ${editSpecificDate === getTodayDateStr() ? 'selected' : ''}`}
                          onClick={() => setEditSpecificDate(getTodayDateStr())}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className={`preset-pill ${editSpecificDate === getTomorrowDateStr() ? 'selected' : ''}`}
                          onClick={() => setEditSpecificDate(getTomorrowDateStr())}
                        >
                          Tomorrow
                        </button>
                        <input
                          type="date"
                          aria-label="Edit Specific Date"
                          className="particular-date-input"
                          value={editSpecificDate}
                          min={getTodayDateStr()}
                          onChange={(e) => setEditSpecificDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="time-picker-row">
                    <CustomTimePicker
                      value={editSpecificTime}
                      onChange={(val) => setEditSpecificTime(val)}
                    />
                  </div>
                  <div className="preset-grid edit-presets">
                    {[
                      { label: '9:00 AM', val: '09:00' },
                      { label: '1:00 PM', val: '13:00' },
                      { label: '4:00 PM', val: '16:00' },
                      { label: '5:30 PM', val: '17:30' },
                      { label: '8:00 PM', val: '20:00' },
                    ].map(({ label, val }) => (
                      <button
                        key={val}
                        type="button"
                        className={`preset-pill ${editSpecificTime === val ? 'selected' : ''}`}
                        onClick={() => setEditSpecificTime(val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="edit-modal-actions">
                <button
                  type="button"
                  className="edit-cancel-btn"
                  onClick={() => setEditingReminder(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="edit-save-btn">
                  <Check size={14} strokeWidth={2.5} />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Header matching Image 2 */}
            <div className="reminders-header">
          <div className="header-left">
            <div className="header-icon-box" aria-hidden="true">
              <Calendar size={18} strokeWidth={2} />
            </div>
            <h2 className="header-title">Reminders</h2>
            <span
              className={`reminder-count-pill ${
                reminders.filter((r) => r.enabled).length > 0 ? 'has-active' : 'is-idle'
              }`}
            >
              {reminders.filter((r) => r.enabled).length} active
            </span>
          </div>

          <div className="header-right">
            <div className="menu-anchor-wrap">
              <button
                type="button"
                className={`header-circle-btn ${showHeaderMenu ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHeaderMenu((prev) => !prev);
                }}
                title="Options"
                aria-label="More options"
              >
                <MoreHorizontal size={15} />
              </button>

              {showHeaderMenu && (
                <div className="header-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      const allEnabled = reminders.every((r) => r.enabled);
                      reminders.forEach((r) => manager.toggleReminder(r.id, !allEnabled));
                      setShowHeaderMenu(false);
                    }}
                  >
                    {reminders.every((r) => r.enabled) ? (
                      <>
                        <Pause size={13} />
                        <span>Pause All</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        <span>Resume All</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="dropdown-item danger"
                    onClick={() => {
                      reminders.forEach((r) => manager.removeReminder(r.id));
                      setShowHeaderMenu(false);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Clear All</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="header-circle-btn close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close Reminders"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Quick Add Row matching Image 2 */}
        <div className="quick-add-row">
          <span className="quick-add-label">Quick Add</span>
          <div className="quick-chips">
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
              <Droplet size={14} strokeWidth={2} className="chip-droplet-icon" />
              <span>Water (45m)</span>
            </button>

            <button
              type="button"
              className="preset-chip"
              onClick={() =>
                handleAddPreset({
                  title: 'Rest Eyes (20-20-20 rule)',
                  type: 'interval',
                  intervalMinutes: 30,
                })
              }
            >
              <Eye size={14} strokeWidth={2} className="chip-eye-icon" />
              <span>Eye Rest (30m)</span>
            </button>

            <button
              type="button"
              className="preset-chip custom-chip"
              onClick={() => {
                inputRef.current?.focus();
                setShowSchedulePopover(true);
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Custom</span>
            </button>
          </div>
        </div>

        {/* Form Row */}
        <form className="add-reminder-form" onSubmit={handleAddCustom}>
          <input
            ref={inputRef}
            type="text"
            className="compact-input"
            placeholder="What to remind?"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              onTaskTyping?.();
            }}
            required
          />

          <button
            type="button"
            className={`schedule-trigger-btn ${showSchedulePopover ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowSchedulePopover((prev) => !prev);
              setShowHeaderMenu(false);
            }}
            title="Change schedule interval or time"
          >
            <Clock size={13} className="trigger-clock-icon" />
            <span className="trigger-label">
              {getScheduleDisplay(
                scheduleType,
                intervalValue,
                intervalUnit,
                specificTime,
                dateScheduleMode,
                specificDate
              )}
            </span>
            <ChevronDown size={13} className="trigger-chevron" />
          </button>

          <button type="submit" className="compact-add-btn">
            + Add Reminder
          </button>
        </form>

        {/* Inline Schedule Configuration Drawer */}
        {showSchedulePopover && (
          <div
            className="schedule-inline-panel"
            data-testid="schedule-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inline-panel-header">
              <div className="popover-tabs">
                <button
                  type="button"
                  className={`popover-tab-btn ${scheduleType === 'interval' ? 'active' : ''}`}
                  onClick={() => setScheduleType('interval')}
                >
                  <Repeat size={12} />
                  <span>Interval</span>
                </button>
                <button
                  type="button"
                  className={`popover-tab-btn ${scheduleType === 'specific_time' ? 'active' : ''}`}
                  onClick={() => setScheduleType('specific_time')}
                >
                  <Clock size={12} />
                  <span>At Time</span>
                </button>
              </div>

              <button
                type="button"
                className="inline-panel-done-btn"
                onClick={() => setShowSchedulePopover(false)}
                title="Done"
              >
                <Check size={12} strokeWidth={2.5} />
                <span>Done</span>
              </button>
            </div>

            {scheduleType === 'interval' ? (
              <div className="inline-panel-content">
                <div className="preset-grid">
                  {[15, 30, 45, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`preset-pill ${
                        (intervalUnit === 'm' && intervalValue === mins) ||
                        (intervalUnit === 'h' && intervalValue * 60 === mins)
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() => {
                        if (mins >= 60 && mins % 60 === 0) {
                          setIntervalUnit('h');
                          setIntervalValue(mins / 60);
                        } else {
                          setIntervalUnit('m');
                          setIntervalValue(mins);
                        }
                      }}
                    >
                      {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                </div>

                <div className="custom-duration-row">
                  <span className="duration-prefix">Every</span>
                  <div className="custom-duration-unified">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      className="custom-duration-num-input"
                      value={intervalValue}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setIntervalValue(isNaN(val) ? 1 : Math.max(1, val));
                      }}
                    />
                    <select
                      className="custom-duration-unit-select"
                      value={intervalUnit}
                      onChange={(e) => setIntervalUnit(e.target.value as 'm' | 'h')}
                    >
                      <option value="m">minutes</option>
                      <option value="h">hours</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="inline-panel-content">
                <div className="schedule-mode-selector">
                  <button
                    type="button"
                    className={`schedule-mode-pill ${dateScheduleMode === 'daily' ? 'active' : ''}`}
                    onClick={() => setDateScheduleMode('daily')}
                  >
                    <Repeat size={11} />
                    <span>Daily</span>
                  </button>
                  <button
                    type="button"
                    className={`schedule-mode-pill ${dateScheduleMode === 'particular_date' ? 'active' : ''}`}
                    onClick={() => setDateScheduleMode('particular_date')}
                  >
                    <Calendar size={11} />
                    <span>Particular Date</span>
                  </button>
                </div>

                {dateScheduleMode === 'particular_date' && (
                  <div className="date-picker-section">
                    <div className="date-quick-pills">
                      <button
                        type="button"
                        className={`preset-pill ${specificDate === getTodayDateStr() ? 'selected' : ''}`}
                        onClick={() => setSpecificDate(getTodayDateStr())}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className={`preset-pill ${specificDate === getTomorrowDateStr() ? 'selected' : ''}`}
                        onClick={() => setSpecificDate(getTomorrowDateStr())}
                      >
                        Tomorrow
                      </button>
                      <input
                        type="date"
                        aria-label="Pick Specific Date"
                        className="particular-date-input"
                        value={specificDate}
                        min={getTodayDateStr()}
                        onChange={(e) => setSpecificDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="time-picker-row">
                  <CustomTimePicker
                    value={specificTime}
                    onChange={(val) => setSpecificTime(val)}
                  />
                </div>

                <div className="preset-grid">
                  {[
                    { label: '9:00 AM', val: '09:00' },
                    { label: '1:00 PM', val: '13:00' },
                    { label: '4:00 PM', val: '16:00' },
                    { label: '5:30 PM', val: '17:30' },
                    { label: '8:00 PM', val: '20:00' },
                  ].map(({ label, val }) => (
                    <button
                      key={val}
                      type="button"
                      className={`preset-pill ${specificTime === val ? 'selected' : ''}`}
                      onClick={() => setSpecificTime(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reminders List matching Image 2 */}
        <div className="reminders-list-container">
          {reminders.length === 0 ? (
            <div className="empty-state">No reminders set. Click a chip above!</div>
          ) : (
            <div className="reminders-list">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className={`reminder-card ${r.enabled ? 'is-active' : 'is-paused'}`}
                  onClick={() => handleStartEdit(r)}
                  title="Click to edit reminder title or time"
                >
                  <div className="card-left">
                    <div className="card-icon-circle" aria-hidden="true">
                      {getCardIcon(r.title)}
                    </div>
                    <div className="card-info">
                      <div className="card-title-row">
                        <span className="reminder-title-text">{r.title}</span>
                        <span className="edit-pencil-hint" aria-hidden="true">
                          <Pencil size={11} />
                        </span>
                      </div>
                      <span className="reminder-schedule-text">
                        {r.type === 'interval'
                          ? `Every ${
                              r.intervalMinutes && r.intervalMinutes >= 60
                                ? r.intervalMinutes / 60 + 'h'
                                : r.intervalMinutes + 'm'
                            }`
                          : r.specificDate
                          ? `${formatDateDisplay(r.specificDate)} at ${formatTimeDisplay(r.specificTime)}`
                          : `Daily at ${formatTimeDisplay(r.specificTime)}`}
                        {r.enabled && ` • ${formatCountdown(r.nextTriggerAt)}`}
                      </span>
                    </div>
                  </div>

                  <div className="card-controls" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`toggle-enable-pill ${r.enabled ? 'on' : 'off'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        manager.toggleReminder(r.id);
                      }}
                      title={r.enabled ? 'Click to Pause' : 'Click to Resume'}
                    >
                      {r.enabled ? 'Active' : 'Paused'}
                    </button>

                    <button
                      type="button"
                      className="card-delete-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        manager.removeReminder(r.id);
                      }}
                      title="Delete reminder"
                      aria-label="Delete reminder"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )}
      </div>
    </div>
  );
};
