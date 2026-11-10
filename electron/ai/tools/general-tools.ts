import { ToolDefinition } from '../types';
import { ReminderRepository } from '../../database/repositories/reminder-repository';
import { MemoryRepository } from '../../database/repositories/memory-repository';
import { ConversationRepository } from '../../database/repositories/conversation-repository';
import { app, BrowserWindow } from 'electron';

export function createGeneralTools(
  reminderRepo: ReminderRepository,
  memoryRepo: MemoryRepository,
  conversationRepo: ConversationRepository,
  getWindow: () => BrowserWindow | null
): ToolDefinition[] {
  const getCurrentTimeTool: ToolDefinition = {
    name: 'get_current_time',
    description: 'Retrieves the exact current local date, time, and day of the week.',
    isReadOnly: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        timezone: {
          type: 'STRING',
          description: 'Optional timezone name (e.g. America/Los_Angeles, Asia/Kolkata)',
        },
      },
    },
    execute: async (args, context) => {
      const targetTimezone = args.timezone || context.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      return {
        iso: now.toISOString(),
        formatted: now.toLocaleString('en-US', { timeZone: targetTimezone }),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: targetTimezone }),
        timezone: targetTimezone,
        timestamp: now.getTime(),
      };
    },
  };

  const getApplicationStatusTool: ToolDefinition = {
    name: 'get_application_status',
    description: 'Gets information about Appu status, active reminders, and memory count.',
    isReadOnly: true,
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
    execute: async () => {
      const activeReminders = reminderRepo.count();
      const memoriesCount = memoryRepo.count();
      return {
        companion: 'Appu Desktop Companion',
        version: app.getVersion(),
        activeRemindersCount: activeReminders,
        storedMemoriesCount: memoriesCount,
        platform: process.platform,
      };
    },
  };

  const listUpcomingRemindersTool: ToolDefinition = {
    name: 'list_upcoming_reminders',
    description: 'Quickly retrieves upcoming reminders that are scheduled to trigger next.',
    isReadOnly: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'INTEGER',
          description: 'Number of upcoming reminders to return (default 5)',
        },
      },
    },
    execute: async (args) => {
      const limit = args.limit ? Math.min(20, Math.max(1, Number(args.limit))) : 5;
      const all = reminderRepo
        .getAll()
        .filter((r) => r.enabled === 1)
        .sort((a, b) => a.next_trigger_at - b.next_trigger_at);
      const upcoming = all.slice(0, limit);
      return {
        total: upcoming.length,
        reminders: upcoming.map((r) => ({
          id: r.id,
          title: r.title,
          formatted_trigger: new Date(r.next_trigger_at).toLocaleString(),
          next_trigger_at: r.next_trigger_at,
          type: r.type,
        })),
      };
    },
  };

  const openSettingsTool: ToolDefinition = {
    name: 'open_settings',
    description: 'Opens Appu settings dialog on the desktop.',
    parameters: {
      type: 'OBJECT',
      properties: {
        section: {
          type: 'STRING',
          description: 'Section to open: general, identity, ai, updates',
        },
      },
    },
    execute: async (args) => {
      const win = getWindow();
      if (!win || win.isDestroyed()) {
        return { success: false, error: 'Appu window is not available' };
      }
      win.webContents.send('open-settings-modal', args.section || 'general');
      return { success: true, message: 'Settings opened' };
    },
  };

  const searchConversationHistoryTool: ToolDefinition = {
    name: 'search_conversation_history',
    description: 'Searches previous chat messages across conversation history by keyword.',
    isReadOnly: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Search keyword or phrase',
        },
        limit: {
          type: 'INTEGER',
          description: 'Max messages to return (default 10)',
        },
      },
      required: ['query'],
    },
    validate: (args) => {
      if (!args.query || typeof args.query !== 'string') {
        return { valid: false, error: 'query must be a string' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const limit = args.limit ? Math.min(20, Math.max(1, Number(args.limit))) : 10;
      const msgs = conversationRepo.searchMessages(args.query.trim(), limit);
      return {
        total: msgs.length,
        messages: msgs.map((m) => ({
          role: m.role,
          content: m.content,
          created_at: new Date(m.created_at).toLocaleString(),
        })),
      };
    },
  };

  return [
    getCurrentTimeTool,
    getApplicationStatusTool,
    listUpcomingRemindersTool,
    openSettingsTool,
    searchConversationHistoryTool,
  ];
}
