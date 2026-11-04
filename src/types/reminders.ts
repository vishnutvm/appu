export type ReminderRecurrenceType = 'interval' | 'specific_time';

export interface AppuReminder {
  id: string;
  title: string;
  type: ReminderRecurrenceType;
  intervalMinutes?: number; // e.g. 30, 45, 60
  specificTime?: string; // "HH:mm" 24h format, e.g. "16:00", "17:30"
  specificDate?: string; // "YYYY-MM-DD" (optional)
  nextTriggerAt: number; // timestamp in ms
  lastTriggeredAt?: number; // timestamp in ms
  enabled: boolean;
  createdAt: number;
}
