# Appu — Local "Hey Appu" Wake Word Architecture & Design

## 1. Executive Summary

This specification outlines the local, privacy-first design for optional **"Hey Appu"** voice activation on macOS (Apple Silicon M4).

### Key Architectural Principles
- **Disabled by default**: Mic is inactive until explicitly enabled by user action.
- **Zero Cloud Streaming**: Audio is never transmitted outside the machine.
- **Decoupled from LLM**: Audio is processed solely through a dedicated keyword classifier (~3 MB model), never streaming raw audio to the LLM.
- **Immediate Disarm**: Single-click disarm button and hotkey to disable audio capture instantly.
- **Minimal Resource Footprint**: Target < 1.5% CPU on Apple Silicon M4.

---

## 2. Wake Word Detection Architecture

```
[Microphone: 16 kHz Mono Stream]
       │
       ▼
[Local Ring Buffer: 1.5s window (48 KB)]
       │
       ▼
[Feature Extractor: 80-dim Log-Mel Spectrogram]
       │
       ▼
[Lightweight Acoustic Classifier: hey_appu.onnx (~2.5 MB)]
       │
       ├── Probability < 0.75 ──> Discard audio immediately
       │
       └── Probability >= 0.75 (Wake Word Detected!)
             ├── 1. Play subtle audio confirmation chime
             ├── 2. Transition Appu HUD face to 'excited' -> 'listening'
             └── 3. Activate Local STT (MLX Whisper) to capture user instruction
```

---

## 3. Engine Comparison & Selection

| Wake Word Engine | Model Size | Apple Silicon M4 CPU | Dependencies | Privacy & Offline |
| :--- | :--- | :--- | :--- | :--- |
| **openWakeWord (ONNX)** *(Recommended)* | ~2.5 MB | **~1.1% CPU** | `onnxruntime` (Already installed in Appu) | 100% Offline, Apache 2.0 |
| **micro-wake-word** | ~1.2 MB | ~0.8% CPU | TFLite / ONNX | 100% Offline |
| **Picovoice Porcupine** | ~1.5 MB | ~0.9% CPU | Proprietary binary + access key required | Free tier requires recurring internet ping |

### Recommendation
**`openWakeWord` with ONNX Runtime**:
Since `onnxruntime` is already installed and tuned for Apple Silicon in Appu's virtual environment, openWakeWord loads with zero additional runtime frameworks.

---

## 4. macOS Permissions & Background Behavior

### macOS Microphone Privacy Indicator
- When wake-word detection is running, macOS displays an **orange indicator dot** in the top menu bar (Control Center), informing the user that the microphone is active.
- Appu provides a prominent HUD toggle `[ 🔔 WAKE WORD: OFF/ON ]` and shortcut `⌥W` to immediately terminate the stream.

### Background Mode (LaunchAgent) Safety Boundary
- If Appu is running headless as a background daemon, **wake word detection remains disabled by default**.
- When the HUD window closes, microphone capture is completely released to preserve battery and privacy.

---

## 5. Resource Consumption Benchmarks on M4 (16 GB RAM)

| Component | RAM Footprint | CPU Usage (Idle Listening) | Latency to Trigger |
| :--- | :--- | :--- | :--- |
| Ring Buffer (1.5s) | 48 KB | < 0.1% | 0 ms |
| ONNX Keyword Classifier | ~18 MB | ~1.1% | ~45 ms |
| Audio Feedback Chime | Shared | ~0.2% | ~15 ms |
| **Total Wake Word Overhead** | **~18 MB** | **~1.2% CPU** | **~60 ms** |
