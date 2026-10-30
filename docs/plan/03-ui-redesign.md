# Phase 3 — UI Redesign (calm, personal, no "AI slop")

## What makes the current UI feel generic

- Neon cyan on near-black, glow `text-shadow` everywhere, letter-spacing up to 14px.
- Corner brackets, fake "meta tables", sci-fi HUD decoration that carries no information.
- Emoji in status lines (`⚡ ✅ 🎙️ ⚠️`).
- Internal plumbing shown to the user: "VoiceStudio (faster-whisper)",
  "python3 appu.py" in the window title, model names.
- `user-select: none` on everything — you cannot copy Appu's answers.
- Mixed font stack that falls back to Courier New for body text.
- Replies are stripped of Markdown, so code and lists render as plain text.
- One 1,680-line HTML file with inline CSS and JS.

## Design direction

Think "calm instrument", not "movie HUD". Appu is something you glance at and
talk to, and occasionally read from.

### Principles

1. **One focal element.** A single orb/presence in the centre that reacts to
   audio level — yours while listening, Appu's while speaking. It *is* the state
   indicator; no separate labels needed most of the time.
2. **Information only.** Every element on screen must answer a question you have.
   No decorative telemetry.
3. **Plain words.** States: Listening, Thinking, Speaking, Paused. Errors in one
   sentence with a next step ("Ollama isn't running. Start it with `ollama serve`.").
4. **Quiet palette.** Dark warm grey background, one accent colour, used sparingly
   (only for the orb and the active state). No glow. Support light mode.
5. **Real typography.** SF Pro Text for UI and answers, SF Mono only for code.
   Normal letter-spacing. 15–16px body text, comfortable line height.
6. **Motion with purpose.** Orb breathes when idle, follows amplitude when
   listening/speaking. Respect `prefers-reduced-motion`.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Appu                                   ● Local   ⚙︎          │
├───────────────────────────────┬──────────────────────────────┤
│                               │  Today                       │
│            ( orb )            │  ─ 3 tasks, 1 overdue        │
│         "Listening…"          │  ─ Reminder 4:30 pm: standup │
│                               │                              │
│  ── conversation ──           │  Remembered                  │
│  You: what's left today?      │  ─ On leave Fri 6 Nov        │
│  Appu: Two things. The GPS…   │                              │
│        [rendered Markdown,    │  Recent reviews              │
│         code blocks, copy]    │  ─ appu.py diff (2 notes)    │
│                               │                              │
│  [ Type or hold Space to talk ]                              │
└───────────────────────────────┴──────────────────────────────┘
```

- Side panel collapsible; compact "mini" mode (just the orb + last line) for
  keeping Appu in a corner of the screen.
- Approval card inline in the conversation for actions that need confirmation
  (Yes / No buttons, also answerable by voice).

## Technical changes

- [ ] Split `appu_ui.html` into `ui/index.html`, `ui/styles.css`, `ui/app.js`
      (and modules: `audio.js`, `ws.js`, `orb.js`, `render.js`). No build step needed.
- [ ] Render Markdown safely (e.g. `marked` + `DOMPurify`, vendored locally, no CDN).
- [ ] Code blocks with copy button; allow text selection.
- [ ] Orb drawn with Canvas 2D or SVG, driven by an `AnalyserNode` on mic and TTS audio.
- [ ] Remove all engine/model names from user-facing text; put them in Settings → About.
- [ ] Settings panel: voice, speaking speed, model per job, memory retention,
      wake word on/off, mic device.
- [ ] Keyboard: Space (hold) to talk, Esc to stop Appu, Cmd+K for new conversation.
- [ ] Accessibility: focus outlines, ARIA live region for new replies, contrast ≥ 4.5:1.

## Native window (optional, later)

Chrome `--app` works but depends on Chrome being installed and shows as "Chrome".
Options, in order of effort:

1. Keep Chrome app mode (now).
2. `pywebview` — native macOS WebKit window from Python, small change.
   Check that mic permission and echo cancellation work in WKWebView before switching.
3. Tauri — proper `.app` bundle with menubar icon; larger effort.

A **menu bar icon** (e.g. `rumps`) with "Talk", "Today", "Quit" is a nice
assistant touch regardless of the window choice.

## Done when

- Someone looking at the screen can tell the state in under a second without reading.
- No glow, no emoji status, no plumbing names, no decorative panels.
- Answers with code and lists render properly and can be copied.
