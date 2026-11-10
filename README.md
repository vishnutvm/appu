# Appu

Appu is a **desktop 3D companion** — an always-on-top Electron app with a React Three Fiber character. The product lives entirely under [`appu-3d/`](./appu-3d/).

This repository is **companion-only**. The former Python voice / LLM assistant stack (`appu.py`, STT/TTS, Ollama tools, LaunchAgent daemon, and related plans) was removed by product decision on **2026-11-10**.

## Quick start

```bash
cd appu-3d
npm install
npm test          # 82 Vitest tests
npm run build:all # Vite client + Electron main
npm start         # Vite + Electron companion (dev)
```

Companion mode: open with `?mode=companion`, or run the packaged Electron app (preload sets `window.desktopAPI`).

## Layout

| Path | Role |
|---|---|
| [`appu-3d/`](./appu-3d/) | Electron + Vite + R3F companion (source of truth) |
| [`docs/distribution-and-updates.md`](./docs/distribution-and-updates.md) | Packaging, auto-update, release channels |
| [`avatar_prototype.html`](./avatar_prototype.html) | Standalone HTML 3D prototype (reference only; not shipped) |
| [`.github/workflows/release.yml`](./.github/workflows/release.yml) | Tag-driven macOS/Windows desktop releases |

## Docs

- Companion app details: [`appu-3d/README.md`](./appu-3d/README.md)
- Distribution & updates: [`docs/distribution-and-updates.md`](./docs/distribution-and-updates.md)
