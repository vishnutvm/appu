export interface ReminderRecord {
  id: string;
  title: string;
  description?: string | null;
  type: 'interval' | 'specific_time';
  interval_minutes?: number | null;
  specific_time?: string | null;
  specific_date?: string | null;
  next_trigger_at: number;
  last_triggered_at?: number | null;
  enabled: number; // 0 or 1
  created_at: number;
  timezone?: string | null;
  recurrence?: string | null;
  recurrence_interval?: number | null;
  recurrence_unit?: string | null;
}

export interface ConversationRecord {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: string | null; // JSON string of ToolCall[]
  tool_results?: string | null; // JSON string of ToolResult[]
  execution_status?: string | null; // 'success' | 'error' | 'pending'
  created_at: number;
}

export interface MemoryRecord {
  id: string;
  content: string;
  category: string;
  importance: number;
  metadata?: string | null; // JSON string
  created_at: number;
  updated_at: number;
}

export interface AISettingRecord {
  key: string;
  value: string;
}
