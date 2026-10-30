# Model Choices per Job

Researched 30 Oct 2026. Benchmarks change monthly — before switching, try the
model on your own prompts for a day. Your machine: Mac mini M4, 16 GB.

## Summary

| Job | Free local (private) | Free cloud | Paid (best quality) |
|---|---|---|---|
| Voice chat + tool calling | `gemma4:e4b` or `qwen3.5:9b` (keep `qwen3.5:4b` as fast fallback) | Groq `openai/gpt-oss-20b` | — (local is fast enough) |
| Code review / explain | `qwen3.5:9b` for small diffs | Gemini Flash (1M context) or Groq `openai/gpt-oss-120b` | Claude Sonnet / GPT-class model via API |
| Document review / long text | `gemma4:12b`-class (~7 GB) for short docs | Gemini Flash (1M context) | Claude / Gemini Pro |
| Web page summary | voice model | Gemini Flash | — |
| Speech to text | Parakeet TDT (MLX) or `mlx-whisper` small/turbo | Groq `whisper-large-v3` | — |
| Text to speech | Kokoro-82M (current) | — | ElevenLabs / OpenAI TTS if you want a premium voice |
| Voice activity + turn end | Silero VAD v5 + Smart Turn v3 | — | — |
| Memory embeddings | `nomic-embed-text` or `embeddinggemma` via Ollama | — | — |

Recommended setup: **local for voice, chat, tasks and memory** (private, no
limits, low latency); **free cloud only when you ask for a review** of a large
diff or document; paid only if you find the free review quality lacking.

## 1. Voice chat and tool calling (always loaded)

This model must be fast (first token well under 1 s) and call tools correctly.

- **`gemma4:e4b`** — best measured tool-calling accuracy on a 16 GB M4 in a
  community benchmark (95% of 20 agent tasks; slower per task than qwen3:8b).
  ~5 GB. Also accepts image/audio input, which is useful later.
  Source: https://dev.to/herinpatel15/i-built-a-pip-tool-to-test-how-well-any-local-llm-calls-tools-here-is-what-my-demo-run-showed-177c
- **`qwen3.5:9b`** — scores ~90.6 on Local Agent Bench (16 GB tier), ~6.7 GB.
  Same family as your current model, so prompts carry over.
  Source: https://localagentbench.com/
- **`nemotron-3.5-bolt:e4b`** — NVIDIA's tuning of Gemma 4 E4B for multi-turn
  tool use; community run ~27 tok/s on a 16 GB M4. Worth a trial.
  Source: https://llmcheck.net/blog/best-local-llm-16gb-mac/
- **`qwen3.5:4b`** (current) — keep as the fast fallback and for very short replies.

How to pick: run your 20 most common requests (reminders, tasks, "remember",
chit-chat) against each, measure tool-call correctness and time to first token.
Keep `think: false` for voice.

## 2. Code and document review (on demand)

Reviews need a large context window and better reasoning than a 4–9B model gives.

Local options that fit in 16 GB with Appu running:
- `qwen3.5:9b` — fine for a small diff or one file.
- A ~12B model (e.g. Gemma 4 12B, ~7 GB at 4-bit) — better quality, slower.
  Unload the voice model while it runs, or accept slower speeds.
- `gpt-oss:20b` (~14 GB) is strong but too large to run beside everything else
  on 16 GB. Only use if you close other apps.

Free cloud (no card needed to start):
- **Google Gemini API, Flash models** — 1M-token context, ideal for whole
  documents or big diffs. Limits are per project and shown in AI Studio.
  **Catch:** free-tier content may be used to improve Google's products. Do not
  send work code you are not allowed to share.
- **Groq** — very fast. `openai/gpt-oss-120b` and `openai/gpt-oss-20b`:
  30 requests/min, 1,000 requests/day, 200K tokens/day per model on the free
  plan. Also free `whisper-large-v3` STT. OpenAI-compatible API.
- **OpenRouter `:free` models** — rotating open models, 20 requests/min,
  50/day (1,000/day after a one-time $10 credit purchase). Some providers
  may train on prompts; check each model's page.

Sources: https://grokified.com/blog/free-llm-api ,
https://github.com/mnfst/awesome-free-llm-apis

Paid: a Claude Sonnet- or GPT-class API gives the best review quality. Use pay
per use with a monthly spend cap. Only worth it if free reviews miss things.

Privacy rule for Appu: work repos (e.g. GPS/Norq) → local model or a paid API
with no training on your data. Personal projects → free cloud is fine.

## 3. Speech to text

- Current: VoiceStudio (faster-whisper) → MLX Whisper `base.en` fallback.
- Better local: **Parakeet TDT** via MLX (English, very fast, used as default
  in Hugging Face speech-to-speech) or `mlx-whisper` with a `small.en` /
  `large-v3-turbo` model for better accuracy with Indian English accents.
- Streaming partial transcripts (show words as you speak): Moonshine or
  Nemotron streaming models — nice to have, not required.
- Free cloud fallback: Groq `whisper-large-v3` (2,000 requests/day).

Test with your own voice: record 20 typical commands, compare word errors and latency.

## 4. Text to speech

- **Kokoro-82M** (current) is a good choice: fast on CPU, natural, many voices.
  Keep it.
- Alternatives to audition locally: Qwen3-TTS (default in HF speech-to-speech,
  heavier), Pocket TTS (100M, streaming), Supertonic. Only switch if a voice
  clearly sounds better to you.
- Premium (paid, cloud): ElevenLabs or OpenAI TTS — most "FRIDAY-like" voice
  quality, but adds network latency and cost to every reply.

## 5. Turn-taking

- **Silero VAD v5** — speech/no-speech, tiny, CPU.
- **Smart Turn v3** (Pipecat) — decides if you have finished speaking from the
  audio itself; this is what stops Appu cutting you off mid-pause.
- Echo cancellation: play audio in the browser so Chrome's AEC works (see
  `01-voice-loop.md`). For a native app later, WebRTC AEC3.

## 6. Memory embeddings

- Start with SQLite FTS5 (no model).
- When memories grow past a few hundred: `nomic-embed-text` or `embeddinggemma`
  via Ollama (small, local), store vectors in SQLite (`sqlite-vec`).

## Wiring it up

Add a small LLM client layer with two backends:

- `OllamaClient` (current code, moved out of `appu.py`).
- `OpenAICompatClient` — works for Groq, OpenRouter, Gemini's OpenAI-compatible
  endpoint, and most paid providers. One class, different `base_url` + key.

Config example:

```toml
[models]
voice  = { provider = "ollama", model = "gemma4:e4b" }
review = { provider = "groq",   model = "openai/gpt-oss-120b" }
review_private = { provider = "ollama", model = "qwen3.5:9b" }
```
