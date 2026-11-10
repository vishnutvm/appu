import { ToolDefinition } from '../types';
import { MemoryRepository } from '../../database/repositories/memory-repository';

export function createMemoryTools(memoryRepo: MemoryRepository): ToolDefinition[] {
  const saveMemoryTool: ToolDefinition = {
    name: 'save_memory',
    description:
      'Saves a meaningful fact, user preference, project detail, or piece of knowledge that the user asked to remember. Persists across restarts in SQLite.',
    parameters: {
      type: 'OBJECT',
      properties: {
        content: {
          type: 'STRING',
          description: 'The core fact, preference, or information to remember (e.g. "User is working on a project called Genie")',
        },
        category: {
          type: 'STRING',
          description: 'Category for the memory (e.g. project, preference, profile, work, personal)',
        },
        importance: {
          type: 'INTEGER',
          description: 'Importance rating from 1 (minor) to 5 (critical)',
        },
        metadata: {
          type: 'STRING',
          description: 'Optional extra notes about this memory',
        },
      },
      required: ['content'],
    },
    validate: (args) => {
      if (!args.content || typeof args.content !== 'string' || !args.content.trim()) {
        return { valid: false, error: 'Memory content must be a non-empty string.' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const saved = memoryRepo.insert({
        content: args.content,
        category: args.category || 'general',
        importance: Number(args.importance) || 1,
        metadata: args.metadata ? { notes: String(args.metadata) } : undefined,
      });

      return {
        success: true,
        memory_id: saved.id,
        content: saved.content,
        category: saved.category,
        message: `Saved into persistent memory: "${saved.content}"`,
      };
    },
  };

  const searchMemoryTool: ToolDefinition = {
    name: 'search_memory',
    description:
      'Searches stored persistent memories by keyword query or category. Use when answering questions about user preferences, previous facts, or project details.',
    isReadOnly: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Keyword search query (e.g. "project", "work hours", "Genie")',
        },
        category: {
          type: 'STRING',
          description: 'Optional category filter',
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of memories to return (default 10)',
        },
      },
      required: ['query'],
    },
    validate: (args) => {
      if (typeof args.query !== 'string') {
        return { valid: false, error: 'query must be a string' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const limit = args.limit ? Math.min(25, Math.max(1, Number(args.limit))) : 10;
      const memories = memoryRepo.search(args.query.trim(), args.category, limit);

      return {
        total: memories.length,
        memories: memories.map((m) => ({
          id: m.id,
          content: m.content,
          category: m.category,
          importance: m.importance,
          created_at: new Date(m.created_at).toLocaleDateString(),
        })),
      };
    },
  };

  const updateMemoryTool: ToolDefinition = {
    name: 'update_memory',
    description: 'Updates an existing memory with corrected or updated content.',
    parameters: {
      type: 'OBJECT',
      properties: {
        memory_id: {
          type: 'STRING',
          description: 'ID of the memory to update',
        },
        updated_content: {
          type: 'STRING',
          description: 'The new corrected content to store',
        },
      },
      required: ['memory_id', 'updated_content'],
    },
    validate: (args) => {
      if (!args.memory_id || typeof args.memory_id !== 'string') {
        return { valid: false, error: 'memory_id is required' };
      }
      if (!args.updated_content || typeof args.updated_content !== 'string' || !args.updated_content.trim()) {
        return { valid: false, error: 'updated_content must be a non-empty string' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const updated = memoryRepo.update(args.memory_id, args.updated_content);
      if (!updated) {
        return { success: false, error: `Memory '${args.memory_id}' not found.` };
      }
      return {
        success: true,
        memory: {
          id: updated.id,
          content: updated.content,
          category: updated.category,
        },
        message: 'Memory successfully updated.',
      };
    },
  };

  const deleteMemoryTool: ToolDefinition = {
    name: 'delete_memory',
    description: 'Permanently deletes a stored memory by ID. Ask the user to confirm first, then call with confirmed=true.',
    requiresConfirmation: true,
    parameters: {
      type: 'OBJECT',
      properties: {
        memory_id: {
          type: 'STRING',
          description: 'ID of the memory to delete',
        },
        confirmed: {
          type: 'BOOLEAN',
          description: 'true only after the user explicitly confirmed this deletion',
        },
      },
      required: ['memory_id'],
    },
    validate: (args) => {
      if (!args.memory_id || typeof args.memory_id !== 'string') {
        return { valid: false, error: 'memory_id is required' };
      }
      return { valid: true };
    },
    execute: async (args) => {
      const success = memoryRepo.delete(args.memory_id);
      if (!success) {
        return { success: false, error: `Memory '${args.memory_id}' was not found.` };
      }
      return { success: true, memory_id: args.memory_id, message: 'Memory deleted.' };
    },
  };

  return [saveMemoryTool, searchMemoryTool, updateMemoryTool, deleteMemoryTool];
}
