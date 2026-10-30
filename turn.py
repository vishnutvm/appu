"""
Turn detection: is the user speaking, and have they finished their thought?

- Silero VAD v5 (ONNX) checks that a captured utterance actually contains speech.
- Smart Turn v3 (ONNX, Pipecat) judges from the audio whether a pause is the end
  of the turn or just the speaker thinking.

Both run on CPU in a few milliseconds. Model files live in models/turn/
(see scripts/download_models.sh). Without them, callers fall back to a fixed
silence timeout.
"""

from pathlib import Path
import threading
from typing import Optional

import numpy as np

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False


MODELS_DIR = Path(__file__).resolve().parent / "models" / "turn"
SILERO_PATH = MODELS_DIR / "silero_vad.onnx"
SMART_TURN_PATH = MODELS_DIR / "smart-turn-v3.2-cpu.onnx"

SAMPLE_RATE = 16000
SILERO_CHUNK = 512
SILERO_CONTEXT = 64
SMART_TURN_SECONDS = 8
N_FFT = 400
HOP = 160


def _session(path: Path) -> "ort.InferenceSession":
    so = ort.SessionOptions()
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.inter_op_num_threads = 1
    so.intra_op_num_threads = 1
    so.log_severity_level = 3
    return ort.InferenceSession(str(path), sess_options=so, providers=["CPUExecutionProvider"])


class SileroVAD:
    def __init__(self, path: Path = SILERO_PATH):
        self._session = _session(path)
        self._lock = threading.Lock()

    def speech_probabilities(self, samples: np.ndarray) -> np.ndarray:
        """Speech probability for each 32 ms chunk."""
        state = np.zeros((2, 1, 128), dtype=np.float32)
        context = np.zeros((1, SILERO_CONTEXT), dtype=np.float32)
        sr = np.array(SAMPLE_RATE, dtype=np.int64)
        probs = []
        with self._lock:
            for start in range(0, len(samples) - SILERO_CHUNK + 1, SILERO_CHUNK):
                chunk = samples[start:start + SILERO_CHUNK].reshape(1, -1)
                x = np.concatenate([context, chunk], axis=1)
                out, state = self._session.run(None, {"input": x, "state": state, "sr": sr})
                context = chunk[:, -SILERO_CONTEXT:]
                probs.append(float(out[0][0]))
        return np.array(probs, dtype=np.float32)

    def speech_seconds(self, samples: np.ndarray, threshold: float = 0.5) -> float:
        probs = self.speech_probabilities(samples)
        return float((probs >= threshold).sum()) * SILERO_CHUNK / SAMPLE_RATE


def _mel_filters() -> np.ndarray:
    # Locate the file without importing mlx_whisper, which initialises Metal.
    import importlib.util
    spec = importlib.util.find_spec("mlx_whisper")
    if spec is None or not spec.submodule_search_locations:
        raise RuntimeError("mlx_whisper is not installed (needed for mel filters).")
    path = Path(list(spec.submodule_search_locations)[0]) / "assets" / "mel_filters.npz"
    with np.load(path) as f:
        return f["mel_80"].astype(np.float32)


def whisper_log_mel(samples: np.ndarray, filters: np.ndarray) -> np.ndarray:
    """
    Whisper input features (80 x frames), matching transformers' WhisperFeatureExtractor
    with do_normalize=True: per-utterance normalisation, centred STFT with a periodic
    Hann window, Slaney mel filters, log10, 8 dB dynamic range clamp, scaled to ~[-1, 1].
    """
    x = samples.astype(np.float64)
    x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)
    x = np.pad(x, (N_FFT // 2, N_FFT // 2), mode="reflect")
    window = np.hanning(N_FFT + 1)[:-1]
    n_frames = 1 + (len(x) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n_frames)[:, None]
    spectrum = np.fft.rfft(x[idx] * window, axis=1)
    power = (np.abs(spectrum) ** 2).T[:, :-1]
    mel = filters.astype(np.float64) @ power
    log_spec = np.log10(np.maximum(mel, 1e-10))
    log_spec = np.maximum(log_spec, log_spec.max() - 8.0)
    return ((log_spec + 4.0) / 4.0).astype(np.float32)


class SmartTurn:
    def __init__(self, path: Path = SMART_TURN_PATH):
        self._session = _session(path)
        self._filters = _mel_filters()
        self._lock = threading.Lock()

    def completion_probability(self, samples: np.ndarray) -> float:
        """Probability (0..1) that the speaker has finished their turn."""
        n = SMART_TURN_SECONDS * SAMPLE_RATE
        audio = samples[-n:]
        if len(audio) < n:
            audio = np.pad(audio, (n - len(audio), 0))
        features = whisper_log_mel(audio, self._filters)[None, :, :]
        with self._lock:
            out = self._session.run(None, {"input_features": features})
        return float(out[0][0][0])


class TurnDetector:
    """Loads both models lazily; `available()` is False if either is missing."""

    MIN_SPEECH_SECONDS = 0.2
    COMPLETE_THRESHOLD = 0.5

    def __init__(self):
        self._vad: Optional[SileroVAD] = None
        self._turn: Optional[SmartTurn] = None
        self._load_lock = threading.Lock()
        self._load_failed = False

    def available(self) -> bool:
        return (
            ONNX_AVAILABLE
            and not self._load_failed
            and SILERO_PATH.exists()
            and SMART_TURN_PATH.exists()
        )

    def _ensure_loaded(self) -> bool:
        if not self.available():
            return False
        with self._load_lock:
            if self._vad is None or self._turn is None:
                try:
                    self._vad = SileroVAD()
                    self._turn = SmartTurn()
                except Exception as exc:
                    print(f"[!] Turn detection unavailable: {exc}")
                    self._load_failed = True
                    return False
        return True

    def warmup(self) -> bool:
        if not self._ensure_loaded():
            return False
        self.check(np.zeros(SAMPLE_RATE, dtype=np.float32))
        return True

    def check(self, samples: np.ndarray) -> dict:
        """
        Judge an utterance captured so far (16 kHz mono float32).
        Returns {"speech": bool, "complete": bool, "probability": float}.
        """
        if not self._ensure_loaded():
            raise RuntimeError("Turn detection models are not installed.")
        samples = np.asarray(samples, dtype=np.float32)
        speech = self._vad.speech_seconds(samples) >= self.MIN_SPEECH_SECONDS
        if not speech:
            return {"speech": False, "complete": False, "probability": 0.0}
        probability = self._turn.completion_probability(samples)
        return {
            "speech": True,
            "complete": probability >= self.COMPLETE_THRESHOLD,
            "probability": round(probability, 3),
        }


def decode_wav(data: bytes) -> np.ndarray:
    """WAV bytes -> 16 kHz mono float32."""
    import io
    import soundfile as sf
    samples, sr = sf.read(io.BytesIO(data), dtype="float32")
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if sr != SAMPLE_RATE:
        import scipy.signal
        samples = scipy.signal.resample_poly(samples, SAMPLE_RATE, sr).astype(np.float32)
    return samples


TURN_DETECTOR = TurnDetector()
