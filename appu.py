#!/usr/bin/env python3
"""
APPU — Personal AI Assistant
Local assistant running on macOS with Ollama, Qwen, and Cybernetic HUD UI.
"""

import base64
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import threading
import time
from typing import Callable, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Ensure execution inside .venv so all local voice dependencies are accessible
_venv_dir = Path(__file__).resolve().parent / ".venv"
_venv_python = _venv_dir / "bin" / "python3"
if _venv_python.exists() and sys.prefix != str(_venv_dir):
    os.execv(str(_venv_python), [str(_venv_python)] + sys.argv)

from reminders import (
    fetch_and_claim_due_reminders,
    list_reminders,
    send_macos_notification,
)
from approvals import APPROVALS, parse_answer
import briefing
import conversation as conversation_store
from conversation import Conversation
import db
import memories
from stt import LOCAL_STT
import tools
from tools import ToolResult, run_tool
from turn import TURN_DETECTOR, decode_wav
from voice import KOKORO_VOICES, VOICE


# Configuration
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags"
MODEL = "qwen3.5:4b"
TIMEOUT_SECONDS = 120
MAX_INPUT_LENGTH = 4_000
MAX_TOOL_ROUNDS = 2
MAX_TOOL_CALLS = 3
# Spoken replies are kept short by the system prompt, not by truncation.
NUM_PREDICT = 1024
MAX_TTS_CHARS = 300
# 16 kHz 16-bit mono: 60 s of audio is ~1.9 MB.
MAX_TURN_AUDIO_BYTES = 2_000_000
SUMMARY_TIMEOUT_SECONDS = 60

# Appu — Personality and Behavior Specification
SYSTEM_PROMPT = """
You are Appu, a personal AI assistant running locally on the user's Mac. The user is Vishnu; when he says "I" or "my", he means himself, never you.

Your personality is friendly, intelligent, calm, curious, and dependable. You are a capable technical companion like FRIDAY or JARVIS.

Voice & Conversation Guidelines:
- You speak directly to the user aloud via a local neural voice system (Kokoro). You are an interactive voice assistant.
- Never claim that you do not have a voice, cannot speak, or lack audio features.
- Speak in natural, fluid sentences. Avoid robotic fragments.
- Start every reply with a short spoken answer: one or two plain sentences, no lists, code, or links.
- Only the first paragraph is read aloud. If more detail helps (lists, steps, code, links), put it after a blank line in Markdown; it is shown on screen, not spoken.
- You remember the earlier turns of this conversation; use them to resolve things like "the second one" or "do that again".
- Explain technical matters accurately and use appropriate technical terminology.
- Match the user's tone without copying spelling mistakes.
- For greetings, compliments, and casual conversation (e.g. "hi", "how are you", "who are you"), respond directly, warmly, and conversationally.

CRITICAL TOOL USAGE RULE:
- ONLY call open_project if the user EXPLICITLY asks to open a project or VS Code.
- A reminder is an alert at a time (create_reminder). A task is something to do, optionally due on a day (add_task). "Remind me at 5 to call mum" is a reminder; "I need to finish the report by Friday" is a task.
- Only call remember when the user asks you to remember something or states a lasting preference. Never store secrets or passwords.
- Use what you know about the user (below) when it is relevant, and say when a memory might be out of date.
- forget asks the user to confirm. When a tool says approval is required, ask the question and stop; nothing has changed yet.
- Never claim an action succeeded unless the tool confirms success.
- Tool access is strictly limited to registered tools and projects.
"""

EMOTIONS = {
    "neutral",
    "happy",
    "sad",
    "excited",
    "curious",
    "bored",
    "confused",
    "surprised",
    "confident",
    "serious",
    "playful",
    "empathetic",
}

ACTIVITIES = {
    "idle",
    "listening",
    "thinking",
    "speaking",
    "executing",
    "success",
    "approval_required",
    "needs_clarification",
    "error",
    "offline",
    "cancelled",
    "interrupted",
}

ACTIVITY_LABELS = {
    "idle": "READY",
    "listening": "LISTENING",
    "thinking": "THINKING",
    "speaking": "SPEAKING",
    "executing": "EXECUTING",
    "success": "COMPLETED",
    "approval_required": "APPROVAL REQUIRED",
    "needs_clarification": "NEEDS CLARIFICATION",
    "error": "ERROR",
    "offline": "OFFLINE",
    "cancelled": "CANCELLED",
    "interrupted": "INTERRUPTED",
}


def execute_tool(name: str, arguments: dict) -> str:
    return run_tool(name, arguments).text


def clean_terminal_text(text: str) -> str:
    """Convert common escaped Markdown into readable terminal text."""

    text = re.sub(r"\\([#*_\-`])", r"\1", text)
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", text)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"__(.*?)__", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"`([^`\n]+)`", r"\1", text)
    text = re.sub(r"(?m)^\s*[-+*]\s+", "  • ", text)

    return text.strip()


def check_ollama_status() -> bool:
    """Check if Ollama service is reachable and responsive."""
    try:
        request = Request(OLLAMA_TAGS_URL, method="GET")
        with urlopen(request, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def build_system_prompt(now: Optional[datetime] = None, context: str = "") -> str:
    now = now or datetime.now()
    clock = now.strftime("%A %d %B %Y, %I:%M %p").replace(" 0", " ")
    week = ", ".join((now + timedelta(days=d)).strftime("%A %d %b").replace(" 0", " ") for d in range(1, 8))
    prompt = f"{SYSTEM_PROMPT}\nCurrent local date and time: {clock}.\nThe next seven days: {week}.\n"
    return f"{prompt}\n{context.strip()}\n" if context.strip() else prompt


def build_context(user_message: str, conv: Optional[Conversation] = None) -> str:
    """Per-turn context: relevant memories, the last session's summary, and this session's rolling summary."""
    blocks = []
    try:
        block = memories.prompt_block(user_message)
        if block:
            blocks.append(block)
        if conv is not None:
            previous = conversation_store.last_summary(exclude_id=conv.conversation_id)
            if previous:
                when = datetime.fromtimestamp(previous["started_at"]).strftime("%A %d %B")
                blocks.append(f"Summary of your previous conversation ({when}):\n{previous['summary']}")
    except Exception as exc:
        print(f"[!] Could not load memory context: {exc}", file=sys.stderr)
    if conv is not None and conv.rolling_summary:
        blocks.append(f"Earlier in this conversation:\n{conv.rolling_summary}")
    return "\n\n".join(blocks)


class TurnInterrupted(Exception):
    """The user interrupted Appu mid-reply. `partial` is what had been generated."""

    def __init__(self, partial: str):
        super().__init__("Interrupted by the user.")
        self.partial = partial


def ask_local_model(
    user_message: str,
    on_token: Optional[Callable[[str], None]] = None,
    on_tool_call: Optional[Callable[[list], None]] = None,
    on_round_start: Optional[Callable[[int], None]] = None,
    tool_events: Optional[list] = None,
    history: Optional[list] = None,
    cancel_event: Optional[threading.Event] = None,
    context: str = "",
    recent_groups: tuple = (),
) -> str:
    """Run one turn and return the model's raw (Markdown) answer."""
    message = user_message.strip()

    if not message:
        raise ValueError("Please enter a message.")

    if len(message) > MAX_INPUT_LENGTH:
        raise ValueError(
            f"Message is too long. Limit: {MAX_INPUT_LENGTH} characters."
        )

    messages = [{"role": "system", "content": build_system_prompt(context=context)}]
    messages.extend(history or [])
    messages.append({"role": "user", "content": message})
    tool_schemas = tools.schemas(tools.select_tools(message, recent_groups))

    seen_tool_calls = set()
    total_tool_calls = 0

    for round_idx in range(MAX_TOOL_ROUNDS + 1):
        if on_round_start:
            on_round_start(round_idx)

        payload = {
            "model": MODEL,
            "messages": messages,
            "stream": True,
            "think": False,
            "keep_alive": "60m",
            "options": {
                "temperature": 0.2,
                "num_predict": NUM_PREDICT,
            },
        }
        if tool_schemas:
            payload["tools"] = tool_schemas

        request = Request(
            OLLAMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        accumulated_content = ""
        tool_calls = []

        try:
            with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                if hasattr(response, "__iter__") and not hasattr(response, "body"):
                    lines = response
                else:
                    lines = response.read().split(b"\n")
                for line in lines:
                    if cancel_event is not None and cancel_event.is_set():
                        raise TurnInterrupted(accumulated_content)
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line.decode("utf-8"))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue
                    msg = chunk.get("message", {})
                    if isinstance(msg, dict):
                        delta = msg.get("content", "")
                        if delta:
                            accumulated_content += delta
                            if on_token:
                                on_token(delta)
                        tc = msg.get("tool_calls")
                        if tc:
                            tool_calls.extend(tc)
        except HTTPError as exc:
            raise RuntimeError(
                f"Ollama returned HTTP {exc.code}."
            ) from None
        except (URLError, TimeoutError, OSError):
            raise RuntimeError(
                "Could not reach Ollama. Check that Ollama is running."
            ) from None

        if cancel_event is not None and cancel_event.is_set():
            raise TurnInterrupted(accumulated_content)

        if not tool_calls:
            answer = accumulated_content
            if not isinstance(answer, str) or not answer.strip():
                raise RuntimeError("The model returned an empty answer.")
            return answer.strip()

        if not isinstance(tool_calls, list):
            raise RuntimeError("Ollama returned an invalid tool call structure.")

        if on_tool_call:
            on_tool_call([
                tc.get("function", {}).get("name")
                for tc in tool_calls
                if isinstance(tc, dict) and isinstance(tc.get("function"), dict)
            ])

        if total_tool_calls + len(tool_calls) > MAX_TOOL_CALLS:
            raise RuntimeError(
                "The total tool-call limit was exceeded. Please try a simpler request."
            )

        batch_keys = []
        for tool_call in tool_calls:
            if not isinstance(tool_call, dict):
                raise RuntimeError("Ollama returned a malformed tool call.")

            function = tool_call.get("function")
            if not isinstance(function, dict):
                raise RuntimeError("Ollama returned a malformed tool call function.")

            name = function.get("name")
            arguments = function.get("arguments", {})

            if not isinstance(name, str):
                raise RuntimeError("Ollama returned a tool call without a valid name.")

            if not isinstance(arguments, dict):
                raise RuntimeError("Denied: tool arguments must be an object.")

            try:
                call_key = (name, json.dumps(arguments, sort_keys=True))
            except (TypeError, ValueError):
                raise RuntimeError("Ollama returned non-serializable tool arguments.")

            if call_key in seen_tool_calls or call_key in batch_keys:
                raise RuntimeError(
                    "The model attempted a repeated tool call."
                )

            batch_keys.append(call_key)

        # Preserve the model's tool-call message for Ollama's next turn.
        assistant_message = {
            "role": "assistant",
            "content": accumulated_content,
            "tool_calls": tool_calls,
        }
        messages.append(assistant_message)

        for tool_call, call_key in zip(tool_calls, batch_keys):
            function = tool_call["function"]
            name = function["name"]
            arguments = function.get("arguments", {})

            outcome = run_tool(name, arguments)
            seen_tool_calls.add(call_key)
            total_tool_calls += 1
            if tool_events is not None:
                tool_events.append({
                    "name": name, "arguments": arguments, "ok": outcome.ok, "text": outcome.text,
                    "approval": outcome.approval,
                })

            messages.append({
                "role": "tool",
                "content": outcome.text,
            })

    raise RuntimeError(
        "The tool-call limit was reached. Please try a simpler request."
    )


# =====================================================================
# Full Graphical Cyberpunk Desktop UI (Exact Match with Core & Glow)
# =====================================================================

SHUTDOWN_EVENT = threading.Event()


PENDING_NOTIFICATIONS = []
NOTIFICATION_LOCK = threading.Lock()
# The window polls /api/notifications every few seconds; if it stopped, nobody is listening.
UI_POLL_GRACE_SECONDS = 10
_last_ui_poll = 0.0


def mark_window_poll() -> None:
    global _last_ui_poll
    _last_ui_poll = time.time()


def window_is_open() -> bool:
    return time.time() - _last_ui_poll < UI_POLL_GRACE_SECONDS


def start_reminder_daemon():
    """Background thread: claim due reminders, show a banner, and speak the alert."""
    def worker():
        while not SHUTDOWN_EVENT.is_set():
            try:
                # Atomically claim due reminders: guarantees exactly-once delivery across threads
                for item in fetch_and_claim_due_reminders():
                    title = item["title"]
                    send_macos_notification("Appu reminder", f"{title} (due {item['due_time']})")

                    speak_in_window = VOICE.is_enabled() and window_is_open()
                    with NOTIFICATION_LOCK:
                        PENDING_NOTIFICATIONS.append({
                            **item,
                            "speak": f"Reminder: {title}" if speak_in_window else None,
                        })

                    if VOICE.is_enabled() and not speak_in_window:
                        VOICE.speak(f"Reminder: {title}")
            except Exception as exc:
                print(f"[!] Reminder daemon error: {exc}", file=sys.stderr)
            time.sleep(3)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()


CONVERSATION = Conversation()
_turn_lock = threading.Lock()
_current_turn_cancel: Optional[threading.Event] = None

TOOL_ACKNOWLEDGEMENTS = {
    "list_reminders": "Checking your reminders.",
    "create_reminder": "Setting that up.",
    "open_project": "Opening it now.",
    "list_tasks": "Let me look at your list.",
    "add_task": "Adding that.",
    "daily_briefing": "Let me pull up your day.",
    "recall": "Let me think.",
}


def begin_turn() -> threading.Event:
    """Start a new turn, cancelling any turn still running."""
    global _current_turn_cancel
    cancel = threading.Event()
    with _turn_lock:
        if _current_turn_cancel is not None:
            _current_turn_cancel.set()
        _current_turn_cancel = cancel
    return cancel


def end_turn(cancel: threading.Event) -> None:
    global _current_turn_cancel
    with _turn_lock:
        if _current_turn_cancel is cancel:
            _current_turn_cancel = None


def interrupt_turn() -> bool:
    """Barge-in: stop the running turn (LLM stream and speech). Returns True if one was running."""
    with _turn_lock:
        cancel = _current_turn_cancel
    VOICE.stop()
    if cancel is None:
        return False
    cancel.set()
    return True


SUMMARY_PROMPT = (
    "Summarise this conversation between the user and Appu, their assistant, in at most 5 short "
    "bullet points: what was discussed, decisions, and anything left open. Use absolute dates. "
    "Reply with the bullets only."
)


def summarize_conversation(transcript: str, previous: Optional[str] = None) -> Optional[str]:
    """Blocking, non-streaming LLM call. Returns None if Ollama is unavailable."""
    if not transcript.strip():
        return previous
    content = transcript if not previous else f"Earlier summary:\n{previous}\n\nLatest turns:\n{transcript}"
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SUMMARY_PROMPT}, {"role": "user", "content": content}],
        "stream": False,
        "think": False,
        "keep_alive": "60m",
        "options": {"temperature": 0.1, "num_predict": 300},
    }
    request = Request(OLLAMA_URL, data=json.dumps(payload).encode("utf-8"),
                      headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=SUMMARY_TIMEOUT_SECONDS) as response:
            summary = json.loads(response.read().decode("utf-8")).get("message", {}).get("content", "")
    except Exception as exc:
        print(f"[!] Conversation summary failed: {exc}", file=sys.stderr)
        return None
    return summary.strip() or None


def _summarize_in_background(conv: Conversation, conversation_id: Optional[int], transcript: str,
                             previous: Optional[str], rolling: bool) -> None:
    def work():
        summary = summarize_conversation(transcript, previous)
        if not summary:
            return
        if rolling and conv.conversation_id == conversation_id:
            conv.rolling_summary = summary
        if conversation_id is not None and conv.persist:
            conversation_store.save_summary(conversation_id, summary, db_path=conv.db_path)
    threading.Thread(target=work, daemon=True).start()


def maybe_roll_summary(conv: Conversation) -> None:
    if conv.needs_summary():
        _summarize_in_background(conv, conv.conversation_id, conv.transcript(), conv.rolling_summary, rolling=True)


def start_new_conversation(conv: Conversation) -> None:
    """End the current conversation, summarising it for next time."""
    transcript, previous, conversation_id = conv.transcript(), conv.rolling_summary, conv.conversation_id
    had_turns = conv.total_turns > 0
    conv.clear()
    APPROVALS.clear()
    if had_turns and conversation_id is not None:
        _summarize_in_background(conv, conversation_id, transcript, previous, rolling=False)


def resolve_approval(approved: bool, approval_id: Optional[int] = None) -> Optional[ToolResult]:
    """Run or drop the pending CONFIRM tool. None if nothing (matching) is pending."""
    pending = APPROVALS.take(approval_id)
    if pending is None:
        return None
    if not approved:
        return ToolResult(True, "Okay, I've left it as it is.")
    result = tools.run_approved(pending)
    return ToolResult(result.ok, result.text if result.ok else f"That didn't work: {result.text}")


def turn_groups(user_msg: str, tool_events: list) -> list:
    groups = tools.groups_for(user_msg)
    for event in tool_events:
        tool = tools.REGISTRY.get(event["name"])
        if tool and tool.group not in groups:
            groups.append(tool.group)
    return groups


class EventStream:
    """Writes newline-delimited JSON events to a streaming HTTP response."""

    def __init__(self, wfile, on_disconnect: Callable[[], None]):
        self._wfile = wfile
        self._lock = threading.Lock()
        self._on_disconnect = on_disconnect
        self.closed = False

    def send(self, event_type: str, **data) -> None:
        line = (json.dumps({"type": event_type, **data}) + "\n").encode("utf-8")
        with self._lock:
            if self.closed:
                return
            try:
                self._wfile.write(line)
                self._wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                self.closed = True
                self._on_disconnect()


def log_turn_latency(timing: dict, session_latency: Optional[dict], total_sec: float) -> None:
    """One JSON line per turn: end of speech -> transcript -> first token -> first audio."""
    record = {"event": "turn_latency", "total_sec": round(total_sec, 3)}
    if isinstance(timing, dict):
        for key in ("stt_sec", "speech_end_to_send_ms"):
            if isinstance(timing.get(key), (int, float)):
                record[key] = timing[key]
    if session_latency:
        record["first_token_sec"] = session_latency.get("first_token")
        record["first_audio_sec"] = session_latency.get("first_audio")
        if record["first_audio_sec"] is not None and "speech_end_to_send_ms" in record:
            record["speech_end_to_first_audio_sec"] = round(
                record["speech_end_to_send_ms"] / 1000 + record["first_audio_sec"], 3
            )
    print(json.dumps(record), flush=True)


def analyze_intent_and_emotion(user_msg: str, tool_events: list) -> tuple[str, str]:
    """Determine the emotion and activity state from tool outcomes and the user's message."""
    lower_q = user_msg.lower()

    if tool_events:
        if all(event["ok"] for event in tool_events):
            return ("confident", "success")
        return ("empathetic", "error")
    elif any(w in lower_q for w in ["not sure", "which", "clarify", "ambiguous", "mean?", "what do you mean"]):
        return ("confused", "needs_clarification")
    elif any(w in lower_q for w in ["great", "awesome", "perfect", "good job", "love it", "yay", "milestone", "congrats"]):
        return ("excited", "speaking")
    elif any(w in lower_q for w in ["joke", "haha", "funny", "trick", "wink", "clever", "play", "fun", "lol"]):
        return ("playful", "speaking")
    elif any(w in lower_q for w in ["sad", "frustrated", "sorry", "struggling", "tough", "hard", "upset", "disappoint"]):
        return ("empathetic", "speaking")
    elif any(w in lower_q for w in ["how", "why", "what", "curious", "wonder", "explore", "idea", "investigat"]):
        return ("curious", "speaking")
    elif any(w in lower_q for w in ["debug", "security", "check", "verify", "code", "terminal", "complex"]):
        return ("serious", "speaking")
    elif any(w in lower_q for w in ["hi", "hello", "hey", "morning", "evening", "welcome", "thank", "thanks"]):
        return ("happy", "speaking")
    else:
        return ("happy", "speaking")


class AppuHTTPRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_bytes(self, data: bytes, content_type: str = "application/json", status: int = 200) -> None:
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data).encode("utf-8")
        self._send_bytes(body, content_type="application/json", status=status)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/index.html"):
            html_path = Path(__file__).parent / "appu_ui.html"
            if html_path.exists():
                content = html_path.read_bytes()
            else:
                content = b"<h1>APPU UI file not found</h1>"
            self._send_bytes(content, content_type="text/html; charset=utf-8")

        elif self.path == "/avatar_prototype.html" or self.path.startswith("/avatar_prototype"):
            proto_path = Path(__file__).parent / "avatar_prototype.html"
            if proto_path.exists():
                self._send_bytes(proto_path.read_bytes(), content_type="text/html; charset=utf-8")
            else:
                self.send_response(404)
                self.end_headers()

        elif self.path.startswith("/models/"):
            clean_path = self.path.split("?")[0].lstrip("/")
            file_path = (Path(__file__).parent / clean_path).resolve()
            base_dir = (Path(__file__).parent / "models").resolve()
            if file_path.is_file() and file_path.is_relative_to(base_dir):
                suffix = file_path.suffix.lower()
                content_type = "model/gltf-binary" if suffix in [".vrm", ".glb"] else "application/octet-stream"
                self._send_bytes(file_path.read_bytes(), content_type=content_type)
            else:
                self.send_response(404)
                self.end_headers()

        elif self.path == "/api/status":
            online = check_ollama_status()
            data = {
                "online": online,
                "model": MODEL,
                "activity": "idle" if online else "offline",
                "activity_label": ACTIVITY_LABELS.get("idle" if online else "offline"),
                "voice_enabled": VOICE.is_enabled(),
            }
            self._send_json(data)

        elif self.path == "/api/notifications":
            mark_window_poll()
            with NOTIFICATION_LOCK:
                items = list(PENDING_NOTIFICATIONS)
                PENDING_NOTIFICATIONS.clear()
            self._send_json({"notifications": items})

        elif self.path == "/api/reminders":
            items = list_reminders(status=None)
            self._send_json({"reminders": items})

        elif self.path == "/api/memories":
            self._send_json({"memories": memories.list_all()})

        elif self.path == "/api/briefing/due":
            self._send_json({"due": briefing.briefing_due()})

        elif self.path == "/api/approval":
            pending = APPROVALS.pending()
            self._send_json({"approval": pending.to_event() if pending else None})

        elif self.path == "/api/voice/status":
            self._send_json({
                "enabled": VOICE.is_enabled(),
                "speaking": VOICE.is_speaking(),
                "stt_available": LOCAL_STT.is_available(),
                "tts_engine": "kokoro",
                "active_voice": getattr(VOICE, "neural_voice", "am_adam"),
                "active_model": "hexgrad/Kokoro-82M",
                "asr_model": getattr(LOCAL_STT, "model", "whisper-1"),
                "turn_detection": TURN_DETECTOR.available(),
            })

        elif self.path == "/api/voice/voices":
            kokoro_voices = [
                {"id": voice_id, "voice_id": voice_id, "name": name, "engine": "kokoro"}
                for voice_id, name in KOKORO_VOICES.items()
            ]
            self._send_json({
                "voices": kokoro_voices,
                "active_voice": getattr(VOICE, "neural_voice", "am_adam"),
            })

        else:
            try:
                self.send_response(404)
                self.end_headers()
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _read_json(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len <= 0:
            return {}
        try:
            payload = json.loads(self.rfile.read(content_len).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        return payload if isinstance(payload, dict) else None

    def _handle_chat(self):
        req = self._read_json()
        if req is None or not isinstance(req.get("message"), str):
            self._send_json({"error": "Invalid request."}, status=400)
            return
        user_msg = req["message"]
        speak = bool(req.get("speak", True)) and VOICE.is_enabled()
        started = time.time()

        cancel = begin_turn()
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
        except (BrokenPipeError, ConnectionResetError):
            end_turn(cancel)
            return

        stream = EventStream(self.wfile, on_disconnect=cancel.set)
        stream.send("state", state="thinking")
        spoke = threading.Event()

        def on_audio(wav: bytes, text: str):
            if not spoke.is_set():
                spoke.set()
                stream.send("state", state="speaking")
            stream.send("audio_chunk", audio=base64.b64encode(wav).decode("ascii"), text=text)

        session = VOICE.start_streaming_session(on_audio=on_audio) if speak else None

        def on_token(delta: str):
            stream.send("text_delta", text=delta)
            if session:
                session.feed_token(delta)

        def on_tool_call(names: list):
            # Text before a tool call is the model thinking aloud; the real answer follows.
            stream.send("text_reset")
            stream.send("state", state="executing")
            if session:
                session.discard_pending_text()
                ack = next((TOOL_ACKNOWLEDGEMENTS[n] for n in names if n in TOOL_ACKNOWLEDGEMENTS), "One sec.")
                session.say(ack)

        tool_events = []
        try:
            answer = self._answer_pending_approval(user_msg, stream, session)
            if answer is None:
                answer = ask_local_model(
                    user_msg,
                    on_token=on_token,
                    on_tool_call=on_tool_call,
                    tool_events=tool_events,
                    history=CONVERSATION.messages(),
                    cancel_event=cancel,
                    context=build_context(user_msg, CONVERSATION),
                    recent_groups=tuple(CONVERSATION.last_groups),
                )
            else:
                tool_events.append({"name": "approval", "ok": True, "text": answer, "approval": None})
            CONVERSATION.add_turn(user_msg, answer, groups=turn_groups(user_msg, tool_events))
            maybe_roll_summary(CONVERSATION)
            approval = None
            for event in tool_events:
                print(json.dumps({"event": "tool_call", "name": event["name"], "arguments": event.get("arguments"),
                                  "ok": event["ok"]}), flush=True)
                stream.send("tool_event", name=event["name"], ok=event["ok"])
                approval = event.get("approval") or approval
            if approval:
                stream.send("approval_required", **approval)
            if session:
                session.finish_text()
                session.wait(timeout=TIMEOUT_SECONDS)
            emotion, activity = analyze_intent_and_emotion(user_msg, tool_events)
            if approval:
                emotion, activity = "serious", "approval_required"
            stream.send(
                "done",
                answer=answer,
                emotion=emotion,
                activity=activity,
                executed_tool=any(e["ok"] for e in tool_events),
                interrupted=cancel.is_set(),
            )
        except TurnInterrupted as exc:
            if session:
                session.cancel()
            CONVERSATION.add_turn(user_msg, exc.partial, interrupted=True)
            stream.send("done", answer=exc.partial, interrupted=True)
        except Exception as exc:
            if session:
                session.cancel()
            stream.send("error", message=str(exc))
        finally:
            end_turn(cancel)
            log_turn_latency(req.get("timing"), session.latency() if session else None, time.time() - started)

    def _answer_pending_approval(self, user_msg: str, stream: "EventStream", session) -> Optional[str]:
        """If a yes/no question is pending and this message answers it, resolve it without the LLM."""
        if APPROVALS.pending() is None:
            return None
        decision = parse_answer(user_msg)
        if decision is None:
            APPROVALS.clear()  # the user moved on; don't let a stale question fire later
            return None
        result = resolve_approval(decision)
        if result is None:
            return None
        stream.send("text_delta", text=result.text)
        if session:
            session.say(result.text)
        return result.text

    def do_POST(self):
        if self.path == "/api/chat":
            self._handle_chat()

        elif self.path == "/api/approval":
            req = self._read_json()
            if not req or not isinstance(req.get("approve"), bool):
                self._send_json({"error": "Invalid request."}, status=400)
                return
            approval_id = req.get("id") if isinstance(req.get("id"), int) else None
            result = resolve_approval(req["approve"], approval_id)
            if result is None:
                self._send_json({"ok": False, "error": "That question has expired."}, status=409)
                return
            CONVERSATION.add_turn("yes" if req["approve"] else "no", result.text, groups=CONVERSATION.last_groups)
            self._send_json({"ok": result.ok, "text": result.text})

        elif self.path == "/api/memories/delete":
            req = self._read_json()
            memory_id = req.get("id") if isinstance(req, dict) else None
            if not isinstance(memory_id, int) or isinstance(memory_id, bool):
                self._send_json({"error": "Invalid id."}, status=400)
                return
            self._send_json({"ok": memories.forget(memory_id)})

        elif self.path == "/api/briefing":
            data = briefing.daily_briefing()
            self._send_json({"text": data["text"], "suggestion": data["suggestion"]})

        elif self.path == "/api/chat/stop":
            req = self._read_json() or {}
            running = interrupt_turn()
            if not running and req.get("during_playback"):
                CONVERSATION.mark_last_interrupted()
            self._send_json({"stopped": running})

        elif self.path == "/api/conversation/new":
            interrupt_turn()
            start_new_conversation(CONVERSATION)
            self._send_json({"ok": True})

        elif self.path == "/api/tts":
            req = self._read_json()
            text = req.get("text") if isinstance(req, dict) else None
            if not isinstance(text, str) or not text.strip() or len(text) > MAX_TTS_CHARS:
                self._send_json({"error": "Invalid text."}, status=400)
                return
            wav = VOICE.synthesize(text) if VOICE.is_enabled() else None
            if not wav:
                self._send_json({"error": "Speech is unavailable."}, status=503)
                return
            self._send_bytes(wav, content_type="audio/wav")

        elif self.path == "/api/voice/toggle":
            content_len = int(self.headers.get("Content-Length", 0))
            new_state = None
            if content_len > 0:
                try:
                    payload = json.loads(self.rfile.read(content_len).decode("utf-8"))
                    new_state = payload.get("enabled")
                except Exception:
                    pass

            if new_state is None:
                new_state = not VOICE.is_enabled()
            VOICE.set_enabled(new_state)
            self._send_json({"enabled": VOICE.is_enabled()})

        elif self.path == "/api/voice/turn":
            content_len = int(self.headers.get("Content-Length", 0))
            if not 0 < content_len <= MAX_TURN_AUDIO_BYTES:
                self._send_json({"error": "Invalid audio."}, status=400)
                return
            audio_bytes = self.rfile.read(content_len)
            try:
                self._send_json(TURN_DETECTOR.check(decode_wav(audio_bytes)))
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=503)

        elif self.path == "/api/voice/transcribe":
            content_len = int(self.headers.get("Content-Length", 0))
            audio_bytes = self.rfile.read(content_len)
            try:
                text, latency = LOCAL_STT.transcribe(audio_bytes)
                res_data = {
                    "text": text,
                    "latency_sec": round(latency, 3),
                    "success": True,
                }
            except Exception as exc:
                res_data = {
                    "text": "",
                    "error": str(exc),
                    "success": False,
                }
            self._send_json(res_data)

        elif self.path == "/api/voice/select":
            content_len = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(content_len).decode("utf-8")) if content_len > 0 else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = None
            chosen_voice = payload.get("voice") if isinstance(payload, dict) else None
            if chosen_voice not in KOKORO_VOICES:
                self._send_json({"success": False, "error": "Unknown voice."}, status=400)
                return
            VOICE.neural_voice = chosen_voice
            VOICE.kokoro.voice_name = chosen_voice
            self._send_json({"active_voice": chosen_voice, "success": True})

        elif self.path == "/api/voice/stop":
            interrupt_turn()
            try:
                self.send_response(200)
                self.end_headers()
            except (BrokenPipeError, ConnectionResetError):
                pass

        elif self.path == "/api/quit":
            VOICE.stop()
            try:
                self.send_response(200)
                self.end_headers()
            except (BrokenPipeError, ConnectionResetError):
                pass
            threading.Thread(target=lambda: (time.sleep(0.3), SHUTDOWN_EVENT.set())).start()

        else:
            try:
                self.send_response(404)
                self.end_headers()
            except (BrokenPipeError, ConnectionResetError):
                pass


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def launch_appu_gui(port: int):
    """Launch standalone Mac window with red/yellow/green window controls and title."""
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    url = f"http://127.0.0.1:{port}"

    if os.path.exists(chrome_path):
        cmd = [
            chrome_path,
            f"--app={url}",
            "--window-size=1200,680",
            "--window-name=appu",
            f"--user-data-dir=/tmp/appu_chrome_profile_{port}",
            "--disable-extensions",
            # The daily briefing and reminder alerts speak before the first click.
            "--autoplay-policy=no-user-gesture-required",
            "--no-first-run",
            "--no-default-browser-check",
        ]
        return subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        # Fallback to system default browser
        import webbrowser
        webbrowser.open(url)
        return None


# =====================================================================
# Terminal CLI Fallback Mode
# =====================================================================

def run_terminal_mode():
    print("\033]0;appu — python3 appu.py\007", end="")
    print("\033[1;38;2;0;229;255mAPPU — Local Cybernetic Assistant\033[0m")
    print(f"Model: {MODEL} | Online: {check_ollama_status()}")
    print("Type 'exit' to quit.\n")
    conversation = CONVERSATION

    while True:
        try:
            user_message = input("\033[1;38;2;0;210;245mYou > \033[0m")
        except (EOFError, KeyboardInterrupt):
            print("\n\033[38;2;0;229;255mAPPU: Goodbye.\033[0m")
            break

        if user_message.strip().lower() in {"exit", "quit"}:
            print("\n\033[38;2;0;229;255mAPPU: Goodbye.\033[0m")
            break

        try:
            tool_events = []
            decision = parse_answer(user_message) if APPROVALS.pending() else None
            if decision is not None:
                answer = resolve_approval(decision).text
            else:
                APPROVALS.clear()
                answer = ask_local_model(
                    user_message,
                    history=conversation.messages(),
                    tool_events=tool_events,
                    context=build_context(user_message, conversation),
                    recent_groups=tuple(conversation.last_groups),
                )
            conversation.add_turn(user_message, answer, groups=turn_groups(user_message, tool_events))
            maybe_roll_summary(conversation)
            print(f"\n\033[1;38;2;0;229;255mAppu >\033[0m {clean_terminal_text(answer)}\n")
        except (ValueError, RuntimeError) as exc:
            print(f"\n\033[38;2;255;100;100mError:\033[0m {exc}\n")


# =====================================================================
# Main Entry Point
# =====================================================================

LOCK_FILE = Path.home() / "Developer" / "jarvis" / "data" / "appu.lock"


def acquire_instance_lock() -> bool:
    """Ensure only one background service instance runs at a time."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text().strip())
            # Check if previous process is still running
            os.kill(pid, 0)
            return False
        except (ValueError, OSError):
            # Previous process terminated; stale lock
            pass
    try:
        LOCK_FILE.write_text(str(os.getpid()))
        return True
    except Exception:
        return True


def release_instance_lock() -> None:
    try:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()
    except Exception:
        pass


def prepare_storage() -> None:
    """Persist conversations and apply the history retention setting (days, default 30)."""
    CONVERSATION.persist = True
    try:
        days = int(db.get_setting("retention_days", str(conversation_store.DEFAULT_RETENTION_DAYS)))
        removed = conversation_store.purge_older_than(days)
        if removed:
            print(f"[+] Deleted {removed} conversation(s) older than {days} days.")
    except Exception as exc:
        print(f"[!] Storage setup failed: {exc}", file=sys.stderr)


def main():
    prepare_storage()
    # Warm up local speech-to-text and VoiceStudio neural TTS in background
    threading.Thread(target=LOCAL_STT.warmup, daemon=True).start()
    threading.Thread(target=VOICE.warmup, daemon=True).start()
    threading.Thread(target=TURN_DETECTOR.warmup, daemon=True).start()

    if "--daemon" in sys.argv or "--background" in sys.argv:
        if not acquire_instance_lock():
            print("[!] Another instance of APPU background service is already running. Exiting.")
            sys.exit(0)

        import signal
        signal.signal(signal.SIGTERM, lambda s, f: SHUTDOWN_EVENT.set())

        start_reminder_daemon()
        port = find_free_port()
        server = ThreadingHTTPServer(("127.0.0.1", port), AppuHTTPRequestHandler)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()

        print(f"[+] APPU Daemon online on port {port}. Monitoring persistent reminders.")
        try:
            while not SHUTDOWN_EVENT.is_set():
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            pass
        finally:
            release_instance_lock()
            try:
                server.shutdown()
                server.server_close()
            except Exception:
                pass
            print("[+] APPU Daemon stopped.")
        return

    # Start background reminder daemon for persistent alerts
    start_reminder_daemon()

    if "--cli" in sys.argv or "--terminal" in sys.argv:
        run_terminal_mode()
        return

    port = find_free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), AppuHTTPRequestHandler)

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    print(f"\033[1;38;2;0;229;255m[+] APPU Neural Core Online at http://127.0.0.1:{port}\033[0m")
    print(f"\033[38;2;90;175;235m[+] Launching standalone cybernetic HUD window...\033[0m")

    browser_proc = launch_appu_gui(port)

    # Keep server alive until window is closed or Ctrl+C
    try:
        while not SHUTDOWN_EVENT.is_set():
            if browser_proc and browser_proc.poll() is not None:
                # Browser window closed by user
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        print("\n\033[38;2;0;229;255m[!] APPU shutting down. Goodbye!\033[0m")
        VOICE.stop()
        try:
            server.shutdown()
            server.server_close()
        except Exception:
            pass
        if browser_proc and browser_proc.poll() is None:
            browser_proc.terminate()


if __name__ == "__main__":
    main()
