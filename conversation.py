"""
Conversation history for the current Appu session, optionally stored in data/appu.db.

The prompt gets the last N turns verbatim plus a rolling summary of the rest.
Past conversations keep only their summary in the prompt (to seed the next session);
their transcripts stay in the local DB until the retention period deletes them.
"""

from pathlib import Path
import threading
import time
from typing import Dict, List, Optional

MAX_TURNS = 12
MAX_HISTORY_CHARS = 12_000
INTERRUPTED_MARKER = " [interrupted by the user]"
SUMMARY_EVERY_TURNS = 10
DEFAULT_RETENTION_DAYS = 30


class Conversation:
    """Last N user/assistant turns, trimmed by turn count and total size."""

    def __init__(self, max_turns: int = MAX_TURNS, max_chars: int = MAX_HISTORY_CHARS,
                 persist: bool = False, db_path: Optional[Path] = None):
        self.max_turns = max_turns
        self.max_chars = max_chars
        self.persist = persist
        self.db_path = db_path
        self._turns: List[Dict[str, str]] = []
        self._lock = threading.Lock()
        self.conversation_id: Optional[int] = None
        self.total_turns = 0
        self.rolling_summary: Optional[str] = None
        self.last_groups: List[str] = []

    def add_turn(self, user: str, assistant: str, interrupted: bool = False, groups=()) -> None:
        reply = assistant.strip()
        if interrupted:
            reply = (reply + INTERRUPTED_MARKER).strip()
        with self._lock:
            self._turns.append({"user": user.strip(), "assistant": reply})
            self._trim_locked()
            self.total_turns += 1
            self.last_groups = list(groups)
        if self.persist:
            self._store(user.strip(), reply)

    def mark_last_interrupted(self) -> None:
        """The user cut Appu off while the last reply was still being spoken."""
        with self._lock:
            if self._turns and not self._turns[-1]["assistant"].endswith(INTERRUPTED_MARKER):
                self._turns[-1]["assistant"] += INTERRUPTED_MARKER

    def _trim_locked(self) -> None:
        del self._turns[:-self.max_turns]
        while len(self._turns) > 1 and self._size_locked() > self.max_chars:
            self._turns.pop(0)

    def _size_locked(self) -> int:
        return sum(len(t["user"]) + len(t["assistant"]) for t in self._turns)

    def messages(self) -> List[Dict[str, str]]:
        """History as chat messages, oldest first, ready to put between system and user."""
        with self._lock:
            out = []
            for turn in self._turns:
                out.append({"role": "user", "content": turn["user"]})
                out.append({"role": "assistant", "content": turn["assistant"]})
            return out

    def transcript(self) -> str:
        with self._lock:
            return "\n".join(f"User: {t['user']}\nAppu: {t['assistant']}" for t in self._turns)

    def turn_count(self) -> int:
        with self._lock:
            return len(self._turns)

    def needs_summary(self) -> bool:
        return self.total_turns > 0 and self.total_turns % SUMMARY_EVERY_TURNS == 0

    def clear(self) -> Optional[int]:
        """Start a new conversation. Returns the id of the one that ended (if stored)."""
        with self._lock:
            self._turns.clear()
            ended = self.conversation_id
            self.conversation_id = None
            self.total_turns = 0
            self.rolling_summary = None
            self.last_groups = []
        if self.persist and ended is not None:
            _end_conversation(ended, self.db_path)
        return ended

    def _store(self, user: str, reply: str) -> None:
        import db
        conn = db.connect(self.db_path)
        try:
            if self.conversation_id is None:
                cur = conn.execute("INSERT INTO conversations (started_at) VALUES (?)", (time.time(),))
                self.conversation_id = cur.lastrowid
            ts = time.time()
            conn.executemany(
                "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                [(self.conversation_id, "user", user, ts), (self.conversation_id, "assistant", reply, ts)],
            )
            conn.commit()
        finally:
            conn.close()


def _end_conversation(conversation_id: int, db_path: Optional[Path]) -> None:
    import db
    conn = db.connect(db_path)
    try:
        conn.execute("UPDATE conversations SET ended_at = ? WHERE id = ?", (time.time(), conversation_id))
        conn.commit()
    finally:
        conn.close()


def save_summary(conversation_id: int, summary: str, db_path: Optional[Path] = None) -> None:
    import db
    conn = db.connect(db_path)
    try:
        conn.execute("UPDATE conversations SET summary = ? WHERE id = ?", (summary.strip(), conversation_id))
        conn.commit()
    finally:
        conn.close()


def last_summary(exclude_id: Optional[int] = None, db_path: Optional[Path] = None) -> Optional[Dict]:
    """Most recent summary of a previous conversation, to seed a new session."""
    import db
    conn = db.connect(db_path)
    try:
        row = conn.execute(
            """
            SELECT id, started_at, summary FROM conversations
            WHERE summary IS NOT NULL AND summary != '' AND id IS NOT ?
            ORDER BY started_at DESC LIMIT 1
            """,
            (exclude_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def conversation_transcript(conversation_id: int, db_path: Optional[Path] = None) -> str:
    import db
    conn = db.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id", (conversation_id,)
        ).fetchall()
        return "\n".join(f"{'User' if r['role'] == 'user' else 'Appu'}: {r['content']}" for r in rows)
    finally:
        conn.close()


def purge_older_than(days: int, db_path: Optional[Path] = None) -> int:
    """Delete conversations (and their messages) that started more than `days` ago."""
    import db
    cutoff = time.time() - days * 86400
    conn = db.connect(db_path)
    try:
        deleted = conn.execute("DELETE FROM conversations WHERE started_at < ?", (cutoff,)).rowcount
        conn.commit()
        return deleted
    finally:
        conn.close()
