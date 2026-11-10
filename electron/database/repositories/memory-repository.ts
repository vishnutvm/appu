import { DatabaseSync } from 'node:sqlite';
import { MemoryRecord } from '../schema';

export class MemoryRepository {
  constructor(private db: DatabaseSync) {}

  public getAll(limit: number = 100): MemoryRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM memories ORDER BY importance DESC, updated_at DESC LIMIT ?'
    );
    return stmt.all(limit) as unknown as MemoryRecord[];
  }

  public getById(id: string): MemoryRecord | null {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const res = stmt.get(id);
    return (res as unknown as MemoryRecord) || null;
  }

  public search(query: string, category?: string, limit: number = 10): MemoryRecord[] {
    if (category && category !== 'all') {
      const stmt = this.db.prepare(`
        SELECT * FROM memories
        WHERE category = ? AND content LIKE ?
        ORDER BY importance DESC, updated_at DESC
        LIMIT ?
      `);
      return stmt.all(category, `%${query}%`, limit) as unknown as MemoryRecord[];
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM memories
        WHERE content LIKE ?
        ORDER BY importance DESC, updated_at DESC
        LIMIT ?
      `);
      return stmt.all(`%${query}%`, limit) as unknown as MemoryRecord[];
    }
  }

  public insert(memory: {
    content: string;
    category?: string;
    importance?: number;
    metadata?: Record<string, any>;
  }): MemoryRecord {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const cat = (memory.category || 'general').trim().toLowerCase();
    const imp = Number.isFinite(memory.importance) ? Math.max(1, Math.min(5, Math.round(memory.importance as number))) : 1;
    const metaStr = memory.metadata ? JSON.stringify(memory.metadata) : null;

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, content, category, importance, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, memory.content.trim(), cat, imp, metaStr, now, now);

    return {
      id,
      content: memory.content.trim(),
      category: cat,
      importance: imp,
      metadata: metaStr,
      created_at: now,
      updated_at: now,
    };
  }

  public update(id: string, updatedContent: string): MemoryRecord | null {
    const current = this.getById(id);
    if (!current) return null;

    const now = Date.now();
    const stmt = this.db.prepare(
      'UPDATE memories SET content = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(updatedContent.trim(), now, id);

    return {
      ...current,
      content: updatedContent.trim(),
      updated_at: now,
    };
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    return Number((result as any)?.changes ?? 0) > 0;
  }

  public count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
    const res = stmt.get() as { count: number };
    return res?.count || 0;
  }
}
