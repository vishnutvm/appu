"""
Long-term memories: facts and preferences the user explicitly asked Appu to keep.
"""

from datetime import datetime
from pathlib import Path
import re
from typing import Dict, List, Optional

import db

KINDS = ("fact", "preference", "person", "project")
MAX_CONTENT = 500


def _row(row) -> Dict:
    return {
        "id": row["id"],
        "content": row["content"],
        "kind": row["kind"],
        "source": row["source"],
        "created_at": row["created_at"],
        "saved_on": datetime.fromtimestamp(row["created_at"]).strftime("%a %d %b %Y"),
        "use_count": row["use_count"],
    }


def _dedupe_key(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def remember(content: str, kind: str = "fact", source: str = "user said", db_path: Optional[Path] = None) -> Dict:
    text = " ".join(content.split())
    if not text:
        raise ValueError("Nothing to remember.")
    if len(text) > MAX_CONTENT:
        raise ValueError(f"Memory is too long (max {MAX_CONTENT} characters).")
    if kind not in KINDS:
        kind = "fact"
    conn = db.connect(db_path)
    try:
        key = _dedupe_key(text)
        for row in conn.execute("SELECT * FROM memories"):
            if _dedupe_key(row["content"]) == key:
                return _row(row)
        cur = conn.execute(
            "INSERT INTO memories (content, kind, source, created_at) VALUES (?, ?, ?, ?)",
            (text, kind, source, db.now()),
        )
        conn.commit()
        return _row(conn.execute("SELECT * FROM memories WHERE id = ?", (cur.lastrowid,)).fetchone())
    finally:
        conn.close()


def recall(query: str, limit: int = 5, touch: bool = True, db_path: Optional[Path] = None) -> List[Dict]:
    """Keyword search (FTS5, BM25 ranking). Marks returned memories as used."""
    match = db.fts_query(query)
    if not match:
        return []
    conn = db.connect(db_path)
    try:
        rows = conn.execute(
            """
            SELECT m.* FROM memories_fts f JOIN memories m ON m.id = f.rowid
            WHERE memories_fts MATCH ? ORDER BY bm25(memories_fts) LIMIT ?
            """,
            (match, limit),
        ).fetchall()
        if touch and rows:
            conn.executemany(
                "UPDATE memories SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?",
                [(db.now(), r["id"]) for r in rows],
            )
            conn.commit()
        return [_row(r) for r in rows]
    finally:
        conn.close()


def profile(limit: int = 10, db_path: Optional[Path] = None) -> List[Dict]:
    """The most used (then most recent) memories: always included in the prompt."""
    conn = db.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT * FROM memories ORDER BY use_count DESC, created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_row(r) for r in rows]
    finally:
        conn.close()


def get(memory_id: int, db_path: Optional[Path] = None) -> Optional[Dict]:
    conn = db.connect(db_path)
    try:
        row = conn.execute("SELECT * FROM memories WHERE id = ?", (memory_id,)).fetchone()
        return _row(row) if row else None
    finally:
        conn.close()


def list_all(db_path: Optional[Path] = None) -> List[Dict]:
    conn = db.connect(db_path)
    try:
        return [_row(r) for r in conn.execute("SELECT * FROM memories ORDER BY created_at DESC").fetchall()]
    finally:
        conn.close()


def forget(memory_id: int, db_path: Optional[Path] = None) -> bool:
    conn = db.connect(db_path)
    try:
        deleted = conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,)).rowcount
        conn.commit()
        return deleted > 0
    finally:
        conn.close()


def prompt_block(user_message: str, db_path: Optional[Path] = None) -> str:
    """'What you know about the user' block: profile plus memories relevant to this message."""
    relevant = recall(user_message, limit=5, db_path=db_path)
    seen = {m["id"] for m in relevant}
    combined = relevant + [m for m in profile(db_path=db_path) if m["id"] not in seen]
    if not combined:
        return ""
    lines = [f"- (#{m['id']}, saved {m['saved_on']}) {m['content']}" for m in combined[:12]]
    return "What you know about the user (from memory; dates are when it was saved):\n" + "\n".join(lines)
