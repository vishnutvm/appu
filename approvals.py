"""
Pending approvals for tools that must not run without the user's yes.

A CONFIRM tool call is parked here instead of running. The user answers with
the Yes/No card, or by saying/typing yes or no as their next message.
"""

from dataclasses import dataclass
import itertools
import re
import threading
import time
from typing import Dict, Optional

APPROVAL_TTL_SECONDS = 300

_YES = re.compile(r"^\s*(yes|yeah|yep|yup|sure|ok|okay|confirm|do it|go ahead|please do|correct)\b", re.I)
_NO = re.compile(r"^\s*(no|nope|nah|cancel|don'?t|do not|stop|never ?mind|keep it)\b", re.I)


def parse_answer(text: str) -> Optional[bool]:
    """True for yes, False for no, None if the message is something else."""
    words = text.strip()
    if len(words.split()) > 6:
        return None
    if _NO.match(words):
        return False
    if _YES.match(words):
        return True
    return None


@dataclass
class PendingApproval:
    id: int
    tool_name: str
    arguments: Dict
    prompt: str
    created_at: float

    def to_event(self) -> Dict:
        return {"id": self.id, "prompt": self.prompt, "tool": self.tool_name}


class Approvals:
    """Holds at most one pending approval: a new request replaces the old one."""

    def __init__(self):
        self._lock = threading.Lock()
        self._pending: Optional[PendingApproval] = None
        self._ids = itertools.count(1)

    def request(self, tool_name: str, arguments: Dict, prompt: str) -> PendingApproval:
        with self._lock:
            self._pending = PendingApproval(next(self._ids), tool_name, dict(arguments), prompt, time.time())
            return self._pending

    def pending(self) -> Optional[PendingApproval]:
        with self._lock:
            if self._pending and time.time() - self._pending.created_at > APPROVAL_TTL_SECONDS:
                self._pending = None
            return self._pending

    def take(self, approval_id: Optional[int] = None) -> Optional[PendingApproval]:
        """Remove and return the pending approval (if the id matches, when given)."""
        with self._lock:
            pending = self._pending
            if pending is None or (approval_id is not None and pending.id != approval_id):
                return None
            if time.time() - pending.created_at > APPROVAL_TTL_SECONDS:
                self._pending = None
                return None
            self._pending = None
            return pending

    def clear(self) -> None:
        with self._lock:
            self._pending = None


APPROVALS = Approvals()
