# Appu Desktop Distribution & Auto-Update System Guide

This document outlines the architecture, packaging configuration, automatic update flow, release channel system, CI/CD pipelines, and testing procedures for **Appu** on macOS and Windows.

---

## 1. Architecture Overview

Appu uses an enterprise-grade, secure Electron architecture separating the auto-update engine, IPC bridge, data storage, and user interface.

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                       │
│  (React 19 + TypeScript, contextIsolation: true, sandbox)   │
│                                                             │
│   ┌────────────────────────┐    ┌────────────────────────┐  │
│   │   UpdateNotification   │    │     SettingsModal      │  │
│   │   (Pill / Progress)    │    │ (Channels / Approval)  │  │
│   └───────────┬────────────┘    └───────────┬────────────┘  │
└───────────────┼─────────────────────────────┼───────────────┘
                │                             │
                ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload Context Bridge                   │
│          window.desktopAPI.updater & .storage               │
└───────────────────────────────┬─────────────────────────────┘
                                │ Typed, scoped IPC invoke/on
                                │ (Sender identity validated)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                         │
│                                                             │
│   ┌────────────────────────┐    ┌────────────────────────┐  │
│   │     UpdaterService     │    │     StorageService     │  │
│   │   (electron-updater)   │    │  (app.getPath userData)│  │
│   │ • autoDownload = false │    │ • SQLite DB backups    │  │
│   │ • Channel filtering    │    │ • Atomic settings.json │  │
│   │ • Reminder safe delays │    │ • Data preservation   │  │
│   └────────────────────────┘    └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Security Guardrails:
1. **Isolated Execution**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
2. **IPC Sender Validation**: Every IPC invocation verifies that `event.sender` matches `mainWindow.webContents` and disallows child/nested iframes (`event.senderFrame.parent !== null`).
3. **No Direct Node.js Exposure**: The renderer only accesses narrowly typed methods exposed via `contextBridge`.
4. **Approval Gate**: `autoDownload` and `autoInstallOnAppQuit` are set to `false`. Downloads and installations require explicit user interaction.

---

## 2. Update Lifecycle & State Machine

The update system transitions through 8 discrete states:

```
               ┌───────────┐
               │   Idle    │
               └─────┬─────┘
                     │ Check (Startup / Manual)
                     ▼
               ┌───────────┐
      ┌────────┤ Checking  ├────────┐
      │        └─────┬─────┘        │
      │ Up to date   │ Available    │ Network / Check error
      ▼              ▼              ▼
┌────────────┐ ┌─────────────┐ ┌─────────┐
│ Up To Date │ │   Update    │ │  Error  │◄── Retry
└────────────┘ │  Available  │ └─────────┘
               └─────┬───────┘
                     │ User clicks "Update Now"
                     ▼
               ┌─────────────┐
               │ Downloading ├──────┐
               └─────┬───────┘      │ Interrupted
                     │ Downloaded   ▼
                     ▼         ┌─────────┐
               ┌─────────────┐ │  Error  │
               │ Downloaded  │ └─────────┘
               └─────┬───────┘
                     │ User clicks "Restart Now"
                     ▼
               ┌─────────────┐
               │ Installing  │ (Backs up DB -> quitAndInstall)
               └─────────────┘
```

### Reminder Collision Avoidance:
If a user reminder bubble is actively firing or on screen, the `UpdaterService` suppresses notification display until the reminder is dismissed or completed, preventing distraction during important tasks.

---

## 3. Data Persistence & SQLite Safety

User data is strictly decoupled from the application binary:

- **Storage Location**: Operating system application data directory (`app.getPath('userData')`).
  - **macOS**: `~/Library/Application Support/Appu/`
  - **Windows**: `%APPDATA%\Appu\`
- **Files Preserved**:
  - `appu.db` (SQLite database: memories, tasks, reminders, conversations).
  - `settings.json` (preferences: channels, pinned status, audio, update schedules).
  - `backups/` (timestamped database snapshots).
- **Safety Pre-Install Snapshot**:
  Whenever an update finishes downloading, `StorageService.createDatabaseBackup('pre_install_v...')` creates an automatic backup in `userData/backups/appu_backup_pre_install_vX.X.X_<timestamp>.db`.
- **NSIS Uninstaller Setting**: `deleteAppDataOnUninstall: false` ensures that updating or reinstalling on Windows never purges user preferences or SQLite files.

---

## 4. Release Channels

Appu supports three update channels:

| Channel | Description | Update File Generated |
| :--- | :--- | :--- |
| **Stable** | Production releases for all general users. | `latest.yml`, `latest-mac.yml` |
| **Beta** | Prereleases for beta testers (`-beta.X`). | `beta.yml`, `beta-mac.yml` |
| **Development** | Nightly or dev builds (`-dev.X`). | Development artifacts |

### Switching Channels:
1. Users open **Settings** (Click Appu -> Settings -> Preferences).
2. Under **Software Updates**, toggle between **Stable**, **Beta**, or **Development**.
3. Appu saves the choice to `settings.json` and immediately initiates a check against the selected channel.

---

## 5. Packaging Configuration

Packaging is handled by `electron-builder.json`:

### macOS
- **Target**: DMG (`dmg`) and Zip (`zip`).
  *(Zip is required for electron-updater automatic delta/in-app updates on macOS).*
- **Architectures**: Apple Silicon (`arm64`) and Intel (`x64`).
- **Hardened Runtime**: `hardenedRuntime: true`.
- **Entitlements**: `build/entitlements.mac.plist` (JIT, unsigned executable memory, network client/server, microphone, camera).

### Windows
- **Target**: NSIS (`.exe`).
- **Architectures**: `x64`.
- **Installation Directory**: Custom directory selection enabled (`oneClick: false`, `allowToChangeInstallationDirectory: true`).
- **Shortcuts**: Start Menu and desktop shortcut creation enabled (`createDesktopShortcut: "always"`).

---

## 6. GitHub Actions CI/CD Pipeline

The `.github/workflows/release.yml` workflow automates cross-platform builds and releases.

### Trigger:
- Pushing any git tag starting with `v` (e.g. `git push origin v1.0.1` or `v1.1.0-beta.1`).
- Or manual trigger via `workflow_dispatch` selecting the target release channel.

### Matrix:
1. **macOS Runner** (`macos-14`): Compiles frontend, runs Vitest suite, codesigns with Apple Developer ID, notarizes via `notarytool`, and uploads DMG, ZIP, and `latest-mac.yml` / `beta-mac.yml`.
2. **Windows Runner** (`windows-latest`): Compiles frontend, runs Vitest suite, codesigns executable, and uploads NSIS setup `.exe`, `.blockmap`, and `latest.yml` / `beta.yml`.

---

## 7. Required Environment Variables & Secrets

For local building, no credentials are required (unpacked or unsigned binaries build directly). For production signed distribution, configure the following GitHub Secrets:

### Apple Developer (macOS):
| Variable | Description |
| :--- | :--- |
| `MAC_CSC_LINK` | Base64-encoded Apple Developer ID Application Certificate (`.p12`). |
| `MAC_CSC_KEY_PASSWORD` | Password for the `.p12` certificate. |
| `APPLE_ID` | Apple Developer Account email address. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated from appleid.apple.com for notarytool. |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID. |

### Microsoft Authenticode (Windows):
| Variable | Description |
| :--- | :--- |
| `WIN_CSC_LINK` | Base64-encoded Windows Code Signing Certificate (`.pfx`). |
| `WIN_CSC_KEY_PASSWORD` | Password for the `.pfx` certificate. |

### GitHub Releases:
| Variable | Description |
| :--- | :--- |
| `GITHUB_TOKEN` | Automatically supplied by GitHub Actions with `contents: write` permission. |

> **Security Note**: Never embed private tokens or certificates in the client source code. `electron-updater` only requires public HTTPS read access to release assets.

---

## 8. Private Beta Distribution Architecture

For private distribution where release assets cannot be public on GitHub:
1. `electron-builder` supports `generic` or `s3` update providers in `electron-builder.json`:
   ```json
   "publish": {
     "provider": "generic",
     "url": "https://updates.yourdomain.com/appu/${os}/${arch}"
   }
   ```
2. For authenticated endpoints, custom request headers (such as bearer tokens or device licenses) can be supplied dynamically in `electron/updater-service.ts`:
   ```ts
   autoUpdater.requestHeaders = {
     'Authorization': `Bearer ${userLicenseToken}`
   };
   ```

---

## 9. Local Build & Test Commands

Run these commands from the project root:

```bash
# 1. Install dependencies
npm install

# 2. Run unit and integration tests (82 tests covering updater, UI, storage, IPC)
npm test

# 3. Compile frontend & electron
npm run build:all

# 4. Run local desktop app in companion mode
npm run desktop

# 5. Package local application directory without installers (unpackaged test)
npm run pack

# 6. Build macOS DMG & ZIP locally
npm run dist:mac

# 7. Build Windows NSIS installer
npm run dist:win
```

---

## 10. Publishing a New Release

To release a new version:

```bash
# 1. Bump version and update package.json & package-lock.json
# Options: patch | minor | major | beta
npm run version:bump patch
# Or for beta:
# npm run version:bump beta

# 2. Commit and push tag
git add package.json package-lock.json
git commit -m "chore(release): v1.0.1"
git tag v1.0.1
git push origin main --tags
```

The GitHub Actions release workflow will automatically run tests, build the macOS and Windows binaries, generate updater metadata files, and publish the release draft/assets to GitHub Releases.

---

## 11. Verification Checklist

- [x] Initial macOS DMG & ARM64/x64 packaging verified via `electron-builder`.
- [x] Windows NSIS directory selection and shortcut generation configured.
- [x] Automatic update check shortly after startup with safe delays.
- [x] Manual update check from SettingsModal with loading spinner.
- [x] Auto-download strictly disabled (`autoDownload = false`).
- [x] User approval required to initiate download.
- [x] Real-time download progress bar with speed and transferred MBs.
- [x] User approval required to restart and install (`quitAndInstall()`).
- [x] Postponing updates remembers the version without repeated nagging.
- [x] Active reminder coordination suppresses update notifications during alerts.
- [x] User SQLite database (`appu.db`) and settings stored in `app.getPath('userData')`.
- [x] Automatic database backups before applying updates or restart.
- [x] Channel selector supporting Stable, Beta, and Development.
- [x] IPC sender frame and webContents security validation.
- [x] Complete Vitest test suite (82 passing tests).
