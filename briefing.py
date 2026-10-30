"""
Daily briefing and "what should I do next" suggestions, built from tasks and reminders.
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import db
import reminders
import tasks

STALE_DAYS = 3
COLLISION_MINUTES = 15
LAST_BRIEFING_KEY = "last_briefing_date"


def _pending_reminders(now: datetime, db_path: Optional[Path]) -> List[Dict]:
    items = reminders.list_reminders(status="pending", db_path=db_path)
    return [r for r in items if r["due_timestamp"] >= now.timestamp()]


def suggest_next(now: Optional[datetime] = None, db_path: Optional[Path] = None) -> Optional[str]:
    """One concrete suggestion: overdue work first, then stale high-priority tasks, then clashes."""
    now = now or datetime.now()
    overdue = tasks.list_tasks("overdue", now=now, db_path=db_path)
    if overdue:
        t = overdue[0]
        return f"\"{t['title']}\" is overdue (was due {t['due']}). Do it first, or move its date."

    open_tasks = tasks.list_tasks("open", now=now, db_path=db_path)
    stale_before = (now - timedelta(days=STALE_DAYS)).timestamp()
    stale = [t for t in open_tasks if t["updated_at"] < stale_before]
    stale.sort(key=lambda t: (t["priority"], t["updated_at"]))
    if stale:
        t = stale[0]
        days = int((now.timestamp() - t["updated_at"]) // 86400)
        return f"You haven't touched \"{t['title']}\" in {days} days."

    upcoming = _pending_reminders(now, db_path)
    for a, b in zip(upcoming, upcoming[1:]):
        if b["due_timestamp"] - a["due_timestamp"] <= COLLISION_MINUTES * 60:
            return f"Two reminders are close together: \"{a['title']}\" and \"{b['title']}\" around {a['due_time'][11:16]}."

    if open_tasks:
        t = sorted(open_tasks, key=lambda t: (t["priority"], t["due_at"] or float("inf")))[0]
        return f"Next up: \"{t['title']}\"."
    return None


def daily_briefing(now: Optional[datetime] = None, db_path: Optional[Path] = None) -> Dict:
    now = now or datetime.now()
    today_end = now.replace(hour=23, minute=59, second=59).timestamp()
    due_today = tasks.list_tasks("today", now=now, db_path=db_path)
    overdue = [t for t in due_today if t["due_at"] < now.replace(hour=0, minute=0, second=0).timestamp()]
    today_only = [t for t in due_today if t not in overdue]
    upcoming = _pending_reminders(now, db_path)
    reminders_today = [r for r in upcoming if r["due_timestamp"] <= today_end]
    next_reminder = upcoming[0] if upcoming else None
    suggestion = suggest_next(now, db_path)

    lines = [f"Briefing for {now.strftime('%A %d %B')}:"]
    lines.append(f"Tasks due today: {len(today_only)}" + (f", overdue: {len(overdue)}" if overdue else ""))
    for t in today_only + overdue:
        lines.append(f"- {tasks.format_task(t)}" + (" (OVERDUE)" if t in overdue else ""))
    if reminders_today:
        lines.append(f"Reminders today: {len(reminders_today)}")
        for r in reminders_today:
            lines.append(f"- {r['due_time'][11:16]} {r['title']}")
    elif next_reminder:
        lines.append(f"Next reminder: {next_reminder['title']} at {next_reminder['due_time']}")
    else:
        lines.append("No upcoming reminders.")
    if suggestion:
        lines.append(f"Suggestion: {suggestion}")

    db.set_setting(LAST_BRIEFING_KEY, now.strftime("%Y-%m-%d"), db_path=db_path)
    return {
        "today": today_only,
        "overdue": overdue,
        "reminders_today": reminders_today,
        "next_reminder": next_reminder,
        "suggestion": suggestion,
        "text": "\n".join(lines),
    }


def briefing_due(now: Optional[datetime] = None, db_path: Optional[Path] = None) -> bool:
    """True the first time Appu is opened on a given day."""
    now = now or datetime.now()
    return db.get_setting(LAST_BRIEFING_KEY, db_path=db_path) != now.strftime("%Y-%m-%d")
