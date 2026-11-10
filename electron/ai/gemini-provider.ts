import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  ConversationRequest,
  ConversationResponse,
  ProviderStatus,
  ToolCall,
  ToolDefinition,
} from './types';
import { CredentialService } from '../services/credential-service';

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Gemini rejects OBJECT schemas whose `properties` map is empty. Drops such
 * nodes (returns undefined) so no-arg tools and free-form objects stay valid.
 */
export function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const isObject = String(schema.type || '').toUpperCase() === 'OBJECT';
  if (!isObject) {
    if (schema.items) return { ...schema, items: sanitizeSchema(schema.items) ?? { type: 'STRING' } };
    return schema;
  }

  const properties: Record<string, any> = {};
  for (const [key, value] of Object.entries(schema.properties || {})) {
    const cleaned = sanitizeSchema(value);
    if (cleaned) properties[key] = cleaned;
  }
  if (Object.keys(properties).length === 0) return undefined;

  const required = Array.isArray(schema.required)
    ? schema.required.filter((key: string) => key in properties)
    : undefined;
  const out: any = { ...schema, properties };
  if (required && required.length > 0) out.required = required;
  else delete out.required;
  return out;
}

export class GeminiProvider implements AIProvider {
  private modelName: string;
  private credentialService: CredentialService;

  constructor(credentialService: CredentialService, modelName: string = DEFAULT_GEMINI_MODEL) {
    this.credentialService = credentialService;
    this.modelName = modelName;
  }

  public getProviderName(): string {
    return 'Google Gemini';
  }

  public getModelName(): string {
    return this.modelName;
  }

  public setModelName(model: string): void {
    if (model && model.trim()) {
      this.modelName = model.trim();
    }
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.credentialService.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Please set your API key in Settings or configure GEMINI_API_KEY in your environment.'
      );
    }
    return new GoogleGenAI({ apiKey });
  }

  public async sendMessage(request: ConversationRequest): Promise<ConversationResponse> {
    const ai = this.getClient();

    // Map conversation messages to GenAI contents format
    const contents: any[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        if (msg.rawParts && msg.rawParts.length > 0) {
          // Live multi-round tool execution: retain exact raw parts with thoughtSignature
          contents.push({
            role: 'model',
            parts: msg.rawParts,
          });
        } else if (msg.content) {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }],
          });
        }
      } else if (msg.role === 'tool') {
        if (msg.toolResults && msg.toolResults.length > 0) {
          const parts = msg.toolResults.map((tr) => ({
            functionResponse: {
              id: tr.toolCallId,
              name: tr.name,
              response: tr.error
                ? { error: tr.error }
                : { output: tr.result ?? { success: true } },
            },
          }));
          contents.push({
            role: 'user',
            parts,
          });
        }
      }
    }

    // Configure tools if provided
    let toolsConfig: any = undefined;
    if (request.tools && request.tools.length > 0) {
      toolsConfig = [
        {
          functionDeclarations: request.tools.map((t) => {
            const parameters = sanitizeSchema(t.parameters);
            return parameters
              ? { name: t.name, description: t.description, parameters }
              : { name: t.name, description: t.description };
          }),
        },
      ];
    }

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: request.systemInstruction,
          tools: toolsConfig,
          temperature: 0.7,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });

      const text = response.text || '';
      const rawFunctionCalls = response.functionCalls || [];
      const candidateParts = response.candidates?.[0]?.content?.parts || [];
      const toolCalls: ToolCall[] = rawFunctionCalls.map((fc: any, index: number) => ({
        id: fc.id || `call_${Date.now()}_${index}`,
        name: fc.name || '',
        args: (fc.args as Record<string, any>) || {},
      }));

      return {
        text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        rawParts: candidateParts.length > 0 ? candidateParts : undefined,
      };
    } catch (err: any) {
      console.error('Gemini API call failed:', err);
      const errMsg = err?.message || String(err);

      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
        throw new Error(
          'Gemini API quota exceeded or rate limit reached. Please wait a moment before trying again.'
        );
      }
      if (errMsg.includes('403') || errMsg.includes('401') || errMsg.toLowerCase().includes('api_key') || errMsg.toLowerCase().includes('api key')) {
        throw new Error(
          'Invalid Gemini API key or permission denied. Please verify your API key in Settings.'
        );
      }
      if (
        errMsg.toLowerCase().includes('enotfound') ||
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('fetch failed') ||
        errMsg.toLowerCase().includes('econnrefused')
      ) {
        throw new Error(
          'Unable to reach Google Gemini servers. Please check your internet connection.'
        );
      }
      if (
        err?.name === 'TimeoutError' ||
        err?.name === 'AbortError' ||
        errMsg.toLowerCase().includes('timeout') ||
        errMsg.toLowerCase().includes('aborted')
      ) {
        throw new Error('Gemini request timed out. Please try again.');
      }

      throw new Error(`Gemini error: ${errMsg}`);
    }
  }

  public async getProviderStatus(): Promise<ProviderStatus> {
    const hasKey = this.credentialService.hasApiKey();
    return {
      provider: this.getProviderName(),
      available: hasKey,
      model: this.modelName,
      hasApiKey: hasKey,
    };
  }

  public async validateConfiguration(tools?: ToolDefinition[]): Promise<{ valid: boolean; error?: string }> {
    const hasKey = this.credentialService.hasApiKey();
    if (!hasKey) {
      return { valid: false, error: 'No API key configured.' };
    }

    try {
      // Ping with the real tool set so schema rejections surface here, not mid-chat
      await this.sendMessage({
        conversationId: 'connection-test',
        messages: [{ id: 'ping', conversationId: 'connection-test', role: 'user', content: 'Hi', createdAt: Date.now() }],
        tools,
      });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err) };
    }
  }
}
