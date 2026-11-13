# AI and privacy (bring your own key)

Appu is **not** a hosted AI product. You run the app locally and optionally connect it to Gemini using **your own API key**. There is no Appu cloud that stores your chats for training or ads.

## What leaves your machine

When you configure a Gemini key and send a message:

- Message content and tool context needed for the reply are sent to **Google's Gemini API** under [Google's terms](https://ai.google.dev/terms).
- Nothing is sent until you set a key and use AI features.

When you do **not** use AI:

- The companion, animations, and local reminders still work; only provider calls are skipped.

## Where secrets live

| Storage | Location | Notes |
|---------|----------|--------|
| UI-saved key | OS-backed `safeStorage` in `userData` | Preferred on macOS/Windows when encryption is available |
| Dev fallback | `.env` → `GEMINI_API_KEY` | Never commit; see `.env.example` |
| Runtime | Main process only | Renderer cannot read the raw key |

## Local data

SQLite (`appu.db`) in application `userData` holds:

- Conversation threads
- Reminders and schedules
- AI model preferences (not the key itself when encrypted)

Backups and update behavior are described in [distribution-and-updates.md](distribution-and-updates.md).

## Threat model (practical)

- **Designed for**: Single-user desktop; keeping keys out of the renderer; validating IPC senders.
- **Not designed for**: Multi-tenant server deployment or untrusted renderer code execution.

Report security issues via [SECURITY.md](../SECURITY.md), not public issues.
