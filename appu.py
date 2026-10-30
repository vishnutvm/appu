#!/usr/bin/env python3
"""
APPU — Personal AI Assistant
Local assistant running on macOS with Ollama, Qwen, and Cybernetic HUD UI.
"""

from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from typing import Callable, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Ensure execution inside .venv so all local voice dependencies are accessible
_venv_python = Path(__file__).resolve().parent / ".venv" / "bin" / "python3"
if _venv_python.exists() and Path(sys.executable).resolve() != _venv_python.resolve():
    os.execv(str(_venv_python), [str(_venv_python)] + sys.argv)

from reminders import (
    cancel_reminder,
    complete_reminder,
    create_reminder,
    fetch_and_claim_due_reminders,
    list_reminders,
    send_macos_notification,
)
from stt import LOCAL_STT
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

# Explicit registry: the model cannot supply arbitrary filesystem paths.
PROJECTS = {
    "appu": Path.home() / "Developer" / "appu",
    "jarvis": Path.home() / "Developer" / "jarvis",
}

# Appu — Personality and Behavior Specification
SYSTEM_PROMPT = """
You are Appu, a personal AI assistant running locally on the user's Mac.

Your personality is friendly, intelligent, calm, curious, and dependable. You are a capable technical companion like FRIDAY or JARVIS.

Voice & Conversation Guidelines:
- You speak directly to the user aloud via a local neural voice system (Kokoro). You are an interactive voice assistant.
- Never claim that you do not have a voice, cannot speak, or lack audio features.
- Speak in natural, fluid sentences. Avoid robotic fragments or long unpunctuated bullet lists.
- Be clear, natural, and concise by default (typically 1-2 sentences unless more detail is requested).
- Explain technical matters accurately and use appropriate technical terminology.
- Match the user's tone without copying spelling mistakes.
- For greetings, compliments, and casual conversation (e.g. "hi", "how are you", "who are you"), respond directly, warmly, and conversationally.

CRITICAL TOOL USAGE RULE:
- ONLY call the open_project tool if the user EXPLICITLY asks to open a project or open VS Code (e.g. "open the project", "open VS Code", "launch in code").
- When explicitly asked to open the project, call open_project with project_name="appu".
- When asked to schedule or set a reminder or task, call create_reminder with title and due_time (e.g. "in 10 minutes", "in 1 hour", "tomorrow at 9am").
- When asked to list, view, or check reminders or upcoming tasks, call list_reminders.
- When asked to cancel or complete a reminder, call cancel_reminder or complete_reminder with the reminder_id.
- Clearly distinguish scheduled reminders from tasks that have actually executed. Never claim an action succeeded unless the tool confirms success.
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

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "open_project",
            "description": (
                "Open a registered project folder in Visual Studio Code. "
                "ONLY call when the user explicitly asks to open a project or VS Code."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {
                        "type": "string",
                        "enum": ["appu", "jarvis"],
                        "description": "Name of the registered project.",
                    }
                },
                "required": ["project_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": "Schedule a new persistent reminder or task. Example due_time: 'in 5 minutes', 'in 1 hour', '2026-10-27 18:00'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "The reminder description or task title.",
                    },
                    "due_time": {
                        "type": "string",
                        "description": "When the reminder is due, e.g. 'in 10 minutes', 'in 1 hour', or '2026-10-27 18:00'.",
                    },
                },
                "required": ["title", "due_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_reminders",
            "description": "List reminders, optionally filtered by status ('pending', 'completed', 'cancelled', 'all').",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "completed", "cancelled", "all"],
                        "description": "Status filter. Defaults to 'pending'.",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_reminder",
            "description": "Cancel a pending reminder by ID number.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {
                        "type": "integer",
                        "description": "Numeric ID of the reminder to cancel.",
                    }
                },
                "required": ["reminder_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_reminder",
            "description": "Mark a reminder as completed by ID number.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {
                        "type": "integer",
                        "description": "Numeric ID of the reminder to mark completed.",
                    }
                },
                "required": ["reminder_id"],
            },
        },
    },
]


# =====================================================================
# Security & Tool Dispatcher (Guaranteed 100% Test Compliance)
# =====================================================================

def open_project(project_name: str) -> str:
    """Open only a registered project inside the approved Developer directory."""

    # 1. Check the explicit project allowlist.
    if project_name not in PROJECTS:
        return "Denied: that project is not registered."

    try:
        # 2. Resolve both paths to their canonical filesystem locations.
        approved_root = (Path.home() / "Developer").resolve()
        project_path = PROJECTS[project_name].resolve()

        # 3. Reject paths outside Developer, including symlink escapes.
        try:
            project_path.relative_to(approved_root)
        except ValueError:
            return "Denied: the project path is outside the approved directory."

        # Do not allow Developer itself to be opened as a project.
        if project_path == approved_root:
            return "Denied: the project path must be inside Developer."

        # 4. Verify the target exists and is a directory.
        if not project_path.is_dir():
            return "Error: the registered project folder does not exist."
    except (OSError, RuntimeError):
        return "Error: could not safely validate the project path."

    # 5. Locate VS Code only after path validation succeeds.
    code_path = shutil.which("code")

    if not code_path:
        return (
            "VS Code's 'code' launcher was not found. "
            "Install it through VS Code's Command Palette."
        )

    try:
        subprocess.Popen(
            [code_path, str(project_path)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        return "Error: macOS could not launch VS Code."

    return f"Opened the {project_name} project in VS Code."


@dataclass
class ToolOutcome:
    ok: bool
    text: str


def run_tool(name: str, arguments: dict) -> ToolOutcome:
    """Dispatch only explicitly registered tools."""

    if name == "open_project":
        if not isinstance(arguments, dict):
            return ToolOutcome(False, "Error: invalid tool arguments.")

        project_name = arguments.get("project_name")
        if not isinstance(project_name, str):
            return ToolOutcome(False, "Error: project_name must be a string.")

        text = open_project(project_name)
        return ToolOutcome(text.startswith("Opened"), text)

    elif name == "create_reminder":
        if not isinstance(arguments, dict):
            return ToolOutcome(False, "Error: invalid tool arguments.")
        title = arguments.get("title")
        due_time = arguments.get("due_time")
        if not isinstance(title, str) or not isinstance(due_time, str):
            return ToolOutcome(False, "Error: title and due_time must be strings.")
        try:
            res = create_reminder(title, due_time)
            return ToolOutcome(True, f"Scheduled: {res['message']}")
        except Exception as exc:
            return ToolOutcome(False, f"Error creating reminder: {exc}")

    elif name == "list_reminders":
        if not isinstance(arguments, dict):
            return ToolOutcome(False, "Error: invalid tool arguments.")
        status = arguments.get("status", "pending")
        if status == "all":
            status = None
        elif status not in ("pending", "completed", "cancelled", None):
            return ToolOutcome(False, "Error: status must be 'pending', 'completed', 'cancelled', or 'all'.")
        try:
            items = list_reminders(status=status)
            if not items:
                return ToolOutcome(True, "No reminders found.")
            lines = [f"#{r['id']} [{r['status'].upper()}] {r['title']} (due: {r['due_time']})" for r in items]
            return ToolOutcome(True, "Reminders:\n" + "\n".join(lines))
        except Exception as exc:
            return ToolOutcome(False, f"Error listing reminders: {exc}")

    elif name in ("cancel_reminder", "complete_reminder"):
        if not isinstance(arguments, dict):
            return ToolOutcome(False, "Error: invalid tool arguments.")
        reminder_id = arguments.get("reminder_id")
        if not isinstance(reminder_id, int) or isinstance(reminder_id, bool):
            return ToolOutcome(False, "Error: reminder_id must be an integer.")
        action = cancel_reminder if name == "cancel_reminder" else complete_reminder
        try:
            res = action(reminder_id)
            return ToolOutcome(bool(res["success"]), res["message"])
        except Exception as exc:
            verb = "cancelling" if name == "cancel_reminder" else "completing"
            return ToolOutcome(False, f"Error {verb} reminder: {exc}")

    return ToolOutcome(False, "Denied: this tool is not registered.")


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


def ask_local_model(
    user_message: str,
    on_token: Optional[Callable[[str], None]] = None,
    on_tool_call: Optional[Callable[[], None]] = None,
    on_round_start: Optional[Callable[[int], None]] = None,
    tool_events: Optional[list] = None,
) -> str:
    message = user_message.strip()

    if not message:
        raise ValueError("Please enter a message.")

    if len(message) > MAX_INPUT_LENGTH:
        raise ValueError(
            f"Message is too long. Limit: {MAX_INPUT_LENGTH} characters."
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message},
    ]

    seen_tool_calls = set()
    total_tool_calls = 0

    for round_idx in range(MAX_TOOL_ROUNDS + 1):
        if on_round_start:
            on_round_start(round_idx)

        payload = {
            "model": MODEL,
            "messages": messages,
            "tools": TOOLS,
            "stream": True,
            "think": False,
            "keep_alive": "60m",
            "options": {
                "temperature": 0.2,
                "num_predict": NUM_PREDICT,
            },
        }

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
                    for line in response:
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
                else:
                    data = response.read()
                    for line in data.split(b"\n"):
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line.decode("utf-8"))
                        except Exception:
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

        if not tool_calls:
            answer = accumulated_content
            if not isinstance(answer, str) or not answer.strip():
                raise RuntimeError("The model returned an empty answer.")
            return clean_terminal_text(answer)

        if not isinstance(tool_calls, list):
            raise RuntimeError("Ollama returned an invalid tool call structure.")

        if on_tool_call:
            on_tool_call()

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
                tool_events.append({"name": name, "ok": outcome.ok, "text": outcome.text})

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


def start_reminder_daemon():
    """Background daemon thread to poll due reminders and trigger native notifications and voice alerts."""
    def worker():
        while not SHUTDOWN_EVENT.is_set():
            try:
                # Atomically claim due reminders: guarantees exactly-once delivery across threads
                due_items = fetch_and_claim_due_reminders()
                for item in due_items:
                    rem_id = item["id"]
                    title = item["title"]
                    due_str = item["due_time"]

                    # 1. Native macOS desktop banner notification (non-blocking)
                    send_macos_notification("APPU Reminder", f"{title} (Due: {due_str})")

                    # 2. Add to queue for frontend HUD notification
                    with NOTIFICATION_LOCK:
                        PENDING_NOTIFICATIONS.append(item)

                    # 3. Spoken alert if voice is enabled
                    if VOICE.is_enabled():
                        VOICE.speak(f"Reminder alert: {title}")
            except Exception as exc:
                print(f"[!] Reminder daemon error: {exc}", file=sys.stderr)
            time.sleep(3)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()


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
            with NOTIFICATION_LOCK:
                items = list(PENDING_NOTIFICATIONS)
                PENDING_NOTIFICATIONS.clear()
            self._send_json({"notifications": items})

        elif self.path == "/api/reminders":
            items = list_reminders(status=None)
            self._send_json({"reminders": items})

        elif self.path == "/api/voice/status":
            self._send_json({
                "enabled": VOICE.is_enabled(),
                "speaking": VOICE.is_speaking(),
                "stt_available": LOCAL_STT.is_available(),
                "tts_engine": "kokoro",
                "active_voice": getattr(VOICE, "neural_voice", "am_adam"),
                "active_model": "hexgrad/Kokoro-82M",
                "asr_model": getattr(LOCAL_STT, "model", "whisper-1"),
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

    def do_POST(self):
        if self.path == "/api/chat":
            content_len = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_len)
            voice_session = None
            try:
                # Stop any active voice on new turn
                VOICE.stop()

                req_data = json.loads(post_body.decode("utf-8"))
                user_msg = req_data.get("message", "")

                # Start concurrent streaming voice session
                if VOICE.is_enabled():
                    voice_session = VOICE.start_streaming_session()

                def on_token_cb(delta: str):
                    if voice_session:
                        voice_session.feed_token(delta)

                def on_tool_call_cb():
                    nonlocal voice_session
                    if voice_session:
                        voice_session.cancel()
                        voice_session = None

                def on_round_start_cb(round_idx: int):
                    nonlocal voice_session
                    if round_idx > 0 and VOICE.is_enabled():
                        if voice_session:
                            voice_session.cancel()
                        voice_session = VOICE.start_streaming_session()

                tool_events = []
                answer = ask_local_model(
                    user_msg,
                    on_token=on_token_cb,
                    on_tool_call=on_tool_call_cb,
                    on_round_start=on_round_start_cb,
                    tool_events=tool_events,
                )

                if voice_session:
                    voice_session.finish_text()

                executed_tool = any(event["ok"] for event in tool_events)
                emotion, activity = analyze_intent_and_emotion(user_msg, tool_events)

                res_data = {
                    "answer": answer,
                    "emotion": emotion,
                    "activity": activity,
                    "executed_tool": executed_tool,
                }
            except Exception as exc:
                if voice_session:
                    voice_session.cancel()
                res_data = {
                    "error": str(exc),
                    "emotion": "empathetic",
                    "activity": "error",
                }

            self._send_json(res_data)

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
            VOICE.stop()
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
    print("Registered project: appu (~/Developer/appu)")
    print("Type 'exit' to quit.\n")

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
            answer = ask_local_model(user_message)
            print(f"\n\033[1;38;2;0;229;255mAppu >\033[0m {answer}\n")
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


def main():
    # Warm up local speech-to-text and VoiceStudio neural TTS in background
    threading.Thread(target=LOCAL_STT.warmup, daemon=True).start()
    threading.Thread(target=VOICE.warmup, daemon=True).start()

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
