import { ExecutionContext, ToolCall, ToolDefinition, ToolResult } from '../types';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public validateArgs(tool: ToolDefinition, args: any): { valid: boolean; error?: string } {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Arguments must be a valid JSON object' };
    }

    if (tool.parameters.required) {
      for (const requiredKey of tool.parameters.required) {
        if (args[requiredKey] === undefined || args[requiredKey] === null || args[requiredKey] === '') {
          return {
            valid: false,
            error: `Missing required parameter '${requiredKey}' for tool '${tool.name}'`,
          };
        }
      }
    }

    if (tool.validate) {
      return tool.validate(args);
    }

    return { valid: true };
  }

  public async executeToolCalls(
    calls: ToolCall[],
    context: ExecutionContext
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    // Separate into read-only and write tools
    const readCalls: ToolCall[] = [];
    const writeCalls: ToolCall[] = [];

    for (const call of calls) {
      const tool = this.tools.get(call.name);
      if (tool && tool.isReadOnly) {
        readCalls.push(call);
      } else {
        writeCalls.push(call);
      }
    }

    // Execute read-only tools concurrently
    const readResults = await Promise.all(
      readCalls.map(async (call) => this.executeSingleCall(call, context))
    );
    results.push(...readResults);

    // Execute write tools sequentially to prevent race conditions
    for (const call of writeCalls) {
      const res = await this.executeSingleCall(call, context);
      results.push(res);
    }

    // Preserve original call order
    const orderedResults: ToolResult[] = [];
    for (const call of calls) {
      const found = results.find((r) => r.toolCallId === call.id);
      if (found) {
        orderedResults.push(found);
      }
    }

    return orderedResults;
  }

  private async executeSingleCall(
    call: ToolCall,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        result: null,
        error: `Tool '${call.name}' is not registered or authorized.`,
      };
    }

    const validation = this.validateArgs(tool, call.args);
    if (!validation.valid) {
      return {
        toolCallId: call.id,
        name: call.name,
        result: null,
        error: validation.error || `Invalid arguments for tool '${call.name}'`,
      };
    }

    if (tool.requiresConfirmation && call.args?.confirmed !== true) {
      return {
        toolCallId: call.id,
        name: call.name,
        result: null,
        error:
          `'${call.name}' is destructive and was NOT executed. Ask the user to explicitly confirm, ` +
          `then call it again with confirmed=true.`,
      };
    }

    try {
      const result = await tool.execute(call.args, context);
      if (result && typeof result === 'object' && result.success === false) {
        return {
          toolCallId: call.id,
          name: call.name,
          result,
          error: String(result.error || `${call.name} reported a failure`),
        };
      }
      return {
        toolCallId: call.id,
        name: call.name,
        result: result ?? { success: true },
      };
    } catch (err: any) {
      console.error(`Tool execution error for '${call.name}':`, err);
      return {
        toolCallId: call.id,
        name: call.name,
        result: null,
        error: `Failed to execute ${call.name}: ${err?.message || String(err)}`,
      };
    }
  }
}
