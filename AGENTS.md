# Guide for automated coding agents

Appu is an **Electron desktop companion only** (no browser studio). React renderer + hardened main process.

## Read first

| Topic | File |
|-------|------|
| Layout | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Gemini & keys | [docs/AI-AND-PRIVACY.md](docs/AI-AND-PRIVACY.md) |
| IPC trust | `electron/ipc-security.ts` |
| Credentials | `electron/services/credential-service.ts` |
| AI tools | `electron/ai/tools/tool-registry.ts` |
| Companion entry | `electron/companion-entry.ts` |

## Commands

```bash
npm ci
npm test
npm start          # desktop companion (dev)
npm run build:all
```

Do not document or add flows that open `http://localhost:5173` as the product UI.

## Hard rules

1. **Never** expose API keys to the renderer.
2. **Never** bypass `isTrustedSender` without maintainer review.
3. **Never** reintroduce a browser-only “studio” shell as a supported mode.
4. **Run** `npm test` before claiming done.

## Good first tasks

- Companion UX, docs, `electron/` tests
- Character manifests under `public/characters/`
