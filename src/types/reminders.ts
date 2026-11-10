export type ReminderRecurrenceType = 'interval' | 'specific_time';
export type ReminderRecurrence = 'none' | 'interval' | 'daily' | 'weekly';

export interface AppuReminder {
  id: string;
  title: string;
  description?: string;
  type: ReminderRecurrenceType;
  intervalMinutes?: number; // e.g. 1, 30, 45, 60
  specificTime?: string; // "HH:mm" 24h format, e.g. "16:00", "17:30"
  specificDate?: string; // "YYYY-MM-DD" (optional)
  recurrence?: ReminderRecurrence;
  nextTriggerAt: number; // timestamp in ms
  lastTriggeredAt?: number; // timestamp in ms
  enabled: boolean;
  createdAt: number;
}
