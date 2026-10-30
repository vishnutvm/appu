"""
APPU Speech-to-Text Engine.
Uses VoiceStudio POST /v1/audio/transcriptions (faster-whisper on Apple Silicon)
with automatic fallback to local MLX Whisper Metal GPU.
"""

import io
import json
import time
from typing import Optional, Tuple
import urllib.request
import urllib.error
import uuid

try:
    import numpy as np
    import mlx_whisper
    import soundfile as sf
    MLX_WHISPER_AVAILABLE = True
except ImportError:
    MLX_WHISPER_AVAILABLE = False


class LocalSTTEngine:
    """Fallback local MLX Whisper STT engine directly on Apple Silicon Metal."""
    def __init__(self, model_name: str = "mlx-community/whisper-base.en-mlx"):
        self.model_name = model_name
        self._is_warmed = False

    def is_available(self) -> bool:
        return MLX_WHISPER_AVAILABLE

    def warmup(self) -> bool:
        """Run a short 0.1s silent sample to compile Metal shaders and keep model warm."""
        if not self.is_available() or self._is_warmed:
            return self._is_warmed
        try:
            silence = np.zeros(1600, dtype=np.float32)
            mlx_whisper.transcribe(silence, path_or_hf_repo=self.model_name)
            self._is_warmed = True
            return True
        except Exception as e:
            print(f"[!] STT Warmup error: {e}")
            return False

    def transcribe(self, audio_bytes: bytes) -> Tuple[str, float]:
        """
        Transcribe audio bytes (WAV format, 16kHz) to text.
        Returns (transcription_text, latency_seconds).
        """
        if not self.is_available():
            raise RuntimeError("mlx-whisper or soundfile is not installed.")

        t0 = time.time()
        buf = io.BytesIO(audio_bytes)
        try:
            samples, sr = sf.read(buf, dtype="float32")
        except Exception as exc:
            raise ValueError(f"Could not decode audio data: {exc}")

        # Resample to 16kHz if needed
        if sr != 16000:
            import scipy.signal
            num_samples = int(len(samples) * 16000 / sr)
            samples = scipy.signal.resample(samples, num_samples).astype(np.float32)

        # Ensure mono
        if len(samples.shape) > 1:
            samples = samples.mean(axis=1).astype(np.float32)

        # Guard against empty audio
        if len(samples) < 1600:  # < 0.1s
            return "", time.time() - t0

        result = mlx_whisper.transcribe(
            samples,
            path_or_hf_repo=self.model_name,
            initial_prompt="Appu, the personal AI assistant running locally on Mac.",
            condition_on_previous_text=False,
            temperature=0.0,
        )

        latency = time.time() - t0
        text = result.get("text", "").strip()
        return text, latency


class VoiceStudioSTTEngine:
    """
    Primary STT engine using the local VoiceStudio instance.
    POST http://127.0.0.1:3900/v1/audio/transcriptions (faster-whisper).
    """
    def __init__(self, base_url: str = "http://127.0.0.1:3900", model: str = "whisper-1"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.local_fallback = LocalSTTEngine()
        self._available_cache: Optional[bool] = None
        self._last_health_check = 0.0

    def is_available(self, timeout: float = 1.0) -> bool:
        now = time.time()
        if self._available_cache is not None and (now - self._last_health_check) < 5.0:
            return self._available_cache
        try:
            req = urllib.request.Request(f"{self.base_url}/health")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                self._available_cache = (resp.status == 200)
                self._last_health_check = now
                return self._available_cache
        except Exception:
            self._available_cache = False
            self._last_health_check = now
            return self.local_fallback.is_available()

    def warmup(self) -> bool:
        """Warm up VoiceStudio connection or local MLX Whisper fallback."""
        if self.is_available():
            return True
        if self.local_fallback.is_available():
            return self.local_fallback.warmup()
        return False

    def transcribe(self, audio_bytes: bytes) -> Tuple[str, float]:
        """
        Transcribe audio bytes (WAV format) using VoiceStudio POST /v1/audio/transcriptions,
        falling back to local MLX Whisper if VoiceStudio is unreachable.
        """
        if not audio_bytes or len(audio_bytes) < 44:
            raise ValueError("Audio data is empty or too short.")

        t0 = time.time()
        if self.is_available():
            try:
                boundary = "----AppuVoiceStudioBoundary" + uuid.uuid4().hex
                body = io.BytesIO()
                body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n{self.model}\r\n'.encode('utf-8'))
                body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode('utf-8'))
                body.write(audio_bytes)
                body.write(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
                payload = body.getvalue()

                req = urllib.request.Request(
                    f"{self.base_url}/v1/audio/transcriptions",
                    data=payload,
                    headers={
                        "Content-Type": f"multipart/form-data; boundary={boundary}",
                        "Content-Length": str(len(payload))
                    }
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    text = res.get("text", "").strip()
                    return text, time.time() - t0
            except Exception as exc:
                print(f"[!] VoiceStudio STT error, falling back to local: {exc}")

        # Fallback to local MLX STT
        if self.local_fallback.is_available():
            return self.local_fallback.transcribe(audio_bytes)
        raise RuntimeError("Neither VoiceStudio nor local STT is available.")


# Global STT engine singleton using VoiceStudio with MLX fallback
LOCAL_STT = VoiceStudioSTTEngine()
