import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

export class AppuDatabase {
  private static instance: AppuDatabase | null = null;
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(dbPath);
    this.runMigrations();
  }

  public static getInstance(dbPath?: string): AppuDatabase {
    if (!AppuDatabase.instance) {
      AppuDatabase.instance = new AppuDatabase(dbPath);
    }
    return AppuDatabase.instance;
  }

  public getRawDatabase(): DatabaseSync {
    return this.db;
  }

  private runMigrations(): void {
    // Enable WAL mode for better concurrency and integrity
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');
    } catch (e) {
      // Memory db or unsupported pragma
    }

    // Ensure migrations table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    const appliedVersions = new Set<number>(
      (this.db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
        (r) => r.version
      )
    );

    const migrations = [
      {
        version: 1,
        name: 'initial_brain_schema',
        up: () => {
          // Check existing columns for backward compatibility with legacy databases
          let existingCols = new Set<string>();
          try {
            existingCols = new Set(
              (this.db.prepare('PRAGMA table_info(reminders)').all() as { name: string }[]).map((c) => c.name)
            );
          } catch {}

          if (existingCols.size > 0) {
            // Safely upgrade existing legacy table
            if (!existingCols.has('description')) this.db.exec('ALTER TABLE reminders ADD COLUMN description TEXT;');
            if (!existingCols.has('type')) this.db.exec("ALTER TABLE reminders ADD COLUMN type TEXT NOT NULL DEFAULT 'interval';");
            if (!existingCols.has('interval_minutes')) this.db.exec('ALTER TABLE reminders ADD COLUMN interval_minutes INTEGER;');
            if (!existingCols.has('specific_time')) this.db.exec('ALTER TABLE reminders ADD COLUMN specific_time TEXT;');
            if (!existingCols.has('specific_date')) this.db.exec('ALTER TABLE reminders ADD COLUMN specific_date TEXT;');
            if (!existingCols.has('next_trigger_at')) {
              this.db.exec('ALTER TABLE reminders ADD COLUMN next_trigger_at INTEGER NOT NULL DEFAULT 0;');
              if (existingCols.has('due_timestamp')) {
                this.db.exec('UPDATE reminders SET next_trigger_at = due_timestamp WHERE due_timestamp IS NOT NULL;');
              }
            }
            if (!existingCols.has('last_triggered_at')) this.db.exec('ALTER TABLE reminders ADD COLUMN last_triggered_at INTEGER;');
            if (!existingCols.has('enabled')) {
              this.db.exec('ALTER TABLE reminders ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;');
              if (existingCols.has('status')) {
                this.db.exec("UPDATE reminders SET enabled = 0 WHERE status = 'completed';");
              }
            }
            if (!existingCols.has('timezone')) this.db.exec('ALTER TABLE reminders ADD COLUMN timezone TEXT;');
            if (!existingCols.has('recurrence')) this.db.exec('ALTER TABLE reminders ADD COLUMN recurrence TEXT;');
            if (!existingCols.has('recurrence_interval')) this.db.exec('ALTER TABLE reminders ADD COLUMN recurrence_interval INTEGER;');
            if (!existingCols.has('recurrence_unit')) this.db.exec('ALTER TABLE reminders ADD COLUMN recurrence_unit TEXT;');
          } else {
            this.db.exec(`
              CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT NOT NULL,
                interval_minutes INTEGER,
                specific_time TEXT,
                specific_date TEXT,
                next_trigger_at INTEGER NOT NULL,
                last_triggered_at INTEGER,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                timezone TEXT,
                recurrence TEXT,
                recurrence_interval INTEGER,
                recurrence_unit TEXT
              );
            `);
          }

          // Check memories table for backward compatibility
          let existingMemCols = new Set<string>();
          try {
            existingMemCols = new Set(
              (this.db.prepare('PRAGMA table_info(memories)').all() as { name: string }[]).map((c) => c.name)
            );
          } catch {}

          if (existingMemCols.size > 0) {
            if (!existingMemCols.has('category')) {
              this.db.exec("ALTER TABLE memories ADD COLUMN category TEXT NOT NULL DEFAULT 'general';");
              if (existingMemCols.has('kind')) {
                this.db.exec('UPDATE memories SET category = kind WHERE kind IS NOT NULL;');
              }
            }
            if (!existingMemCols.has('importance')) {
              this.db.exec('ALTER TABLE memories ADD COLUMN importance INTEGER NOT NULL DEFAULT 1;');
            }
            if (!existingMemCols.has('metadata')) {
              this.db.exec('ALTER TABLE memories ADD COLUMN metadata TEXT;');
            }
            if (!existingMemCols.has('updated_at')) {
              this.db.exec('ALTER TABLE memories ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;');
              this.db.exec('UPDATE memories SET updated_at = created_at WHERE updated_at = 0;');
            }
          } else {
            this.db.exec(`
              CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                importance INTEGER NOT NULL DEFAULT 1,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
              );
            `);
          }

          // Check conversations table for backward compatibility
          let existingConvCols = new Set<string>();
          try {
            existingConvCols = new Set(
              (this.db.prepare('PRAGMA table_info(conversations)').all() as { name: string }[]).map((c) => c.name)
            );
          } catch {}

          if (existingConvCols.size > 0) {
            if (!existingConvCols.has('title')) {
              this.db.exec("ALTER TABLE conversations ADD COLUMN title TEXT NOT NULL DEFAULT 'Chat';");
            }
            if (!existingConvCols.has('created_at')) {
              this.db.exec('ALTER TABLE conversations ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;');
              if (existingConvCols.has('started_at')) {
                this.db.exec('UPDATE conversations SET created_at = started_at WHERE started_at IS NOT NULL;');
              }
            }
            if (!existingConvCols.has('updated_at')) {
              this.db.exec('ALTER TABLE conversations ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;');
              this.db.exec('UPDATE conversations SET updated_at = created_at WHERE updated_at = 0;');
            }
          } else {
            this.db.exec(`
              CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
              );
            `);
          }

          // Check messages table for backward compatibility
          let existingMsgCols = new Set<string>();
          try {
            existingMsgCols = new Set(
              (this.db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]).map((c) => c.name)
            );
          } catch {}

          if (existingMsgCols.size > 0) {
            if (!existingMsgCols.has('tool_calls')) this.db.exec('ALTER TABLE messages ADD COLUMN tool_calls TEXT;');
            if (!existingMsgCols.has('tool_results')) this.db.exec('ALTER TABLE messages ADD COLUMN tool_results TEXT;');
            if (!existingMsgCols.has('execution_status')) this.db.exec('ALTER TABLE messages ADD COLUMN execution_status TEXT;');
          } else {
            this.db.exec(`
              CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_calls TEXT,
                tool_results TEXT,
                execution_status TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
              );
            `);
          }

          this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_reminders_next_trigger ON reminders(next_trigger_at, enabled);
            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
            CREATE TABLE IF NOT EXISTS ai_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
          `);
        },
      },
      {
        version: 2,
        name: 'migrate_legacy_integer_ids_to_text',
        up: () => {
          this.db.exec('PRAGMA foreign_keys = OFF;');

          // 1. Messages table: convert INTEGER id and conversation_id to TEXT
          try {
            const msgInfo = this.db.prepare('PRAGMA table_info(messages)').all() as { name: string; type: string }[];
            const idCol = msgInfo.find((c) => c.name === 'id');
            if (idCol && idCol.type.toUpperCase() === 'INTEGER') {
              this.db.exec(`
                CREATE TABLE messages_v2 (
                  id TEXT PRIMARY KEY,
                  conversation_id TEXT NOT NULL,
                  role TEXT NOT NULL,
                  content TEXT NOT NULL,
                  tool_calls TEXT,
                  tool_results TEXT,
                  execution_status TEXT,
                  created_at INTEGER NOT NULL
                );
                INSERT INTO messages_v2 (id, conversation_id, role, content, tool_calls, tool_results, execution_status, created_at)
                SELECT CAST(id AS TEXT), CAST(conversation_id AS TEXT), role, content, tool_calls, tool_results, execution_status, CAST(created_at AS INTEGER)
                FROM messages;
                DROP TABLE messages;
                ALTER TABLE messages_v2 RENAME TO messages;
                CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
              `);
            }
          } catch (e) {
            console.warn('messages migration to v2 notice:', e);
          }

          // 2. Conversations table: convert INTEGER id to TEXT
          try {
            const convInfo = this.db.prepare('PRAGMA table_info(conversations)').all() as { name: string; type: string }[];
            const idCol = convInfo.find((c) => c.name === 'id');
            if (idCol && idCol.type.toUpperCase() === 'INTEGER') {
              this.db.exec(`
                CREATE TABLE conversations_v2 (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
                );
                INSERT INTO conversations_v2 (id, title, created_at, updated_at)
                SELECT CAST(id AS TEXT), COALESCE(title, 'Chat'), CAST(created_at AS INTEGER), CAST(updated_at AS INTEGER)
                FROM conversations;
                DROP TABLE conversations;
                ALTER TABLE conversations_v2 RENAME TO conversations;
              `);
            }
          } catch (e) {
            console.warn('conversations migration to v2 notice:', e);
          }

          // 3. Memories table: convert INTEGER id to TEXT
          try {
            const memInfo = this.db.prepare('PRAGMA table_info(memories)').all() as { name: string; type: string }[];
            const idCol = memInfo.find((c) => c.name === 'id');
            if (idCol && idCol.type.toUpperCase() === 'INTEGER') {
              this.db.exec(`
                DROP TABLE IF EXISTS memories_fts;
                CREATE TABLE memories_v2 (
                  id TEXT PRIMARY KEY,
                  content TEXT NOT NULL,
                  category TEXT NOT NULL DEFAULT 'general',
                  importance INTEGER NOT NULL DEFAULT 1,
                  metadata TEXT,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
                );
                INSERT INTO memories_v2 (id, content, category, importance, metadata, created_at, updated_at)
                SELECT CAST(id AS TEXT), content, COALESCE(category, 'general'), COALESCE(importance, 1), metadata, CAST(created_at AS INTEGER), CAST(COALESCE(updated_at, created_at) AS INTEGER)
                FROM memories;
                DROP TABLE memories;
                ALTER TABLE memories_v2 RENAME TO memories;
                CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
              `);
            }
          } catch (e) {
            console.warn('memories migration to v2 notice:', e);
          }

          // 4. Reminders table: convert INTEGER id to TEXT
          try {
            const remInfo = this.db.prepare('PRAGMA table_info(reminders)').all() as { name: string; type: string }[];
            const idCol = remInfo.find((c) => c.name === 'id');
            if (idCol && idCol.type.toUpperCase() === 'INTEGER') {
              this.db.exec(`
                CREATE TABLE reminders_v2 (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  description TEXT,
                  type TEXT NOT NULL DEFAULT 'interval',
                  interval_minutes INTEGER,
                  specific_time TEXT,
                  specific_date TEXT,
                  next_trigger_at INTEGER NOT NULL DEFAULT 0,
                  last_triggered_at INTEGER,
                  enabled INTEGER NOT NULL DEFAULT 1,
                  created_at INTEGER NOT NULL,
                  timezone TEXT,
                  recurrence TEXT,
                  recurrence_interval INTEGER,
                  recurrence_unit TEXT
                );
                INSERT INTO reminders_v2 (id, title, description, type, interval_minutes, specific_time, specific_date, next_trigger_at, last_triggered_at, enabled, created_at, timezone, recurrence, recurrence_interval, recurrence_unit)
                SELECT CAST(id AS TEXT), title, description, COALESCE(type, 'interval'), interval_minutes, specific_time, specific_date, COALESCE(next_trigger_at, 0), last_triggered_at, COALESCE(enabled, 1), CAST(created_at AS INTEGER), timezone, recurrence, recurrence_interval, recurrence_unit
                FROM reminders;
                DROP TABLE reminders;
                ALTER TABLE reminders_v2 RENAME TO reminders;
                CREATE INDEX IF NOT EXISTS idx_reminders_next_trigger ON reminders(next_trigger_at, enabled);
              `);
            }
          } catch (e) {
            console.warn('reminders migration to v2 notice:', e);
          }

          this.db.exec('PRAGMA foreign_keys = ON;');
        },
      },
    ];

    for (const m of migrations) {
      if (!appliedVersions.has(m.version)) {
        m.up();
        const stmt = this.db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        );
        stmt.run(m.version, m.name, Date.now());
      }
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }
}
