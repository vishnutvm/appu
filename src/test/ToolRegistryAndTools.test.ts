/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppuDatabase } from '../../electron/database/database';
import { ReminderRepository } from '../../electron/database/repositories/reminder-repository';
import { MemoryRepository } from '../../electron/database/repositories/memory-repository';
import { ConversationRepository } from '../../electron/database/repositories/conversation-repository';
import { BackendReminderService } from '../../electron/services/backend-reminder-service';
import { ToolRegistry } from '../../electron/ai/tools/tool-registry';
import { createReminderTools } from '../../electron/ai/tools/reminder-tools';
import { createMemoryTools } from '../../electron/ai/tools/memory-tools';
import { createGeneralTools } from '../../electron/ai/tools/general-tools';
import { ExecutionContext } from '../../electron/ai/types';

describe('Tool Registry and Tool Calling Architecture', () => {
  let db: AppuDatabase;
  let reminderRepo: ReminderRepository;
  let memoryRepo: MemoryRepository;
  let conversationRepo: ConversationRepository;
  let reminderService: BackendReminderService;
  let registry: ToolRegistry;
  let mockWindow: any;
  let context: ExecutionContext;

  beforeEach(() => {
    db = new AppuDatabase(':memory:');
    const raw = db.getRawDatabase();
    reminderRepo = new ReminderRepository(raw);
    memoryRepo = new MemoryRepository(raw);
    conversationRepo = new ConversationRepository(raw);

    mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: vi.fn(),
      },
    };

    reminderService = new BackendReminderService(reminderRepo, () => mockWindow);
    registry = new ToolRegistry();

    createReminderTools(reminderService).forEach((t) => registry.register(t));
    createMemoryTools(memoryRepo).forEach((t) => registry.register(t));
    createGeneralTools(reminderRepo, memoryRepo, conversationRepo, () => mockWindow).forEach((t) =>
      registry.register(t)
    );

    context = {
      conversationId: 'test_conv',
      now: Date.now(),
      timezone: 'America/New_York',
    };
  });

  afterEach(() => {
    reminderService.stopScheduler();
    db.close();
  });

  describe('Registry Validation', () => {
    it('rejects invalid arguments for tools requiring mandatory fields', () => {
      const tool = registry.getTool('create_reminder')!;
      expect(tool).toBeDefined();

      const invalidRes = registry.validateArgs(tool, {});
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.error).toContain('title');

      const validRes = registry.validateArgs(tool, { title: 'Drink Water' });
      expect(validRes.valid).toBe(true);
    });

    it('returns error when unknown tool is invoked', async () => {
      const results = await registry.executeToolCalls(
        [{ id: 'c1', name: 'non_existent_tool', args: {} }],
        context
      );
      expect(results[0].error).toContain('not registered');
    });
  });

  describe('Reminder Tools', () => {
    it('executes create_reminder and creates real reminder in database', async () => {
      const results = await registry.executeToolCalls(
        [
          {
            id: 'call_create',
            name: 'create_reminder',
            args: {
              title: 'Take vitamins',
              recurrence: 'interval',
              recurrence_interval: 45,
              recurrence_unit: 'minutes',
            },
          },
        ],
        context
      );

      expect(results.length).toBe(1);
      expect(results[0].error).toBeUndefined();
      expect(results[0].result.success).toBe(true);
      expect(results[0].result.reminder_id).toBeDefined();

      const inDb = reminderRepo.getById(results[0].result.reminder_id);
      expect(inDb).not.toBeNull();
      expect(inDb?.title).toBe('Take vitamins');
      expect(inDb?.interval_minutes).toBe(45);
    });

    it('lists, updates, and deletes reminders', async () => {
      // 1. Create
      const createRes = await registry.executeToolCalls(
        [
          {
            id: 'c1',
            name: 'create_reminder',
            args: { title: 'Call Client', scheduled_at: new Date(Date.now() + 100000).toISOString() },
          },
        ],
        context
      );
      const reminderId = createRes[0].result.reminder_id;

      // 2. List
      const listRes = await registry.executeToolCalls(
        [{ id: 'c2', name: 'list_reminders', args: { status: 'active' } }],
        context
      );
      expect(listRes[0].result.total).toBe(1);

      // 3. Update
      const updateRes = await registry.executeToolCalls(
        [
          {
            id: 'c3',
            name: 'update_reminder',
            args: { reminder_id: reminderId, fields_to_update: { title: 'Call Manager' } },
          },
        ],
        context
      );
      expect(updateRes[0].result.success).toBe(true);
      expect(reminderRepo.getById(reminderId)?.title).toBe('Call Manager');

      // 4. Delete is refused until the user has confirmed
      const unconfirmed = await registry.executeToolCalls(
        [{ id: 'c4a', name: 'delete_reminder', args: { reminder_id: reminderId } }],
        context
      );
      expect(unconfirmed[0].error).toBeTruthy();
      expect(reminderRepo.getById(reminderId)).not.toBeNull();

      const delRes = await registry.executeToolCalls(
        [{ id: 'c4', name: 'delete_reminder', args: { reminder_id: reminderId, confirmed: true } }],
        context
      );
      expect(delRes[0].result.success).toBe(true);
      expect(reminderRepo.getById(reminderId)).toBeNull();
    });
  });

  describe('Memory Tools', () => {
    it('saves, searches, updates, and deletes persistent facts', async () => {
      // 1. Save
      const saveRes = await registry.executeToolCalls(
        [
          {
            id: 'm1',
            name: 'save_memory',
            args: {
              content: 'User is building an AI assistant named Appu',
              category: 'project',
              importance: 5,
            },
          },
        ],
        context
      );

      expect(saveRes[0].result.success).toBe(true);
      const memId = saveRes[0].result.memory_id;

      // 2. Search
      const searchRes = await registry.executeToolCalls(
        [{ id: 'm2', name: 'search_memory', args: { query: 'Appu' } }],
        context
      );
      expect(searchRes[0].result.total).toBe(1);
      expect(searchRes[0].result.memories[0].content).toContain('Appu');

      // 3. Update
      const updateRes = await registry.executeToolCalls(
        [
          {
            id: 'm3',
            name: 'update_memory',
            args: {
              memory_id: memId,
              updated_content: 'User is building an AI assistant named Appu 2.0',
            },
          },
        ],
        context
      );
      expect(updateRes[0].result.success).toBe(true);

      // 4. Delete
      const delRes = await registry.executeToolCalls(
        [{ id: 'm4', name: 'delete_memory', args: { memory_id: memId, confirmed: true } }],
        context
      );
      expect(delRes[0].result.success).toBe(true);
      expect(memoryRepo.getById(memId)).toBeNull();
    });
  });

  describe('General Assistant Tools', () => {
    it('returns exact current time with timezone', async () => {
      const results = await registry.executeToolCalls(
        [{ id: 't1', name: 'get_current_time', args: { timezone: 'Asia/Kolkata' } }],
        context
      );
      expect(results[0].result.iso).toBeDefined();
      expect(results[0].result.timezone).toBe('Asia/Kolkata');
      expect(results[0].result.dayOfWeek).toBeDefined();
    });

    it('returns application status metrics', async () => {
      const results = await registry.executeToolCalls(
        [{ id: 't2', name: 'get_application_status', args: {} }],
        context
      );
      expect(results[0].result.companion).toBe('Appu Desktop Companion');
      expect(typeof results[0].result.activeRemindersCount).toBe('number');
      expect(typeof results[0].result.storedMemoriesCount).toBe('number');
    });
  });
});
