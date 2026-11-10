# Appu — Interactive 3D AI Character Studio (v2.0 Redesign)

An independent, browser-based, full-body 3D robotic companion and character studio built with React 19, TypeScript, Vite, Three.js, React Three Fiber (R3F), and Drei.

## Visual & Architecture Redesign Overview

### 1. Character Proportions & Industrial Design
- **Harmonious Humanoid Proportions**: Head scale adjusted from disproportionate cartoon oval down to an anatomically balanced ratio matching a friendly personal AI assistant.
- **Substantial Multi-Part Torso**: Dual-shell upper chest and abdomen taper with graphite waist division and satin gold ring trims.
- **Integrated Articulated Neck**: Visible cylindrical graphite neck joint with gold mechanical collar and base bezel ring, creating seamless connectivity between head and chest.
- **Anatomical Arms & Hands**: Visible from front/three-quarters with graphite ball sockets, ceramic shoulder caps, gold accent rings, bicep and forearm segments, graphite palms, articulated thumbs, and multi-finger robotic hands.
- **Balanced Legs & Boots**: Graphite hip sockets, ceramic thighs, articulated knees, calf cylinders, and rounded ceramic boots with flat gold sole plates and side mechanical damper discs.
- **Deep OLED Facial Display**: Curved front glass with 1024x640 dynamic canvas rendering golden dotted luminous ring eyes, warm radial glow pupils, natural eyelid blinking, and expressive mouths across 7 emotions.

### 2. Animation System
- **Idle Motion**: Delta-time gentle breathing and vertical hover.
- **Friendly Wave**: Left arm raises with smooth shoulder yaw/pitch/roll and forearm waving articulation.
- **Walk Cycle**: Coordinated counter-swinging of arms and legs, knee flexing, and subtle body roll.
- **Interactive Eye & Head Gaze**: Smooth lerped head tilting and pupil gaze tracking the mouse cursor.
- **Blinking**: Semi-random natural blink cycles.

### 3. Studio Interface
- Clean, minimal application header with active state pill (`IDLE • HAPPY`).
- Slide-over studio customization drawer that can be opened and closed to maximize 3D focus.
- Categorized controls:
  - **Animations**: Idle, Wave, Walk, Breathing toggle, Blinking toggle, Pause/Resume.
  - **Expressions**: Happy, Neutral, Curious, Confused, Surprised, Sleepy, Wink.
  - **Appearance & Camera**: Full Body, Torso, Face, 3/4 View, Profile, Rotation slider, Distance slider.
  - **Studio Lighting**: Soft Studio, Dramatic Key, Warm Ambient, Cyber Rim.
  - **Advanced & Desktop**: Playback speed, Transparent background mode, Contact ground shadow toggle.

### 4. AI Assistant (Desktop)
- Chat with Appu (⌘K or the menu). Powered by Google Gemini through tools for reminders, memories, and app status.
- Add your Gemini API key and choose the model in **Preferences → AI Brain & Intelligence**. The key is stored with the OS keychain (`safeStorage`); `GEMINI_API_KEY` in `.env` is used as a fallback.
- Reminders support one-time, daily, weekly, and every-N-minutes/hours schedules; deleting reminders or memories through chat always asks for confirmation.

## Running the Application

```bash
npm install
npm run dev
```

Visit [http://localhost:5173/](http://localhost:5173/) in your browser.


## Desktop Packaging & Auto-Update System

Appu provides production packaging and automated update flows:

- **Packaging**: `electron-builder` builds macOS DMG/ZIP (Apple Silicon & Intel) and Windows NSIS (`.exe`) installers.
- **Auto-Updates**: `electron-updater` with explicit approval before downloading and restarting.
- **Data Persistence**: SQLite database (`appu.db`), reminders, and user settings persist in `userData` (`~/Library/Application Support/Appu` on macOS, `%APPDATA%\Appu` on Windows) with automatic pre-install backups in `userData/backups/`.
- **Channels**: Switch between `Stable`, `Beta`, and `Development` channels in Settings.
- **CI/CD**: GitHub Actions workflow (`.github/workflows/release.yml`) builds, signs, notarizes, and publishes releases upon pushing a `v*` tag.

### Building & Packaging:

```bash
# Run unit and integration tests (168 tests)
npm test

# Build frontend and electron
npm run build:all

# Package unpacked desktop application
npm run pack

# Build macOS DMG and ZIP installer
npm run dist:mac

# Build Windows NSIS installer
npm run dist:win

# Bump version and tag
npm run version:bump patch  # or minor, major, beta
```

See [Distribution & Updates Guide](docs/distribution-and-updates.md) for complete details.
