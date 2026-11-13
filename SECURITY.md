# Security policy

## Supported versions

Security fixes are applied to the latest release on the `main` branch and published as patch releases.

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
| Older   | Best effort |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead:

1. Use [GitHub private vulnerability reporting](https://github.com/vishnutvm/appu/security/advisories/new) for this repository, **or**
2. Open a minimal issue asking maintainers to enable private contact if reporting is unavailable.

Include:

- A description of the issue and potential impact
- Steps to reproduce (proof of concept if possible)
- Affected versions and platforms (macOS / Windows / web dev mode)

We aim to acknowledge reports within **72 hours** and will coordinate a fix and disclosure timeline with you.

## Security model (summary)

- **Renderer**: `contextIsolation`, sandboxed preload bridge, privileged IPC restricted to trusted top-frame senders (see `electron/ipc-security.ts`).
- **API keys**: Gemini keys live in the **main process** only. User keys are encrypted with Electron `safeStorage` when the OS supports it; they are never exposed to the renderer.
- **Updates**: Downloads require explicit user approval (`autoDownload` is off).

If you are auditing the project, start with `electron/preload.ts`, `electron/ipc-security.ts`, and `electron/services/credential-service.ts`.
