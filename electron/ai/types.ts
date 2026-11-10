export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: any;
  error?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  executionStatus?: 'success' | 'error' | 'pending';
  rawParts?: any[];
  createdAt: number;
}

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolSchema {
  type: string; // usually 'OBJECT'
  /** Gemini rejects OBJECT schemas with an empty properties map; omit parameters for no-arg tools instead. */
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ExecutionContext {
  conversationId: string;
  now: number;
  timezone: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolSchema;
  isReadOnly?: boolean;
  /** Destructive tools only run when the model passes confirmed=true after asking the user. */
  requiresConfirmation?: boolean;
  validate?: (args: any) => { valid: boolean; error?: string };
  execute: (args: any, context: ExecutionContext) => Promise<any>;
}

export interface ConversationRequest {
  conversationId: string;
  messages: ChatMessage[];
  systemInstruction?: string;
  tools?: ToolDefinition[];
}

export interface ConversationResponse {
  text: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
  rawParts?: any[];
}

export interface ProviderStatus {
  provider: string;
  available: boolean;
  model: string;
  hasApiKey: boolean;
  error?: string;
}

export interface AIProvider {
  getProviderName(): string;
  getModelName(): string;
  setModelName(model: string): void;
  sendMessage(request: ConversationRequest): Promise<ConversationResponse>;
  getProviderStatus(): Promise<ProviderStatus>;
  validateConfiguration(tools?: ToolDefinition[]): Promise<{ valid: boolean; error?: string }>;
}
