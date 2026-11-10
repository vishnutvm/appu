import { DatabaseSync } from 'node:sqlite';
import { ReminderRecord } from '../schema';

export class ReminderRepository {
  constructor(private db: DatabaseSync) {}

  public getAll(): ReminderRecord[] {
    const stmt = this.db.prepare('SELECT * FROM reminders ORDER BY next_trigger_at ASC');
    return stmt.all() as unknown as ReminderRecord[];
  }

  public getById(id: string): ReminderRecord | null {
    const stmt = this.db.prepare('SELECT * FROM reminders WHERE id = ?');
    const result = stmt.get(id);
    return (result as unknown as ReminderRecord) || null;
  }

  public getPending(now: number = Date.now()): ReminderRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM reminders WHERE enabled = 1 AND next_trigger_at <= ? ORDER BY next_trigger_at ASC'
    );
    return stmt.all(now) as unknown as ReminderRecord[];
  }

  public getByDate(dateStr: string): ReminderRecord[] {
    // Matches specific_date or converts timestamp to local date prefix
    const stmt = this.db.prepare(
      "SELECT * FROM reminders WHERE specific_date = ? OR date(next_trigger_at / 1000, 'unixepoch', 'localtime') = ? ORDER BY next_trigger_at ASC"
    );
    return stmt.all(dateStr, dateStr) as unknown as ReminderRecord[];
  }

  public insert(reminder: ReminderRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO reminders (
        id, title, description, type, interval_minutes, specific_time,
        specific_date, next_trigger_at, last_triggered_at, enabled,
        created_at, timezone, recurrence, recurrence_interval, recurrence_unit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      reminder.id,
      reminder.title,
      reminder.description || null,
      reminder.type,
      reminder.interval_minutes ?? null,
      reminder.specific_time ?? null,
      reminder.specific_date ?? null,
      reminder.next_trigger_at,
      reminder.last_triggered_at ?? null,
      reminder.enabled,
      reminder.created_at,
      reminder.timezone ?? null,
      reminder.recurrence ?? null,
      reminder.recurrence_interval ?? null,
      reminder.recurrence_unit ?? null
    );
  }

  public update(id: string, updates: Partial<ReminderRecord>): ReminderRecord | null {
    const current = this.getById(id);
    if (!current) return null;

    const merged = { ...current, ...updates };
    const stmt = this.db.prepare(`
      UPDATE reminders SET
        title = ?, description = ?, type = ?, interval_minutes = ?,
        specific_time = ?, specific_date = ?, next_trigger_at = ?,
        last_triggered_at = ?, enabled = ?, timezone = ?,
        recurrence = ?, recurrence_interval = ?, recurrence_unit = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.title,
      merged.description ?? null,
      merged.type,
      merged.interval_minutes ?? null,
      merged.specific_time ?? null,
      merged.specific_date ?? null,
      merged.next_trigger_at,
      merged.last_triggered_at ?? null,
      merged.enabled,
      merged.timezone ?? null,
      merged.recurrence ?? null,
      merged.recurrence_interval ?? null,
      merged.recurrence_unit ?? null,
      id
    );

    return merged;
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM reminders WHERE id = ?');
    const result = stmt.run(id);
    return Number((result as any)?.changes ?? 0) > 0;
  }

  public deleteAll(): boolean {
    const stmt = this.db.prepare('DELETE FROM reminders');
    stmt.run();
    return true;
  }

  public count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM reminders WHERE enabled = 1');
    const res = stmt.get() as { count: number };
    return res?.count || 0;
  }
}
