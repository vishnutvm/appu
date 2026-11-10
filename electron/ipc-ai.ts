import { ipcMain, BrowserWindow } from 'electron';
import { ConversationService } from './ai/conversation-service';
import { CredentialService } from './services/credential-service';
import { MemoryRepository } from './database/repositories/memory-repository';
import { ConversationRepository } from './database/repositories/conversation-repository';
import { BackendReminderService } from './services/backend-reminder-service';
import { isTrustedSender } from './ipc-security';
import { DEFAULT_GEMINI_MODEL } from './ai/gemini-provider';

const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9.\-]{1,63}$/i;

export function registerAIIpcHandlers(
  conversationService: ConversationService,
  credentialService: CredentialService,
  memoryRepo: MemoryRepository,
  conversationRepo: ConversationRepository,
  backendReminderService: BackendReminderService,
  getWindow: () => BrowserWindow | null
): void {
  const handle = (
    channel: string,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any
  ) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event, getWindow())) {
        throw new Error(`Rejected untrusted IPC call to ${channel}`);
      }
      return listener(event, ...args);
    });
  };

  // 1. Send User Message
  handle('ai:send-message', async (_event, payload: { conversationId?: string; text: string }) => {
    try {
      if (!payload || typeof payload.text !== 'string') {
        throw new Error('Invalid message payload');
      }
      return await conversationService.processUserMessage({
        conversationId: payload.conversationId,
        text: payload.text,
      });
    } catch (err: any) {
      console.error('IPC ai:send-message error:', err);
      return {
        error: err?.message || 'Failed to process AI message',
      };
    }
  });

  // 2. Get Messages for Conversation
  handle('ai:get-conversation', async (_event, conversationId?: string) => {
    try {
      const conv = conversationId
        ? conversationRepo.getConversationById(conversationId) || conversationRepo.getOrCreateLatestConversation()
        : conversationRepo.getOrCreateLatestConversation();

      const messages = conversationRepo.getMessages(conv.id, 50);
      return {
        conversation: conv,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
          toolResults: m.tool_results ? JSON.parse(m.tool_results) : undefined,
          createdAt: m.created_at,
        })),
      };
    } catch (err: any) {
      console.error('IPC ai:get-conversation error:', err);
      return { error: err?.message };
    }
  });

  // 3. Clear Conversation
  handle('ai:clear-conversation', async (_event, conversationId: string) => {
    try {
      if (!conversationId || typeof conversationId !== 'string') {
        return { success: false, error: 'Invalid conversationId' };
      }
      conversationRepo.clearMessages(conversationId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  // 4. Create New Conversation
  handle('ai:create-conversation', async (_event, title?: string) => {
    try {
      const conv = conversationRepo.createConversation(title || 'New Chat');
      return { success: true, conversation: conv };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  // 5. Get AI Configuration & Status
  handle('ai:get-status', async () => {
    try {
      const provider = conversationService.getProvider();
      const status = await provider.getProviderStatus();
      return {
        enabled: conversationService.isAIEnabled(),
        provider: status.provider,
        model: status.model,
        hasApiKey: credentialService.hasApiKey(),
        keySource: credentialService.getKeySource(),
        isSecureStorageAvailable: credentialService.isSecureStorageAvailable(),
      };
    } catch (err: any) {
      return {
        enabled: true,
        provider: 'Google Gemini',
        model: DEFAULT_GEMINI_MODEL,
        hasApiKey: false,
        isSecureStorageAvailable: false,
        error: err?.message,
      };
    }
  });

  // 6. Update AI Configuration (Model, API Key, Enable/Disable)
  handle(
    'ai:set-config',
    async (
      _event,
      config: { enabled?: boolean; model?: string; apiKey?: string; clearKey?: boolean }
    ) => {
      try {
        if (!config || typeof config !== 'object') {
          return { success: false, error: 'Invalid configuration' };
        }
        if (typeof config.enabled === 'boolean') {
          conversationService.setAIEnabled(config.enabled);
        }

        if (typeof config.model === 'string' && config.model.trim()) {
          const model = config.model.trim();
          if (!MODEL_NAME_PATTERN.test(model)) {
            return { success: false, error: 'Invalid model name' };
          }
          conversationService.setModel(model);
        }

        if (config.clearKey) {
          credentialService.clearApiKey();
        } else if (typeof config.apiKey === 'string' && config.apiKey.trim()) {
          const key = config.apiKey.trim();
          if (key.length < 20 || key.length > 200 || /\s/.test(key)) {
            return { success: false, error: 'That does not look like a valid Gemini API key' };
          }
          credentialService.setApiKey(key);
        }

        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    }
  );

  // 7. Test Connection
  handle('ai:test-connection', async () => {
    try {
      return await conversationService.getProvider().validateConfiguration(conversationService.getTools());
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Connection test failed' };
    }
  });

  // 8. Memories Management
  handle('ai:get-memories', async (_event, query?: string) => {
    try {
      if (query && typeof query === 'string' && query.trim()) {
        return memoryRepo.search(query.trim());
      }
      return memoryRepo.getAll(100);
    } catch (err: any) {
      return { error: err?.message };
    }
  });

  handle('ai:delete-memory', async (_event, memoryId: string) => {
    try {
      if (!memoryId || typeof memoryId !== 'string') return { success: false };
      const ok = memoryRepo.delete(memoryId);
      return { success: ok };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  handle(
    'ai:save-memory',
    async (_event, payload: { content: string; category?: string; importance?: number }) => {
      try {
        if (!payload || !payload.content) return { success: false };
        const saved = memoryRepo.insert({
          content: payload.content,
          category: payload.category || 'general',
          importance: payload.importance || 1,
        });
        return { success: true, memory: saved };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    }
  );

  // 9. Sync Reminders between SQLite and Renderer
  handle('ai:get-reminders', async () => {
    try {
      return backendReminderService.listReminders({ status: 'all' });
    } catch (err: any) {
      return [];
    }
  });

  handle('ai:sync-reminders-from-renderer', async (_event, reminders: any[]) => {
    try {
      if (!Array.isArray(reminders)) {
        return { success: false, error: 'Invalid reminders payload' };
      }
      backendReminderService.syncFromRenderer(reminders);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  handle('ai:delete-reminder', async (_event, reminderId: string) => {
    try {
      const ok = backendReminderService.deleteReminder(reminderId);
      return { success: ok };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  handle('ai:complete-reminder', async (_event, reminderId: string) => {
    try {
      const res = backendReminderService.completeReminder(reminderId);
      return { success: Boolean(res) };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  handle('ai:snooze-reminder', async (_event, reminderId: string, minutes: number = 5) => {
    try {
      const mins = Number(minutes);
      if (typeof reminderId !== 'string' || !Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) {
        return { success: false, error: 'Invalid snooze request' };
      }
      const res = backendReminderService.snoozeReminder(reminderId, mins);
      return { success: Boolean(res) };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  handle('ai:reminders-ready', async () => {
    backendReminderService.setRendererReady(true);
    return { success: true };
  });

  handle('ai:clear-reminders', async () => {
    try {
      const ok = backendReminderService.clearAllReminders();
      return { success: ok };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });
}
