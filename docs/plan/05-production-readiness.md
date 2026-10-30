# Phase 5 — Production Readiness

## Source control

- [ ] First commit now (nothing is committed). Check `.gitignore` covers `.venv/`,
      `data/`, `models/` (large binaries), `__pycache__/`.
- [ ] Keep model files out of git; add a `scripts/download_models.sh`.

## Project structure

```
jarvis/
  appu/                     # package
    __main__.py             # entry: python -m appu
    config.py               # all settings in one place (port, models, paths)
    server.py               # HTTP + WebSocket
    agent.py                # LLM loop, history, routing
    llm/                    # ollama.py, openai_compat.py (Groq/Gemini/OpenRouter)
    tools/                  # registry + one module per tool
    memory/                 # db.py, memories.py, tasks.py, reminders.py
    voice/                  # vad.py, turn.py, stt.py, tts.py, session.py
  ui/                       # index.html, styles.css, app.js, vendor/
  tests/
  docs/
  data/                     # gitignored: appu.db, logs/
  models/                   # gitignored
  pyproject.toml
```

## Dependencies

- [ ] `pyproject.toml` (or `requirements.txt`) with pinned versions:
      `kokoro-onnx`, `soundfile`, `numpy`, `mlx-whisper`, `scipy`, plus new ones.
- [ ] Dev deps: `pytest`, `ruff`.
- [ ] Python 3.14 is fine, but fix the `typing` import so 3.12/3.13 also work.

## Configuration

- [ ] `config.py` reading `data/config.toml`: port, model per job, voice,
      allowed folders, projects allowlist, memory retention.
- [ ] API keys (Groq, Gemini, OpenRouter) in the macOS Keychain (`keyring`
      package) or env vars — never in the repo.

## Running as a background service

- [ ] Fixed port (e.g. `8765`) so the window, menubar and LaunchAgent agree.
      Keep binding to `127.0.0.1` only.
- [ ] Simple local auth token (random, stored in `data/`) required on every
      request, so other local apps or web pages cannot drive Appu via
      `localhost` (DNS-rebinding / CSRF protection). Also check `Host` and
      `Origin` headers.
- [ ] LaunchAgent: point `ProgramArguments` at `.venv/bin/python -m appu --daemon`,
      create `data/logs/`, keep `RunAtLoad` off until you are happy.
- [ ] "Open Appu" from the menubar connects to the running daemon instead of
      starting a second server.

## Reliability

- [ ] Health checks on startup: Ollama running, model pulled, Kokoro files
      present, mic permission. Show one clear message per problem.
- [ ] Auto-retry Ollama once; fall back to a cloud model if configured.
- [ ] Structured logs (JSON lines) with per-turn latency numbers.
- [ ] Reminder thread: log exceptions instead of `except Exception: pass`.
- [ ] Graceful shutdown: stop TTS, close DB, release lock.

## Tests and checks

- [ ] `pytest` + `ruff` in one `make check` (or `scripts/check.sh`).
- [ ] Keep the existing security tests; add one per new tool.
- [ ] Fake LLM client for agent-loop tests (no Ollama needed).
- [ ] A short manual voice test script (latency, barge-in, follow-up window).

## Performance on a 16 GB M4

- Budget roughly: macOS + apps ~6 GB, Chrome window ~0.5–1 GB, LLM 3–7 GB,
  STT 0.2–1.5 GB, Kokoro ~0.4 GB. Keep the always-loaded voice model ≤ ~7 GB.
- `keep_alive: "60m"` keeps the model in memory. Fine for daily use; lower it
  if you also run heavy dev tools.
- Do not load a 14 GB model (e.g. gpt-oss:20b) alongside everything else; use
  cloud for heavy review instead (see `models.md`).
