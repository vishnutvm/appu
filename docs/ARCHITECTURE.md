# Architecture overview

Appu is an **Electron desktop companion** (Vite bundles the renderer; users never use a browser-only product). The **main process** handles AI, storage, and updates.

## High-level layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Renderer (React 19 + Vite)                                      │
│  • Companion overlay: React Three Fiber + procedural/video chars   │
│  • Desktop UI: chat, settings, reminders                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ preload bridge (typed desktopAPI)
┌────────────────────────────▼─────────────────────────────────────┐
│  Main process (Electron)                                         │
│  • Gemini conversation + tool calling (reminders, memory, etc.)  │
│  • SQLite (conversations, reminders, AI settings)                │
│  • Credential encryption (safeStorage)                           │
│  • Auto-update (electron-updater, user-approved downloads)     │
└──────────────────────────────────────────────────────────────────┘
```

## Repository map

| Path | Role |
|------|------|
| `src/` | React UI, 3D companions, client controllers |
| `src/rabbit-companion/` | Procedural rabbit rig, AntiGravity physics, sandbox |
| `public/characters/` | Video character manifests and animation assets |
| `electron/` | Main process, IPC, database, AI providers |
| `electron/ai/` | Gemini provider, conversation service, tools |
| `electron/database/` | SQLite schema and repositories |
| `scripts/` | Release versioning, companion test harness |
| `docs/` | Distribution, animation roadmaps, architecture |

## Characters

- **Robo (Appu)** — Full-body 3D companion on the desktop (meshes, expressions, walk/idle).
- **Rabbit** — R3F procedural character with AntiGravityController (hover, drag, spin, jump physics).
- **Video companions** — Manifest-driven MP4 loops (`character.json` + `src/services/videoCharacterManifest.ts`).

## AI and privacy

- Inference uses **your** [Google Gemini](https://aistudio.google.com/) API key.
- Keys are read in the **main process** only (`electron/services/credential-service.ts`).
- Chat history and reminders stay in **local SQLite** under Electron `userData`.

Details: [AI & privacy](AI-AND-PRIVACY.md).

## Deeper reading

- [Distribution & auto-updates](distribution-and-updates.md)
- [Rabbit animation roadmap](RABBIT_ANIMATIONS_ROADMAP.md)
