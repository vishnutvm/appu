import { ToolDefinition } from '../types';
import { BackendReminderService, ReminderValidationError } from '../../services/backend-reminder-service';

export function createReminderTools(reminderService: BackendReminderService): ToolDefinition[] {
  const createReminderTool: ToolDefinition = {
    name: 'create_reminder',
    description:
      'Creates a real desktop reminder in Appu. One-time: pass scheduled_at. Repeating: recurrence daily (scheduled_at = first occurrence), weekly (scheduled_at = first occurrence), or interval with recurrence_interval + recurrence_unit (e.g. every 45 minutes, every 2 hours, every 3 days). Relative one-shot ("in 10 minutes"): recurrence none + recurrence_interval 10 + recurrence_unit minutes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Short title of the reminder (e.g. Drink water, Call John, Review code)',
        },
        description: {
          type: 'STRING',
          description: 'Optional additional details or notes for the reminder',
        },
        scheduled_at: {
          type: 'STRING',
          description: 'Local ISO date/time (e.g. 2026-11-10T16:30:00) or Unix ms when the reminder should (first) trigger. Must be in the future for one-time reminders.',
        },
        timezone: {
          type: 'STRING',
          description: 'User timezone (e.g. America/New_York, Asia/Kolkata)',
        },
        recurrence: {
          type: 'STRING',
          description: 'Recurrence type',
          enum: ['none', 'daily', 'weekly', 'interval'],
        },
        recurrence_interval: {
          type: 'INTEGER',
          description: 'Interval number (e.g. 30 for 30 minutes, 1 for 1 hour)',
        },
        recurrence_unit: {
          type: 'STRING',
          description: 'Unit for recurrence_interval',
          enum: ['minutes', 'hours', 'days', 'weeks'],
        },
      },
      required: ['title'],
    },
    validate: (args) => {
      if (!args.title || typeof args.title !== 'string' || !args.title.trim()) {
        return { valid: false, error: 'Reminder title must be a non-empty string.' };
      }
      return { valid: true };
    },
    execute: async (args, context) => {
      try {
        const created = reminderService.createReminder({
          title: args.title,
          description: args.description,
          scheduledAt: args.scheduled_at,
          timezone: args.timezone || context.timezone,
          recurrence: args.recurrence,
          recurrenceInterval: args.recurrence_interval,
          recurrenceUnit: args.recurrence_unit,
        });
        const when = new Date(created.next_trigger_at).toLocaleString();
        return {
          success: true,
          reminder_id: created.id,
          title: created.title,
          type: created.type,
          recurrence: created.recurrence,
          interval_minutes: created.interval_minutes,
          next_trigger_at: new Date(created.next_trigger_at).toISOString(),
          formatted_trigger: when,
          message: `Created reminder "${created.title}", next at ${when}.`,
        };
      } catch (err: any) {
        if (err instanceof ReminderValidationError) {
          return { success: false, error: err.message };
        }
        throw err;
      }
    },
  };

  const listRemindersTool: ToolDefinition = {
    name: 'list_reminders',
    description:
      'Retrieves the list of existing reminders from Appu database. Can filter by date (YYYY-MM-DD) or status (active, completed, all).',
    isReadOnly: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        date: {
          type: 'STRING',
          description: 'Filter by date in YYYY-MM-DD format (optional)',
        },
        status: {
          type: 'STRING',
          description: 'Filter status: active, completed, or all (default active)',
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of reminders to return (default 20)',
        },
      },
    },
    execute: async (args) => {
      const reminders = reminderService.listReminders({
        date: args.date,
        status: args.status || 'active',
        limit: args.limit ? Math.min(50, Math.max(1, Number(args.limit))) : 20,
      });

      return {
        total: reminders.length,
        reminders: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          type: r.type,
          enabled: r.enabled === 1,
          next_trigger_at: new Date(r.next_trigger_at).toISOString(),
          formatted_trigger: new Date(r.next_trigger_at).toLocaleString(),
          interval_minutes: r.interval_minutes,
          specific_time: r.specific_time,
          specific_date: r.specific_date,
          recurrence: r.recurrence,
        })),
      };
    },
  };

  const updateReminderTool: ToolDefinition = {
    name: 'update_reminder',
    description: 'Updates an existing reminder by ID (e.g. change title, reschedule time, or interval).',
    parameters: {
      type: 'OBJECT',
      properties: {
        reminder_id: {
          type: 'STRING',
          description: 'Unique ID of the reminder to update',
        },
        fields_to_update: {
          type: 'OBJECT',
          description: 'Object with updated fields (e.g. title, interval_minutes, specific_time, enabled)',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            interval_minutes: { type: 'INTEGER' },
            specific_time: { type: 'STRING' },
            specific_date: { type: 'STRING' },
            enabled: { type: 'BOOLEAN' },
            recurrence: { type: 'STRING', enum: ['none', 'daily', 'weekly', 'interval'] },
          },
        },
      },
      required: ['reminder_id', 'fields_to_update'],
    },
    validate: (args) => {
      if (!args.reminder_id || typeof args.reminder_id !== 'string') {
        return { valid: false, error: 'reminder_id is required' };
      }
      if (!args.fields_to_update || typeof args.fields_to_update !== 'object') {
        return { valid: false, error: 'fields_to_update must be an object' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      let updated;
      try {
        updated = reminderService.updateReminder(args.reminder_id, args.fields_to_update);
      } catch (err: any) {
        if (err instanceof ReminderValidationError) return { success: false, error: err.message };
        throw err;
      }
      if (!updated) {
        return { success: false, error: `Reminder with ID '${args.reminder_id}' not found.` };
      }
      return {
        success: true,
        reminder: {
          id: updated.id,
          title: updated.title,
          enabled: updated.enabled === 1,
          next_trigger_at: new Date(updated.next_trigger_at).toLocaleString(),
        },
      };
    },
  };

  const deleteReminderTool: ToolDefinition = {
    name: 'delete_reminder',
    description: 'Permanently deletes a reminder by reminder_id. Ask the user to confirm first, then call with confirmed=true.',
    requiresConfirmation: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        reminder_id: {
          type: 'STRING',
          description: 'Unique ID of the reminder to delete',
        },
        confirmed: {
          type: 'BOOLEAN',
          description: 'true only after the user explicitly confirmed this deletion',
        },
      },
      required: ['reminder_id'],
    },
    validate: (args) => {
      if (!args.reminder_id || typeof args.reminder_id !== 'string') {
        return { valid: false, error: 'reminder_id is required' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const success = reminderService.deleteReminder(args.reminder_id);
      if (!success) {
        return { success: false, error: `Reminder '${args.reminder_id}' was not found.` };
      }
      return { success: true, reminder_id: args.reminder_id, message: 'Reminder deleted.' };
    },
  };

  const completeReminderTool: ToolDefinition = {
    name: 'complete_reminder',
    description: 'Marks a reminder as completed or reschedules if recurring.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reminder_id: {
          type: 'STRING',
          description: 'Unique ID of the reminder to complete',
        },
      },
      required: ['reminder_id'],
    },
    validate: (args) => {
      if (!args.reminder_id || typeof args.reminder_id !== 'string') {
        return { valid: false, error: 'reminder_id is required' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const completed = reminderService.completeReminder(args.reminder_id);
      if (!completed) {
        return { success: false, error: `Reminder '${args.reminder_id}' not found.` };
      }
      return {
        success: true,
        reminder_id: completed.id,
        title: completed.title,
        message: `Reminder "${completed.title}" marked completed.`,
      };
    },
  };

  return [
    createReminderTool,
    listRemindersTool,
    updateReminderTool,
    deleteReminderTool,
    completeReminderTool,
  ];
}
