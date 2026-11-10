import { DatabaseSync } from 'node:sqlite';
import { ConversationRecord, MessageRecord } from '../schema';

export class ConversationRepository {
  constructor(private db: DatabaseSync) {}

  public getOrCreateLatestConversation(): ConversationRecord {
    const stmt = this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 1');
    const existing = stmt.get() as unknown as ConversationRecord;
    if (existing) {
      return existing;
    }

    const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const insertStmt = this.db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    insertStmt.run(newId, 'Chat with Appu', now, now);

    return {
      id: newId,
      title: 'Chat with Appu',
      created_at: now,
      updated_at: now,
    };
  }

  public getConversationById(id: string): ConversationRecord | null {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    const res = stmt.get(String(id));
    return (res as unknown as ConversationRecord) || null;
  }

  public createConversation(title: string = 'New Conversation'): ConversationRecord {
    const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const insertStmt = this.db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    insertStmt.run(String(newId), title, now, now);
    return {
      id: newId,
      title,
      created_at: now,
      updated_at: now,
    };
  }

  public touchConversation(id: string): void {
    const stmt = this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');
    stmt.run(Date.now(), String(id));
  }

  public addMessage(message: MessageRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, conversation_id, role, content, tool_calls, tool_results, execution_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      String(message.id),
      String(message.conversation_id),
      message.role,
      message.content,
      message.tool_calls || null,
      message.tool_results || null,
      message.execution_status || null,
      Number(message.created_at)
    );

    this.touchConversation(String(message.conversation_id));
  }

  public getMessages(conversationId: string, limit: number = 50): MessageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM (
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      ) ORDER BY created_at ASC
    `);

    return stmt.all(String(conversationId), limit) as unknown as MessageRecord[];
  }

  public searchMessages(query: string, limit: number = 20): MessageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(`%${query}%`, limit) as unknown as MessageRecord[];
  }

  public clearMessages(conversationId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    stmt.run(conversationId);
    this.touchConversation(conversationId);
  }

  public deleteConversation(conversationId: string): void {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
  }
}
