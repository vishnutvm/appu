"""
In-memory conversation history for the current Appu session.
"""

import threading
from typing import Dict, List

MAX_TURNS = 12
MAX_HISTORY_CHARS = 12_000
INTERRUPTED_MARKER = " [interrupted by the user]"


class Conversation:
    """Last N user/assistant turns, trimmed by turn count and total size."""

    def __init__(self, max_turns: int = MAX_TURNS, max_chars: int = MAX_HISTORY_CHARS):
        self.max_turns = max_turns
        self.max_chars = max_chars
        self._turns: List[Dict[str, str]] = []
        self._lock = threading.Lock()

    def add_turn(self, user: str, assistant: str, interrupted: bool = False) -> None:
        reply = assistant.strip()
        if interrupted:
            reply = (reply + INTERRUPTED_MARKER).strip()
        with self._lock:
            self._turns.append({"user": user.strip(), "assistant": reply})
            self._trim_locked()

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

    def turn_count(self) -> int:
        with self._lock:
            return len(self._turns)

    def clear(self) -> None:
        with self._lock:
            self._turns.clear()
