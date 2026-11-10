import { DatabaseSync } from 'node:sqlite';

export class AISettingsRepository {
  constructor(private db: DatabaseSync) {}

  public get(key: string, defaultValue: string = ''): string {
    const stmt = this.db.prepare('SELECT value FROM ai_settings WHERE key = ?');
    const res = stmt.get(key) as { value: string } | undefined;
    return res ? res.value : defaultValue;
  }

  public set(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO ai_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
  }

  public getAll(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM ai_settings');
    const rows = stmt.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
}
