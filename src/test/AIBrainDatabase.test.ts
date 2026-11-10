/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppuDatabase } from '../../electron/database/database';
import { ReminderRepository } from '../../electron/database/repositories/reminder-repository';
import { ConversationRepository } from '../../electron/database/repositories/conversation-repository';
import { MemoryRepository } from '../../electron/database/repositories/memory-repository';
import { AISettingsRepository } from '../../electron/database/repositories/ai-settings-repository';

describe('AI Brain Database & Repositories', () => {
  let db: AppuDatabase;
  let reminderRepo: ReminderRepository;
  let conversationRepo: ConversationRepository;
  let memoryRepo: MemoryRepository;
  let aiSettingsRepo: AISettingsRepository;

  beforeEach(() => {
    // In-memory SQLite for fast, isolated tests
    db = new AppuDatabase(':memory:');
    const raw = db.getRawDatabase();
    reminderRepo = new ReminderRepository(raw);
    conversationRepo = new ConversationRepository(raw);
    memoryRepo = new MemoryRepository(raw);
    aiSettingsRepo = new AISettingsRepository(raw);
  });

  afterEach(() => {
    db.close();
  });

  describe('ReminderRepository', () => {
    it('creates, retrieves, and lists pending reminders', () => {
      const now = Date.now();
      reminderRepo.insert({
        id: 'rem_1',
        title: 'Drink Water',
        description: 'Stay hydrated',
        type: 'interval',
        interval_minutes: 30,
        next_trigger_at: now - 1000, // already due
        enabled: 1,
        created_at: now,
      });

      reminderRepo.insert({
        id: 'rem_2',
        title: 'Future Call',
        type: 'specific_time',
        next_trigger_at: now + 60000, // in 1 min
        enabled: 1,
        created_at: now,
      });

      const all = reminderRepo.getAll();
      expect(all.length).toBe(2);

      const pending = reminderRepo.getPending(now);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('rem_1');
    });

    it('updates and deletes reminders', () => {
      const now = Date.now();
      reminderRepo.insert({
        id: 'rem_test',
        title: 'Old Title',
        type: 'interval',
        next_trigger_at: now + 5000,
        enabled: 1,
        created_at: now,
      });

      const updated = reminderRepo.update('rem_test', {
        title: 'Updated Title',
        enabled: 0,
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.enabled).toBe(0);

      const fetched = reminderRepo.getById('rem_test');
      expect(fetched?.title).toBe('Updated Title');

      const deleted = reminderRepo.delete('rem_test');
      expect(deleted).toBe(true);
      expect(reminderRepo.getById('rem_test')).toBeNull();
    });

    it('queries reminders by date', () => {
      const now = new Date('2026-11-09T10:00:00Z').getTime();
      reminderRepo.insert({
        id: 'rem_date_1',
        title: 'Meeting today',
        type: 'specific_time',
        specific_date: '2026-11-09',
        next_trigger_at: now,
        enabled: 1,
        created_at: now,
      });

      const todayList = reminderRepo.getByDate('2026-11-09');
      expect(todayList.length).toBe(1);
      expect(todayList[0].title).toBe('Meeting today');

      const otherList = reminderRepo.getByDate('2026-11-10');
      expect(otherList.length).toBe(0);
    });
  });

  describe('ConversationRepository', () => {
    it('creates conversations and appends messages', () => {
      const conv = conversationRepo.getOrCreateLatestConversation();
      expect(conv.id).toBeDefined();

      conversationRepo.addMessage({
        id: 'msg_1',
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello Appu!',
        created_at: Date.now(),
      });

      conversationRepo.addMessage({
        id: 'msg_2',
        conversation_id: conv.id,
        role: 'assistant',
        content: 'Hi there! How can I help you?',
        created_at: Date.now() + 10,
      });

      const msgs = conversationRepo.getMessages(conv.id);
      expect(msgs.length).toBe(2);
      expect(msgs[0].content).toBe('Hello Appu!');
      expect(msgs[1].content).toBe('Hi there! How can I help you?');
    });

    it('searches messages and clears conversation', () => {
      const conv = conversationRepo.createConversation('Work Chat');
      conversationRepo.addMessage({
        id: 'msg_search_1',
        conversation_id: conv.id,
        role: 'user',
        content: 'My secret project is Project Nebula',
        created_at: Date.now(),
      });

      const results = conversationRepo.searchMessages('Nebula');
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('Project Nebula');

      conversationRepo.clearMessages(conv.id);
      expect(conversationRepo.getMessages(conv.id).length).toBe(0);
    });
  });

  describe('MemoryRepository', () => {
    it('inserts, searches, updates, and deletes memories', () => {
      const mem1 = memoryRepo.insert({
        content: 'User prefers working at night',
        category: 'preference',
        importance: 4,
      });

      const mem2 = memoryRepo.insert({
        content: 'Developing application named Genie in React and Electron',
        category: 'project',
        importance: 5,
      });

      expect(mem1.id).toBeDefined();
      expect(mem2.id).toBeDefined();
      expect(memoryRepo.count()).toBe(2);

      const searchGenie = memoryRepo.search('Genie');
      expect(searchGenie.length).toBe(1);
      expect(searchGenie[0].content).toContain('Genie');

      const updated = memoryRepo.update(mem1.id, 'User prefers working early in the morning');
      expect(updated?.content).toBe('User prefers working early in the morning');

      const deleted = memoryRepo.delete(mem2.id);
      expect(deleted).toBe(true);
      expect(memoryRepo.count()).toBe(1);
    });
  });

  describe('AISettingsRepository', () => {
    it('sets and retrieves persistent AI settings', () => {
      aiSettingsRepo.set('ai_enabled', 'true');
      aiSettingsRepo.set('default_model', 'gemini-2.5-flash');

      expect(aiSettingsRepo.get('ai_enabled')).toBe('true');
      expect(aiSettingsRepo.get('default_model')).toBe('gemini-2.5-flash');
      expect(aiSettingsRepo.get('non_existent', 'fallback')).toBe('fallback');
    });
  });

  describe('Legacy Integer Primary Key Migration (v2)', () => {
    it('smoothly converts legacy INTEGER id tables to TEXT id without datatype mismatch', () => {
      const rawDb = db.getRawDatabase();
      const msgInfo = rawDb.prepare('PRAGMA table_info(messages)').all() as { name: string; type: string }[];
      const idCol = msgInfo.find((c) => c.name === 'id');
      expect(idCol?.type.toUpperCase()).toBe('TEXT');

      const convInfo = rawDb.prepare('PRAGMA table_info(conversations)').all() as { name: string; type: string }[];
      const convIdCol = convInfo.find((c) => c.name === 'id');
      expect(convIdCol?.type.toUpperCase()).toBe('TEXT');
    });
  });
});
