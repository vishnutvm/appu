# Contributing to Appu

Thanks for your interest in Appu. This project is open source under the [MIT License](LICENSE).

Questions and ideas: [GitHub Discussions](https://github.com/vishnutvm/appu/discussions) (prefer over issues when it is not a bug).

Appu is a **desktop companion only** — there is no supported browser/product surface beyond a dev-time gate when Vite is opened without Electron.

## Before you start

1. Read the [README](README.md) and [architecture overview](docs/ARCHITECTURE.md).
2. Search [existing issues](https://github.com/vishnutvm/appu/issues).
3. For large changes, open an issue first.

## Development setup

**Requirements:** Node.js **22+**, npm **10+**, macOS or Windows for full desktop testing.

```bash
git clone https://github.com/vishnutvm/appu.git
cd appu
npm ci
cp .env.example .env   # optional Gemini fallback
npm start              # launches Electron companion (not a browser tab product)
```

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run build:all` if Electron/build changed
- [ ] Docs updated for user-visible behavior
- [ ] No secrets in commits

## Code style

- TypeScript; match existing patterns in `src/` and `electron/`.
- Extend `electron/ai/tools/` rather than one-off privileged IPC.

## AI-assisted contributions

Verify with tests; avoid unrelated refactors; disclose large AI-assisted diffs if helpful.

## Community

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Releases

Maintainers tag `v*` — see [distribution guide](docs/distribution-and-updates.md).
