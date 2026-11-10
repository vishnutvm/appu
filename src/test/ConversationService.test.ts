/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppuDatabase } from '../../electron/database/database';
import { ReminderRepository } from '../../electron/database/repositories/reminder-repository';
import { MemoryRepository } from '../../electron/database/repositories/memory-repository';
import { ConversationRepository } from '../../electron/database/repositories/conversation-repository';
import { AISettingsRepository } from '../../electron/database/repositories/ai-settings-repository';
import { BackendReminderService } from '../../electron/services/backend-reminder-service';
import { CharacterStateService } from '../../electron/services/character-state-service';
import { ToolRegistry } from '../../electron/ai/tools/tool-registry';
import { createReminderTools } from '../../electron/ai/tools/reminder-tools';
import { createMemoryTools } from '../../electron/ai/tools/memory-tools';
import { ConversationService } from '../../electron/ai/conversation-service';
import { AIProvider, ConversationRequest, ConversationResponse, ProviderStatus } from '../../electron/ai/types';

class MockAIProvider implements AIProvider {
  public mockResponses: ((req: ConversationRequest) => Promise<ConversationResponse>)[] = [];
  public callCount = 0;

  getProviderName(): string {
    return 'Mock Provider';
  }
  getModelName(): string {
    return 'mock-model';
  }
  setModelName(_model: string): void {}

  async sendMessage(request: ConversationRequest): Promise<ConversationResponse> {
    const handler = this.mockResponses[this.callCount];
    this.callCount++;
    if (handler) {
      return handler(request);
    }
    return { text: 'Default mock answer' };
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    return {
      provider: 'Mock',
      available: true,
      model: 'mock-model',
      hasApiKey: true,
    };
  }

  async validateConfiguration(): Promise<{ valid: boolean }> {
    return { valid: true };
  }
}

describe('ConversationService & AI Execution Loop', () => {
  let db: AppuDatabase;
  let reminderRepo: ReminderRepository;
  let memoryRepo: MemoryRepository;
  let conversationRepo: ConversationRepository;
  let aiSettingsRepo: AISettingsRepository;
  let characterStateService: CharacterStateService;
  let reminderService: BackendReminderService;
  let registry: ToolRegistry;
  let mockProvider: MockAIProvider;
  let conversationService: ConversationService;
  let mockWindow: any;
  let stateHistory: string[];

  beforeEach(() => {
    db = new AppuDatabase(':memory:');
    const raw = db.getRawDatabase();
    reminderRepo = new ReminderRepository(raw);
    memoryRepo = new MemoryRepository(raw);
    conversationRepo = new ConversationRepository(raw);
    aiSettingsRepo = new AISettingsRepository(raw);

    mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: vi.fn(),
      },
    };

    stateHistory = [];
    characterStateService = new CharacterStateService(() => mockWindow);
    characterStateService.subscribe((evt) => {
      stateHistory.push(evt.state);
    });

    reminderService = new BackendReminderService(reminderRepo, () => mockWindow);
    registry = new ToolRegistry();
    createReminderTools(reminderService).forEach((t) => registry.register(t));
    createMemoryTools(memoryRepo).forEach((t) => registry.register(t));

    mockProvider = new MockAIProvider();

    conversationService = new ConversationService(
      mockProvider,
      registry,
      conversationRepo,
      memoryRepo,
      aiSettingsRepo,
      characterStateService
    );
  });

  afterEach(() => {
    reminderService.stopScheduler();
    db.close();
  });

  it('handles standard conversational question without tool calls', async () => {
    mockProvider.mockResponses = [
      async () => ({ text: "I'm doing well! How can I help you today?" }),
    ];

    const result = await conversationService.processUserMessage({
      text: 'Hey Appu, how are you?',
    });

    expect(result.response).toBe("I'm doing well! How can I help you today?");
    expect(mockProvider.callCount).toBe(1);

    // State transitions: listening -> thinking -> responding
    expect(stateHistory).toContain('listening');
    expect(stateHistory).toContain('thinking');
    expect(stateHistory).toContain('responding');

    // Messages persisted in SQLite
    const msgs = conversationRepo.getMessages(result.conversationId);
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
  });

  it('executes tool call, feeds results back, and returns final response', async () => {
    // 1st round: Gemini decides to call create_reminder
    // 2nd round: Gemini receives tool result and confirms to user
    mockProvider.mockResponses = [
      async () => ({
        text: '',
        toolCalls: [
          {
            id: 'call_123',
            name: 'create_reminder',
            args: {
              title: 'Drink water',
              recurrence: 'interval',
              recurrence_interval: 30,
              recurrence_unit: 'minutes',
            },
          },
        ],
      }),
      async (req) => {
        // Verify tool message was included in request
        const toolMsg = req.messages.find((m) => m.role === 'tool');
        expect(toolMsg).toBeDefined();
        expect(toolMsg?.toolResults?.[0].result.success).toBe(true);

        return {
          text: "Sure! I've set a reminder for you to drink water every 30 minutes.",
        };
      },
    ];

    const result = await conversationService.processUserMessage({
      text: 'Remind me to drink water every 30 minutes',
    });

    expect(result.response).toContain('drink water every 30 minutes');
    expect(mockProvider.callCount).toBe(2);
    expect(result.toolCallsExecuted?.length).toBe(1);
    expect(result.toolCallsExecuted?.[0].name).toBe('create_reminder');

    // Verify reminder is now actually stored in SQLite
    const reminders = reminderRepo.getAll();
    expect(reminders.length).toBe(1);
    expect(reminders[0].title).toBe('Drink water');

    // Verify state transitioned through 'executing'
    expect(stateHistory).toContain('executing');
  });

  it('prevents infinite recursion by enforcing maxToolRounds limit', async () => {
    // AI provider endlessly keeps calling tools
    mockProvider.mockResponses = Array(10).fill(async () => ({
      text: '',
      toolCalls: [
        {
          id: `infinite_${Math.random()}`,
          name: 'save_memory',
          args: { content: 'Loop fact' },
        },
      ],
    }));

    const result = await conversationService.processUserMessage({
      text: 'Trigger loop',
    });

    // 5 tool rounds, then one tool-free call to summarize what actually happened
    expect(mockProvider.callCount).toBe(6);
    expect(result.response).toBeTruthy();
    expect(result.response).not.toMatch(/completed the requested operations/i);
  });
});
