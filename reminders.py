"""
APPU Reminders Engine — Local SQLite-backed reminder & task scheduler.
Provides persistent storage, due-time calculation, and background notification triggers.
"""

from datetime import datetime, timedelta
from pathlib import Path
import re
import sqlite3
import subprocess
import time
from typing import Any, Dict, List, Optional


DEFAULT_DB_PATH = Path.home() / "Developer" / "jarvis" / "data" / "reminders.db"


def get_db_path() -> Path:
    db_path = DEFAULT_DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def _get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    path = db_path or get_db_path()
    conn = sqlite3.connect(path, timeout=10.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def init_db(db_path: Optional[Path] = None) -> None:
    conn = _get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                due_timestamp REAL NOT NULL,
                due_time_str TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending', 'notified', 'completed', 'cancelled')),
                notified INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def parse_due_time(time_str: str) -> tuple[float, str]:
    """
    Parse relative time expressions (e.g., 'in 5 minutes', 'in 1 hour', 'in 30 seconds')
    or ISO formatted timestamps ('2026-10-27T18:00:00', '5:30 pm', 'tomorrow at 9am').
    Returns (epoch_timestamp, formatted_human_string).
    """
    now = datetime.now()
    clean_str = time_str.strip().lower()

    # Relative match: "in X seconds/minutes/hours/days"
    rel_match = re.match(r"^in\s+(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$", clean_str)
    if rel_match:
        qty = int(rel_match.group(1))
        unit = rel_match.group(2)
        if unit.startswith("s"):
            target = now + timedelta(seconds=qty)
        elif unit.startswith("m"):
            target = now + timedelta(minutes=qty)
        elif unit.startswith("h"):
            target = now + timedelta(hours=qty)
        elif unit.startswith("d"):
            target = now + timedelta(days=qty)
        else:
            raise ValueError(f"Unknown time unit: {unit}")

        return target.timestamp(), target.strftime("%Y-%m-%d %H:%M:%S")

    # Relative match: "X minutes/seconds/hours from now"
    from_now_match = re.match(r"^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours)\s+from\s+now$", clean_str)
    if from_now_match:
        qty = int(from_now_match.group(1))
        unit = from_now_match.group(2)
        if unit.startswith("s"):
            target = now + timedelta(seconds=qty)
        elif unit.startswith("m"):
            target = now + timedelta(minutes=qty)
        elif unit.startswith("h"):
            target = now + timedelta(hours=qty)
        else:
            raise ValueError(f"Unknown time unit: {unit}")

        return target.timestamp(), target.strftime("%Y-%m-%d %H:%M:%S")

    # Today match: "today", "today at 5pm", "today at 5:00 pm", "today 9am"
    if clean_str == "today":
        default_target = now.replace(hour=18, minute=0, second=0, microsecond=0)
        if default_target <= now:
            default_target = now + timedelta(hours=1)
        return default_target.timestamp(), default_target.strftime("%Y-%m-%d %H:%M:%S")

    today_match = re.match(r"^today(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$", clean_str)
    if today_match:
        hour = int(today_match.group(1))
        minute = int(today_match.group(2) or 0)
        meridiem = today_match.group(3)
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        return target.timestamp(), target.strftime("%Y-%m-%d %H:%M:%S")

    # Tomorrow match: "tomorrow at 5pm", "tomorrow at 09:00", "tomorrow 9am"
    tomorrow_match = re.match(r"^tomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$", clean_str)
    if tomorrow_match:
        hour = int(tomorrow_match.group(1))
        minute = int(tomorrow_match.group(2) or 0)
        meridiem = tomorrow_match.group(3)
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        target = (now + timedelta(days=1)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        return target.timestamp(), target.strftime("%Y-%m-%d %H:%M:%S")

    # 12-hour clock: "5pm", "5:30 pm", "11:00 am"
    clock_12_match = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$", clean_str)
    if clock_12_match:
        hour = int(clock_12_match.group(1))
        minute = int(clock_12_match.group(2) or 0)
        meridiem = clock_12_match.group(3)
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        return target.timestamp(), target.strftime("%Y-%m-%d %H:%M:%S")

    # Standard formats
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%I:%M %p",
        "%I:%M%p",
        "%I %p",
        "%I%p",
        "%H:%M:%S",
        "%H:%M",
    ):
        try:
            parsed = datetime.strptime(time_str.strip().upper(), fmt)
            if fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
                # Time today or tomorrow
                target = now.replace(
                    hour=parsed.hour,
                    minute=parsed.minute,
                    second=parsed.second if "%S" in fmt else 0,
                    microsecond=0,
                )
                if target <= now:
                    target += timedelta(days=1)
            else:
                target = parsed
            return target.timestamp(), target.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue

    raise ValueError(
        f"Could not parse due time: '{time_str}'. Use format like 'in 5 minutes', '5:30 pm', or 'YYYY-MM-DD HH:MM'."
    )


def create_reminder(title: str, due_time: str, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Create a new persistent reminder."""
    clean_title = title.strip()
    if not clean_title:
        raise ValueError("Reminder title cannot be empty.")

    due_timestamp, due_time_str = parse_due_time(due_time)
    created_at = time.time()
    init_db(db_path)

    conn = _get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO reminders (title, due_timestamp, due_time_str, status, notified, created_at)
            VALUES (?, ?, ?, 'pending', 0, ?)
            """,
            (clean_title, due_timestamp, due_time_str, created_at),
        )
        reminder_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    return {
        "id": reminder_id,
        "title": clean_title,
        "due_time": due_time_str,
        "status": "pending",
        "message": f"Reminder #{reminder_id} scheduled for {due_time_str}: '{clean_title}'",
    }


def list_reminders(status: Optional[str] = "pending", db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """List reminders with optional status filter ('pending', 'notified', 'completed', 'cancelled', or None for all)."""
    init_db(db_path)

    conn = _get_connection(db_path)
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if status:
            cursor.execute(
                "SELECT * FROM reminders WHERE status = ? ORDER BY due_timestamp ASC",
                (status,),
            )
        else:
            cursor.execute("SELECT * FROM reminders ORDER BY due_timestamp ASC")
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "due_time": row["due_time_str"],
                "due_timestamp": row["due_timestamp"],
                "status": row["status"],
                "notified": bool(row["notified"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def cancel_reminder(reminder_id: int, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Cancel a pending or notified reminder by ID."""
    if not isinstance(reminder_id, int):
        raise ValueError("Reminder ID must be an integer.")

    init_db(db_path)

    conn = _get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, status FROM reminders WHERE id = ?", (reminder_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": f"Reminder #{reminder_id} not found."}
        if row[2] not in ("pending", "notified"):
            return {
                "success": False,
                "message": f"Reminder #{reminder_id} is already {row[2]} and cannot be cancelled.",
            }

        cursor.execute("UPDATE reminders SET status = 'cancelled' WHERE id = ?", (reminder_id,))
        conn.commit()
        return {"success": True, "message": f"Cancelled reminder #{reminder_id}: '{row[1]}'"}
    finally:
        conn.close()


def complete_reminder(reminder_id: int, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Mark a reminder as completed."""
    if not isinstance(reminder_id, int):
        raise ValueError("Reminder ID must be an integer.")

    init_db(db_path)

    conn = _get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, status FROM reminders WHERE id = ?", (reminder_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": f"Reminder #{reminder_id} not found."}

        cursor.execute("UPDATE reminders SET status = 'completed' WHERE id = ?", (reminder_id,))
        conn.commit()
        return {"success": True, "message": f"Marked reminder #{reminder_id} as completed."}
    finally:
        conn.close()


def fetch_and_claim_due_reminders(current_time: Optional[float] = None, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Atomically query and claim all pending due reminders in a single write transaction.
    Marks them notified = 1 and status = 'notified' immediately so they are never returned twice.
    """
    now = current_time if current_time is not None else time.time()
    init_db(db_path)

    conn = _get_connection(db_path)
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE;")
        cursor.execute(
            """
            SELECT * FROM reminders
            WHERE status = 'pending' AND notified = 0 AND due_timestamp <= ?
            ORDER BY due_timestamp ASC
            """,
            (now,),
        )
        rows = cursor.fetchall()
        claimed = []
        for row in rows:
            cursor.execute(
                "UPDATE reminders SET notified = 1, status = 'notified' WHERE id = ?",
                (row["id"],),
            )
            claimed.append({
                "id": row["id"],
                "title": row["title"],
                "due_time": row["due_time_str"],
                "due_timestamp": row["due_timestamp"],
                "status": "notified",
            })
        conn.commit()
        return claimed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def send_macos_notification(title: str, message: str) -> bool:
    """Dispatch a native macOS banner notification via osascript without blocking, using safe argv."""
    apple_script = 'on run argv\n  display notification (item 2 of argv) with title (item 1 of argv)\nend run'
    try:
        subprocess.Popen(
            ["osascript", "-e", apple_script, title, message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False
