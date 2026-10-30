#!/usr/bin/env bash
# Download the model files Appu needs into models/ (which is not committed to git).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fetch() {
  local url="$1" dest="$2"
  if [[ -s "$dest" ]]; then
    echo "ok       $dest"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  echo "download $dest"
  curl -fL --progress-bar -o "$dest.part" "$url"
  mv "$dest.part" "$dest"
}

# Kokoro-82M text to speech (~330 MB)
fetch https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
  "$ROOT/models/kokoro/kokoro-v1.0.onnx"
fetch https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin \
  "$ROOT/models/kokoro/voices-v1.0.bin"

# Silero VAD v5 (speech / no speech, ~2 MB)
fetch https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx \
  "$ROOT/models/turn/silero_vad.onnx"

# Smart Turn v3.2 (has the speaker finished their turn?, ~8 MB)
fetch https://huggingface.co/pipecat-ai/smart-turn-v3/resolve/main/smart-turn-v3.2-cpu.onnx \
  "$ROOT/models/turn/smart-turn-v3.2-cpu.onnx"

echo "Models ready. Ollama models are pulled separately, e.g.: ollama pull qwen3.5:4b"
