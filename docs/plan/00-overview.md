# Appu — Improvement Plan (Overview)

Reviewed: 30 Oct 2026. Machine: Mac mini, Apple M4, 16 GB unified memory.
Test suite at review time: 49 tests, all passing (2 skipped), run with
`.venv/bin/python -m unittest discover -s tests`.

## Goal

A personal assistant and supporter, not a coding agent. Appu should:

- Hold a natural spoken conversation (FRIDAY-style): hands-free, interruptible,
  fast to respond, remembers context.
- Help day to day: reminders, tasks, remembering things you tell it, daily briefing.
- Review and explain: your code, documents and web pages — read-only, with
  suggestions. It does not write or change your code.
- Look calm and personal, not like a generic "AI HUD".

## Current state in one paragraph

`appu.py` serves `appu_ui.html` on a random localhost port and opens it as a
Chrome app window. Chat goes to Ollama (`qwen3.5:4b`) with five allowlisted tools
(open project, create/list/cancel/complete reminder). Replies stream into Kokoro
TTS sentence-by-sentence and play through `afplay`. Speech input is recorded in
the browser, sent to VoiceStudio (`127.0.0.1:3900`) or local MLX Whisper, and the
text is placed in the input box. Reminders live in SQLite (`data/reminders.db`)
and fire via a background thread with a macOS banner and spoken alert.

## Plan files (do them in this order)

| # | File | What it delivers |
|---|------|------------------|
| 1 | `01-voice-loop.md` | Hands-free conversation, barge-in, proper turn detection, streamed text |
| 2 | `02-memory-and-tasks.md` | Conversation history, long-term memory, tasks, daily briefing |
| 3 | `03-ui-redesign.md` | Calm, personal UI without "AI slop" styling |
| 4 | `04-skills.md` | Review code, documents and web pages; suggestions |
| 5 | `05-production-readiness.md` | Git, packaging, fixed port, LaunchAgent, cleanup, tests |
| — | `models.md` | Which model to use for each job: local, free cloud, paid |

Each file has a checklist. Do one file at a time, run the tests, then move on.

## Known bugs and quick fixes (do these first, ~1 hour)

- [ ] `appu.py` uses `Optional` and `Callable` without importing them. Works only
      because Python 3.14 evaluates annotations lazily. Add
      `from typing import Callable, Optional`.
- [ ] `num_predict: 200` in `ask_local_model` truncates longer answers. Raise it
      for text replies (e.g. 1024) and keep spoken replies short via the prompt.
- [ ] `cancel_reminder` cancels reminders that are already completed. Only allow
      `pending` / `notified`.
- [ ] `/api/voice/select` accepts any voice string. Validate against the Kokoro
      voice list.
- [ ] The UI sends `/api/voice/stop` on every audio frame above the volume
      threshold. Send it once per speech start.
- [ ] Module docstrings in `voice.py` say VoiceStudio is the main TTS. It is
      never used to synthesise speech (only in an `is_available` check). Either
      wire it up or remove `VoiceStudioTTSClient`.
- [ ] Remove dead code: `get_due_reminders`, `mark_reminder_notified`,
      `clean_for_speech` import in `appu.py`, `VoiceEngine._audio_queue` "say"
      tuple branch (never queued).
- [ ] `/api/status` hard-codes `project: appu`. Return real data or drop it.
- [ ] Emotion and "tool executed" are guessed by searching answer text
      (`"opened" in answer`). Return them from the tool loop instead.
- [ ] `docs/com.appu.assistant.plist` logs to `data/logs/`, which does not exist.
- [ ] No git commits yet. Before the first commit, add `data/` and `models/` to
      `.gitignore` — otherwise your reminders DB and the ~330 MB Kokoro model
      files get committed. Then commit before starting any phase.
