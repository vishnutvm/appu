"""
Appu's local SQLite database (data/appu.db): reminders, tasks, memories,
conversations and small settings. Everything Appu stores lives here.
"""

import os
from pathlib import Path
import sqlite3
import threading
import time
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_DB_PATH = DATA_DIR / "appu.db"
LEGACY_REMINDERS_DB = DATA_DIR / "reminders.db"

_init_lock = threading.Lock()
_initialised: set = set()

SCHEMA = """
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due_timestamp REAL NOT NULL,
    due_time_str TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'notified', 'completed', 'cancelled')),
    notified INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'doing', 'done', 'dropped')),
    priority INTEGER NOT NULL DEFAULT 2 CHECK(priority IN (1, 2, 3)),
    due_at REAL,
    project TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    completed_at REAL
);

CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('fact', 'preference', 'person', 'project')),
    source TEXT NOT NULL DEFAULT 'user said',
    created_at REAL NOT NULL,
    last_used_at REAL,
    use_count INTEGER NOT NULL DEFAULT 0,
    embedding BLOB
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content, content='memories', content_rowid='id', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE OF content ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
    INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title, content='tasks', content_rowid='id', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title) VALUES (new.id, new.title);
END;
CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title) VALUES ('delete', old.id, old.title);
END;
CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE OF title ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title) VALUES ('delete', old.id, old.title);
    INSERT INTO tasks_fts(rowid, title) VALUES (new.id, new.title);
END;

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at REAL NOT NULL,
    ended_at REAL,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def get_db_path() -> Path:
    path = Path(os.environ.get("APPU_DB_PATH") or DEFAULT_DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def connect(db_path: Optional[Path] = None) -> sqlite3.Connection:
    path = Path(db_path or get_db_path())
    _ensure_schema(path)
    return _raw_connect(path)


def _raw_connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def _ensure_schema(path: Path) -> None:
    key = str(path.resolve())
    if key in _initialised and path.exists():
        return
    with _init_lock:
        if key in _initialised and path.exists():
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = _raw_connect(path)
        try:
            conn.executescript(SCHEMA)
            _add_missing_columns(conn)
            conn.commit()
        finally:
            conn.close()
        if path.resolve() == DEFAULT_DB_PATH.resolve():
            migrate_legacy_reminders(path)
        _initialised.add(key)


def _add_missing_columns(conn: sqlite3.Connection) -> None:
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(reminders)")}
    if "task_id" not in columns:
        conn.execute("ALTER TABLE reminders ADD COLUMN task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL")


def migrate_legacy_reminders(path: Path, legacy: Path = LEGACY_REMINDERS_DB) -> int:
    """Copy reminders from the old data/reminders.db once, then rename it. Returns rows copied."""
    if not legacy.exists():
        return 0
    conn = _raw_connect(path)
    try:
        if conn.execute("SELECT COUNT(*) FROM reminders").fetchone()[0] > 0:
            return 0
        conn.execute("ATTACH DATABASE ? AS legacy", (str(legacy),))
        try:
            copied = conn.execute(
                """
                INSERT INTO reminders (id, title, due_timestamp, due_time_str, status, notified, created_at)
                SELECT id, title, due_timestamp, due_time_str, status, notified, created_at FROM legacy.reminders
                """
            ).rowcount
            conn.commit()
        finally:
            conn.execute("DETACH DATABASE legacy")
    finally:
        conn.close()
    legacy.rename(legacy.with_name(legacy.name + ".migrated"))
    return copied


def get_setting(key: str, default: Optional[str] = None, db_path: Optional[Path] = None) -> Optional[str]:
    conn = connect(db_path)
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default
    finally:
        conn.close()


def set_setting(key: str, value: str, db_path: Optional[Path] = None) -> None:
    conn = connect(db_path)
    try:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


def fts_query(text: str) -> Optional[str]:
    """Turn free text into a safe FTS5 OR-query of its meaningful words."""
    import re
    words = [w for w in re.findall(r"[a-zA-Z0-9]+", text.lower()) if w not in STOPWORDS and len(w) > 1]
    if not words:
        return None
    return " OR ".join(f'"{w}"' for w in dict.fromkeys(words))


STOPWORDS = frozenset("""
a an the and or but if then so to of in on at for from by with about as is are was were be been am
i me my mine you your yours we our it its this that these those what which who whom how when where why
do does did done have has had can could would should will shall may might must not no yes please
appu hey hi hello just tell show give get let lets know remember recall forget anything something
""".split())


def now() -> float:
    return time.time()
