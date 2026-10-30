# Phase 1 — Voice Loop (FRIDAY-style conversation)

The single biggest change in how Appu feels. Today it is "press a button, speak,
check the text box, press Enter, listen". The target is "just talk".

## What is wrong today

| Problem | Where | Effect |
|---|---|---|
| Transcript goes into the input box; you must press Enter | `appu_ui.html` `stopRecordingAndTranscribe` | Not hands-free |
| TTS plays through `afplay`, outside the browser | `voice.py` `_playback_worker` | Chrome's echo cancellation cannot hear Appu's own voice, so the mic picks it up and barge-in cannot work reliably |
| Mic is off while Appu speaks | `startRecording` only on PTT/VAD click | You cannot interrupt |
| End of speech = volume above 0.025, then 600 ms silence | `onaudioprocess`, `vadCheckInterval` | Cuts you off mid-thought; triggers on noise |
| UI waits for the full reply, then fakes typing | `sendUserMessage`, `typeReply` | Text and voice are out of sync; 60 s timeout kills long answers |
| No conversation history | `ask_local_model` builds `[system, user]` only | "Do that again", "what did I just say" fail |
| `ScriptProcessorNode` | `initAudioCapture` | Deprecated in Chrome; runs on the main thread |
| Two separate speech paths (`VOICE.speak` and `StreamingVoiceSession`) | `voice.py` | Duplicate logic, different behaviour |

## Target architecture

```
Browser (mic + speaker, one place for both)
  AudioWorklet mic capture (16 kHz) ──WebSocket──▶ Python server
                                                    Silero VAD v5      (is someone speaking?)
                                                    Smart Turn v3      (have they finished their thought?)
                                                    STT                (Parakeet MLX or Whisper)
                                                    LLM (streaming, with history + tools)
                                                    Phrase buffer → Kokoro TTS
  <audio> playback  ◀──WebSocket (PCM chunks)───── audio chunks + text deltas + state events
```

Key decision: **play TTS in the browser, not with `afplay`.** Then Chrome's
built-in echo cancellation (`echoCancellation: true`) knows what Appu is saying
and removes it from the mic, so the mic can stay open and you can interrupt.

One WebSocket (`/ws`) replaces most of the polling endpoints. Messages:

- client → server: `audio` (PCM frames), `text` (typed message), `interrupt`, `config`
- server → client: `state` (listening/thinking/speaking/idle), `transcript_partial`,
  `transcript_final`, `text_delta`, `audio_chunk`, `tool_event`, `notification`, `done`

Python option: the standard library has no WebSocket server. Use `websockets`
(small, asyncio) or move the server to FastAPI/Starlette + uvicorn. FastAPI is
the easier long-term choice once the app has more endpoints.

## Conversation states

```
idle ──(wake / click / hotkey)──▶ listening
listening ──(Smart Turn says "finished")──▶ thinking
thinking ──(first TTS chunk)──▶ speaking
speaking ──(audio done)──▶ listening   (follow-up window, e.g. 8 s)
speaking ──(user starts talking)──▶ interrupted ──▶ listening
listening ──(8 s of silence in follow-up window)──▶ idle
```

The follow-up window is what makes it feel like a conversation: after Appu
answers, it keeps listening briefly without you pressing anything.

## Checklist

Status 30 Oct 2026. Transport note: replies stream as newline-delimited JSON on
`POST /api/chat` (same event names as above), and turn checks are a small
`POST /api/voice/turn` per pause, instead of one WebSocket. Swapping the
transport to a WebSocket later does not change the event format.

### Step 1 — Conversation history (small, do first)
- [x] Keep a per-session `messages` list on the server (system + last N turns). (`conversation.py`)
- [x] Trim by token budget (last 12 turns, max ~12k characters; summaries come in Phase 2).
- [x] Add a "new conversation" action in the UI (NEW button, Cmd+K).

### Step 2 — Stream text to the UI
- [x] Send `text_delta` events as tokens arrive; drop `typeReply` fake typing.
- [x] Remove the 60 s client-side abort; rely on server-side timeout + a Stop button (Esc).

### Step 3 — Move audio playback into the browser
- [x] `StreamingVoiceSession` produces WAV bytes instead of temp files.
- [x] Send them as `audio_chunk` events; play with Web Audio in order (routed through an `<audio>` element).
- [x] Remove `afplay` and temp files from the streaming path. Keep `say` only
      as a last-resort fallback for reminder alerts when no window is open.
- [x] Reminder alerts use the same Kokoro path (`/api/tts`, played in the window) when a window is open.

### Step 4 — Real turn detection
- [x] Replace `ScriptProcessorNode` with an `AudioWorklet` that posts 20 ms frames.
- [x] Silero VAD v5 on the server (`turn.py`) rejects pauses that contain no speech.
      Speech *start* is still detected in the browser from energy (instant barge-in).
- [x] Smart Turn v3.2 decides whether a pause ends the turn (checked after 200 ms of
      silence, max 2 s pause). Falls back to 900 ms silence if the models are missing.
- [x] On speech start while Appu is speaking: stop TTS immediately (barge-in),
      cancel the LLM stream, keep the partial answer in history marked as interrupted.

### Step 5 — Hands-free and wake options
- [x] Global hotkey (Ctrl+Space, in-window) toggles "conversation mode" (TALK button).
- [x] After each answer, stay in `listening` for an 8 s follow-up window.
- [ ] Optional later: "Hey Appu" wake word (see `docs/wake_word_design.md`).
      openWakeWord can train a custom phrase; keep it off by default.

### Step 6 — Make it sound human
- [x] Spoken replies short by default; only the first paragraph is spoken, details after
      a blank line / list / code are shown, not read (`SpokenPartFilter`).
- [x] Short acknowledgement while a tool runs ("Checking your reminders.").
- [x] Do not read code, URLs or lists aloud; say "I've put the details on screen".
- [x] Kokoro speed 1.05; first phrase from 3 words, breaks early at a comma.
      Also fixed a 0.5 s per-phrase espeak reload (Kokoro phrase: ~0.9 s -> ~0.35 s).

### Step 7 — Measure latency
- [x] Log per turn (JSON line): STT time, end of speech -> request, first token, first audio.
- [ ] Target on M4: under ~1.2 s from end of your speech to Appu's first word.
      Measured server-side: first audio 1.1–1.8 s after the request (qwen3.5:4b, warm).
      Needs a real-mic measurement; end of speech -> transcription start is ~0.15 s with Smart Turn.

## Libraries and references

- Silero VAD v5 — https://github.com/snakers4/silero-vad
- Smart Turn v3 (Pipecat) — https://github.com/pipecat-ai/smart-turn
- Hugging Face speech-to-speech (full reference pipeline: VAD → STT → LLM → TTS,
  supports MLX on Mac) — https://github.com/huggingface/speech-to-speech
- voice-loop (M4 reference: Moonshine + Kokoro + Silero + Smart Turn + echo
  cancellation barge-in, plus a simple `MEMORY.md` memory) —
  https://github.com/jimwhite/voice-loop
- openWakeWord (custom wake words) — https://github.com/dscripka/openWakeWord

Read those two reference projects before building; borrowing their turn-taking
logic is cheaper than inventing it.

## Done when

- You can say "Appu, what's on my list today?" then "push the second one to
  tomorrow" without touching the keyboard.
- Talking over Appu stops it within ~300 ms.
- Pausing mid-sentence does not cut you off.
- Text appears on screen in sync with the voice.
