"""
Tasks: things the user needs to do (a reminder is "alert me at X"; a task is "do X").
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import db
from reminders import parse_due_date

STATUSES = ("open", "doing", "done", "dropped")
ACTIVE = ("open", "doing")
FILTERS = ("today", "overdue", "upcoming", "open", "done", "all")
PRIORITY_NAMES = {1: "high", 2: "normal", 3: "low"}


def _format_due(due_at: float) -> str:
    when = datetime.fromtimestamp(due_at)
    if (when.hour, when.minute) == (23, 59):  # date-only due (see parse_due_date)
        return when.strftime("%a %d %b")
    return when.strftime("%a %d %b %H:%M")


def _row(row) -> Dict:
    due = row["due_at"]
    return {
        "id": row["id"],
        "title": row["title"],
        "notes": row["notes"],
        "status": row["status"],
        "priority": row["priority"],
        "priority_name": PRIORITY_NAMES[row["priority"]],
        "due_at": due,
        "due": _format_due(due) if due else None,
        "project": row["project"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _day_bounds(now: datetime) -> tuple[float, float]:
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.timestamp(), (start + timedelta(days=1)).timestamp()


def add_task(
    title: str,
    due: Optional[str] = None,
    priority: int = 2,
    project: Optional[str] = None,
    notes: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Dict:
    clean = " ".join(title.split())
    if not clean:
        raise ValueError("Task title cannot be empty.")
    if priority not in PRIORITY_NAMES:
        raise ValueError("Priority must be 1 (high), 2 (normal) or 3 (low).")
    due_at = parse_due_date(due)[0] if due else None
    ts = db.now()
    conn = db.connect(db_path)
    try:
        cur = conn.execute(
            """
            INSERT INTO tasks (title, notes, status, priority, due_at, project, created_at, updated_at)
            VALUES (?, ?, 'open', ?, ?, ?, ?, ?)
            """,
            (clean, notes, priority, due_at, project, ts, ts),
        )
        conn.commit()
        return _row(conn.execute("SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone())
    finally:
        conn.close()


def list_tasks(filter: str = "open", project: Optional[str] = None, now: Optional[datetime] = None,
               db_path: Optional[Path] = None) -> List[Dict]:
    if filter not in FILTERS:
        raise ValueError(f"Filter must be one of: {', '.join(FILTERS)}.")
    now = now or datetime.now()
    day_start, day_end = _day_bounds(now)
    where, params = [], []
    if filter in ("today", "overdue", "upcoming", "open"):
        where.append("status IN ('open', 'doing')")
    if filter == "today":
        where.append("due_at IS NOT NULL AND due_at < ?")  # due today, or overdue and still open
        params.append(day_end)
    elif filter == "overdue":
        where.append("due_at IS NOT NULL AND due_at < ?")
        params.append(now.timestamp())
    elif filter == "upcoming":
        where.append("due_at IS NOT NULL AND due_at >= ?")
        params.append(day_end)
    elif filter == "done":
        where.append("status = 'done'")
    if project:
        where.append("lower(project) = lower(?)")
        params.append(project)
    sql = "SELECT * FROM tasks"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY due_at IS NULL, due_at, priority, created_at"
    conn = db.connect(db_path)
    try:
        return [_row(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def get_task(task_id: int, db_path: Optional[Path] = None) -> Optional[Dict]:
    conn = db.connect(db_path)
    try:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return _row(row) if row else None
    finally:
        conn.close()


def update_task(
    task_id: int,
    status: Optional[str] = None,
    due: Optional[str] = None,
    priority: Optional[int] = None,
    title: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Optional[Dict]:
    """Returns the updated task, or None if it does not exist."""
    sets, params = [], []
    if status is not None:
        if status not in STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(STATUSES)}.")
        sets.append("status = ?")
        params.append(status)
        sets.append("completed_at = ?")
        params.append(db.now() if status == "done" else None)
    if due is not None:
        sets.append("due_at = ?")
        params.append(None if due.strip().lower() in ("", "none", "no date") else parse_due_date(due)[0])
    if priority is not None:
        if priority not in PRIORITY_NAMES:
            raise ValueError("Priority must be 1 (high), 2 (normal) or 3 (low).")
        sets.append("priority = ?")
        params.append(priority)
    if title is not None and title.strip():
        sets.append("title = ?")
        params.append(" ".join(title.split()))
    if not sets:
        raise ValueError("Nothing to update.")
    sets.append("updated_at = ?")
    params.append(db.now())
    conn = db.connect(db_path)
    try:
        updated = conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", (*params, task_id)).rowcount
        conn.commit()
        if not updated:
            return None
        return _row(conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())
    finally:
        conn.close()


def search(query: str, limit: int = 5, db_path: Optional[Path] = None) -> List[Dict]:
    match = db.fts_query(query)
    if not match:
        return []
    conn = db.connect(db_path)
    try:
        rows = conn.execute(
            """
            SELECT t.* FROM tasks_fts f JOIN tasks t ON t.id = f.rowid
            WHERE tasks_fts MATCH ? AND t.status IN ('open', 'doing')
            ORDER BY bm25(tasks_fts) LIMIT ?
            """,
            (match, limit),
        ).fetchall()
        return [_row(r) for r in rows]
    finally:
        conn.close()


def format_task(task: Dict) -> str:
    parts = [f"#{task['id']} {task['title']}"]
    if task["due"]:
        parts.append(f"due {task['due']}")
    if task["priority"] != 2:
        parts.append(f"{task['priority_name']} priority")
    if task["project"]:
        parts.append(f"project {task['project']}")
    if task["status"] not in ("open",):
        parts.append(task["status"])
    return ", ".join(parts)
