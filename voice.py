"""
APPU High-Quality Voice Engine.
Combines VoiceStudio OpenAI-compatible Neural TTS (k2-fsa/OmniVoice on Apple Silicon MPS)
with chunked sentence streaming and macOS native afplay,
with automatic fallback to Kokoro ONNX and macOS /usr/bin/say.
"""

from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
from pathlib import Path
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error

try:
    from kokoro_onnx import Kokoro
    import soundfile as sf
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False


KOKORO_MODEL_PATH = Path.home() / "Developer" / "jarvis" / "models" / "kokoro" / "kokoro-v1.0.onnx"
KOKORO_VOICES_PATH = Path.home() / "Developer" / "jarvis" / "models" / "kokoro" / "voices-v1.0.bin"


def clean_for_speech(text: str) -> str:
    """
    Transform assistant response into natural, concise spoken speech:
    - Strips code blocks, URLs, markdown symbols, and technical formatting.
    - Preserves clean English sentences suitable for conversational speech.
    """
    # 1. Replace code blocks with brief natural announcement
    text = re.sub(r"```[\s\S]*?```", "Here is the code in your timeline.", text)

    # 2. Clean markdown links [Title](url) -> Title
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)

    # 3. Remove standalone URLs
    text = re.sub(r"https?://\S+", "", text)

    # 4. Remove bold, italic, backticks, headings, horizontal rules
    text = re.sub(r"[*_#`~]", "", text)
    text = re.sub(r"(?m)^[-=]{3,}\s*$", "", text)

    # 5. Clean bullet points and list markers (e.g. " • " or " 1. ")
    text = re.sub(r"(?m)^\s*[-+*•]\s+", "", text)
    text = re.sub(r"(?m)^\s*\d+\.\s+", "", text)

    # 6. Clean reminder list syntax (e.g. "#1 [PENDING]")
    text = re.sub(r"#\d+\s*\[(PENDING|COMPLETED|CANCELLED|NOTIFIED)\]", "", text, flags=re.IGNORECASE)

    # 7. Normalize spaces and empty lines
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_into_sentences(text: str) -> List[str]:
    """Split text into spoken sentence chunks for low-latency streaming playback."""
    clean = clean_for_speech(text)
    if not clean:
        return []

    # Split by sentence boundaries (. ! ?)
    raw_sentences = re.split(r"(?<=[.!?])\s+", clean)
    sentences = [s.strip() for s in raw_sentences if s.strip()]
    return sentences or [clean]


class StreamingPhraseBuffer:
    """
    Accumulates incoming text tokens and extracts natural speakable sentences/phrases:
    - Sentence terminators (. ! ? \n)
    - Preserves commas and internal punctuation within sentences for natural human intonation
    - First sentence emitted as soon as a complete sentence or natural opening thought (>= 4 words) is ready
    - Subsequent phrases bundle complete sentences (8-18 words) so playback runs continuously without queue starvation
    - Fallback word limit (16-20 words) on whitespace only for unpunctuated runs
    """
    def __init__(self, min_words_first: int = 4, min_words_subsequent: int = 8, max_words_chunk: int = 18):
        self.buffer = ""
        self.is_first = True
        self.min_words_first = min_words_first
        self.min_words_subsequent = min_words_subsequent
        self.max_words_chunk = max_words_chunk

    def add_token(self, token: str) -> List[str]:
        self.buffer += token
        return self._extract_phrases()

    def _extract_phrases(self) -> List[str]:
        ready = []
        while True:
            words = self.buffer.strip().split()
            if not words:
                break

            min_w = self.min_words_first if self.is_first else self.min_words_subsequent

            # Find sentence terminators (. ! ? \n)
            matches = list(re.finditer(r"([.!?\n]+)(\s+|$)", self.buffer))
            found = False
            for m in matches:
                cand = self.buffer[:m.start() + len(m.group(1))].strip()
                cand_words = cand.split()
                if not cand_words:
                    continue
                # Skip numbered list markers like "1."
                if re.match(r"^\d+[\.\)]$", cand):
                    continue

                is_intro = cand_words[0].lower().rstrip(",;:—") in (
                    "first", "second", "third", "finally", "next", "also", "sure", "yes", "no",
                    "hello", "hi", "hey", "okay", "certainly", "alright", "absolutely", "well"
                )

                # Cut at sentence end if it has enough words, or is an intro greeting, or exceeds max_words_chunk
                if len(cand_words) >= min_w or (self.is_first and is_intro) or len(cand_words) >= self.max_words_chunk:
                    self.buffer = self.buffer[m.end():]
                    self.is_first = False
                    ready.append(cand)
                    found = True
                    break

            if found:
                continue

            # Word-count fallback: if unpunctuated run exceeds max_words_chunk, split at comma or whitespace
            if len(words) >= self.max_words_chunk:
                sub_match = list(re.finditer(r"([,;:\—]+)(\s+)", self.buffer))
                cut_idx = None
                for sm in sub_match:
                    cand = self.buffer[:sm.start() + len(sm.group(1))].strip()
                    if len(cand.split()) >= min_w:
                        cut_idx = sm.end()
                        break
                if cut_idx:
                    phrase = self.buffer[:cut_idx].strip()
                    self.buffer = self.buffer[cut_idx:]
                else:
                    tokens_w = re.split(r"(\s+)", self.buffer)
                    w_count = 0
                    idx = 0
                    for part in tokens_w:
                        if part.strip():
                            w_count += 1
                        idx += len(part)
                        if w_count == self.max_words_chunk:
                            break
                    phrase = self.buffer[:idx].strip()
                    self.buffer = self.buffer[idx:]

                self.is_first = False
                ready.append(phrase)
                continue

            break

        return ready

    def flush(self) -> List[str]:
        remainder = self.buffer.strip()
        self.buffer = ""
        if remainder:
            return [remainder]
        return []


class StreamingVoiceSession:
    """
    Concurrent Producer-Consumer Streaming Voice Session.
    - Receives Ollama text tokens continuously as they are generated.
    - Emits natural speakable phrases to Kokoro TTS worker immediately.
    - Plays audio chunks in order via afplay the moment each finishes synthesis.
    - Operates concurrently with Ollama text generation.
    """
    def __init__(self, engine: "VoiceEngine", voice: Optional[str] = None):
        self.engine = engine
        self.voice = voice or engine.neural_voice
        self.phrase_buffer = StreamingPhraseBuffer()
        self.phrase_queue: queue.Queue = queue.Queue()
        self.audio_queue: queue.Queue = queue.Queue(maxsize=15)
        self.interrupt_event = threading.Event()
        self._temp_files: List[str] = []
        self._files_lock = threading.Lock()

        # Detailed instrumentation timestamps
        self.timestamps: Dict[str, Optional[float]] = {
            "start": time.time(),
            "first_token": None,
            "first_phrase": None,
            "synth_start": None,
            "synth_done": None,
            "playback_sub": None,
            "playback_start": None,
            "stream_done": None,
        }

        # Start background workers
        self._tts_thread = threading.Thread(target=self._tts_worker, daemon=True)
        self._playback_thread = threading.Thread(target=self._playback_worker, daemon=True)
        self._tts_thread.start()
        self._playback_thread.start()

    def feed_token(self, token: str) -> None:
        if self.interrupt_event.is_set():
            return
        if self.timestamps["first_token"] is None:
            self.timestamps["first_token"] = time.time()

        phrases = self.phrase_buffer.add_token(token)
        for phrase in phrases:
            if self.timestamps["first_phrase"] is None:
                self.timestamps["first_phrase"] = time.time()
            self.phrase_queue.put(phrase)

    def finish_text(self) -> None:
        if self.timestamps["stream_done"] is None:
            self.timestamps["stream_done"] = time.time()

        rem = self.phrase_buffer.flush()
        for phrase in rem:
            if self.timestamps["first_phrase"] is None:
                self.timestamps["first_phrase"] = time.time()
            self.phrase_queue.put(phrase)

        self.phrase_queue.put(None)

    def cancel(self) -> None:
        self.interrupt_event.set()
        while not self.phrase_queue.empty():
            try:
                self.phrase_queue.get_nowait()
            except queue.Empty:
                break
        while not self.audio_queue.empty():
            try:
                item = self.audio_queue.get_nowait()
                if isinstance(item, str) and os.path.exists(item):
                    try:
                        os.remove(item)
                    except OSError:
                        pass
            except queue.Empty:
                break
        with self._files_lock:
            for f in self._temp_files:
                if os.path.exists(f):
                    try:
                        os.remove(f)
                    except OSError:
                        pass
            self._temp_files.clear()

    def _tts_worker(self) -> None:
        chunk_idx = 0
        while not self.interrupt_event.is_set():
            try:
                phrase = self.phrase_queue.get(timeout=0.05)
            except queue.Empty:
                continue

            if phrase is None:
                self.audio_queue.put(None)
                break

            clean = clean_for_speech(phrase)
            if not clean:
                continue

            if self.timestamps["synth_start"] is None:
                self.timestamps["synth_start"] = time.time()

            with tempfile.NamedTemporaryFile(suffix=f"_stream_{chunk_idx}.wav", delete=False) as tf:
                wav_path = tf.name
            with self._files_lock:
                self._temp_files.append(wav_path)

            ok = self.engine.kokoro.synthesize_sentence(clean, wav_path, voice=self.voice)

            if self.timestamps["synth_done"] is None:
                self.timestamps["synth_done"] = time.time()

            if self.interrupt_event.is_set():
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass
                break

            if ok and os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                if self.timestamps["playback_sub"] is None:
                    self.timestamps["playback_sub"] = time.time()
                self.audio_queue.put(wav_path)
            else:
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass

            chunk_idx += 1

    def _playback_worker(self) -> None:
        while not self.interrupt_event.is_set():
            try:
                item = self.audio_queue.get(timeout=0.05)
            except queue.Empty:
                continue

            if item is None:
                break

            wav_path = item
            if not os.path.exists(wav_path):
                continue

            try:
                proc = subprocess.Popen(
                    [self.engine._afplay_bin, wav_path],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                with self.engine._lock:
                    self.engine._current_process = proc

                if self.timestamps["playback_start"] is None:
                    self.timestamps["playback_start"] = time.time()
                    self._log_instrumentation()

                while proc.poll() is None:
                    if self.interrupt_event.is_set() or self.engine._interrupt_event.is_set():
                        proc.terminate()
                        break
                    time.sleep(0.02)
            except Exception as exc:
                print(f"[!] Playback error: {exc}")
            finally:
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass

    def _log_instrumentation(self) -> None:
        t0 = self.timestamps["start"] or time.time()
        t_ft = self.timestamps["first_token"]
        t_fp = self.timestamps["first_phrase"]
        t_ss = self.timestamps["synth_start"]
        t_sd = self.timestamps["synth_done"]
        t_ps = self.timestamps["playback_sub"]
        t_pb = self.timestamps["playback_start"]
        t_done = self.timestamps["stream_done"]

        ft_off = f"{t_ft - t0:.3f}s" if t_ft else "n/a"
        fp_off = f"{t_fp - t0:.3f}s" if t_fp else "n/a"
        ss_off = f"{t_ss - t0:.3f}s" if t_ss else "n/a"
        sd_off = f"{t_sd - t0:.3f}s" if t_sd else "n/a"
        ps_off = f"{t_ps - t0:.3f}s" if t_ps else "n/a"
        pb_off = f"{t_pb - t0:.3f}s" if t_pb else "n/a"
        tok_to_spk = f"{t_pb - t_ft:.3f}s" if (t_pb and t_ft) else "n/a"
        overlap = "YES" if (t_done is None or (t_pb and t_pb < t_done)) else "NO"

        print(
            f"\033[1;36m[STREAMING VOICE PIPELINE]\033[0m "
            f"1st token: {ft_off} | 1st phrase: {fp_off} | Synth: {ss_off}->{sd_off} | "
            f"Audible speech: {pb_off} (Token->Speech: {tok_to_spk}) | Overlap: {overlap}"
        )


class VoiceStudioTTSClient:
    """
    Client adapter for VoiceStudio POST /v1/audio/speech.
    Uses discovered local VoiceStudio instance at http://127.0.0.1:3900.
    Configured with demo0001 reference profile, fixed seed=42, and num_step=8
    to guarantee 100% voice consistency across all sentence chunks.
    """
    def __init__(
        self,
        base_url: str = "http://127.0.0.1:3900",
        model: str = "tts-1",
        voice_name: str = "demo0001",
        num_step: int = 8,
        seed: int = 42
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.voice_name = voice_name
        self.num_step = num_step
        self.seed = seed
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
            return False

    def list_voices(self) -> List[Dict[str, Any]]:
        """Fetch discovered voices and profiles from VoiceStudio /v1/audio/voices."""
        try:
            req = urllib.request.Request(f"{self.base_url}/v1/audio/voices")
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("voices", [])
        except Exception:
            return []

    def synthesize_sentence(
        self,
        text: str,
        output_path: str,
        voice: Optional[str] = None,
        timeout: float = 25.0
    ) -> bool:
        """Synthesize text via POST /v1/audio/speech with consistent voice profile and seed."""
        clean_text = clean_for_speech(text)
        if not clean_text:
            return False

        # Resolve voice: if generic alias or not specified, use the cloned profile demo0001
        target_voice = voice or self.voice_name
        if target_voice in ("alloy", "default", "auto", None):
            target_voice = "demo0001"

        payload = json.dumps({
            "model": self.model,
            "input": clean_text,
            "voice": target_voice,
            "response_format": "wav",
            "num_step": self.num_step,
            "seed": self.seed,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{self.base_url}/v1/audio/speech",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    data = resp.read()
                    with open(output_path, "wb") as f:
                        f.write(data)
                    return True
        except Exception as exc:
            print(f"[!] VoiceStudio TTS error on '{clean_text[:30]}...': {exc}")
        return False


class KokoroTTSEngine:
    def __init__(self, voice_name: str = "am_adam"):
        self.voice_name = voice_name
        self.kokoro: Optional[Kokoro] = None
        self._lock = threading.Lock()
        self._load_model_safe()

    def _load_model_safe(self) -> bool:
        if not KOKORO_AVAILABLE:
            return False
        if not KOKORO_MODEL_PATH.exists() or not KOKORO_VOICES_PATH.exists():
            return False
        try:
            with self._lock:
                if self.kokoro is None:
                    self.kokoro = Kokoro(str(KOKORO_MODEL_PATH), str(KOKORO_VOICES_PATH))
            return True
        except Exception as exc:
            print(f"[!] Kokoro load error: {exc}")
            return False

    def is_available(self) -> bool:
        return KOKORO_AVAILABLE and KOKORO_MODEL_PATH.exists() and KOKORO_VOICES_PATH.exists()

    def is_valid_voice(self, voice: Optional[str]) -> bool:
        if not voice:
            return True
        return any(voice.startswith(prefix) for prefix in ("am_", "af_", "bm_", "bf_", "zf_", "zm_"))

    def synthesize_sentence(self, text: str, output_path: str, voice: Optional[str] = None) -> bool:
        """Synthesize a single sentence to a WAV file."""
        if not self.is_available():
            return False
        target_voice = voice or self.voice_name
        if not self.is_valid_voice(target_voice):
            return False
        if not self.kokoro:
            if not self._load_model_safe():
                return False

        try:
            samples, sample_rate = self.kokoro.create(text, voice=target_voice, speed=1.05, lang="en-us")
            sf.write(output_path, samples, sample_rate)
            return True
        except Exception as e:
            print(f"[!] Kokoro synthesis error on '{text[:30]}...': {e}")
            return False


class VoiceEngine:
    def __init__(self, voice_name: str = "am_adam", base_url: str = "http://127.0.0.1:3900", num_step: int = 8):
        self.voicestudio = VoiceStudioTTSClient(base_url=base_url, voice_name=voice_name, num_step=num_step)
        self.kokoro = KokoroTTSEngine(voice_name=voice_name if self._is_kokoro_voice(voice_name) else "am_adam")
        self.neural_voice = voice_name
        self.system_voice = voice_name if not self._is_neural_voice(voice_name) else "Samantha"
        self.enabled = True
        self.use_neural = self._is_neural_voice(voice_name)

        self._current_process: Optional[subprocess.Popen] = None
        self._interrupt_event = threading.Event()
        self._playback_thread: Optional[threading.Thread] = None
        self._producer_thread: Optional[threading.Thread] = None
        self._current_session: Optional[StreamingVoiceSession] = None
        self._audio_queue: queue.Queue = queue.Queue(maxsize=15)
        self._lock = threading.Lock()
        self._say_bin = shutil.which("say") or "/usr/bin/say"
        self._afplay_bin = shutil.which("afplay") or "/usr/bin/afplay"

    def _is_kokoro_voice(self, voice: Optional[str]) -> bool:
        if not voice:
            return False
        return any(voice.startswith(p) for p in ("am_", "af_", "bm_", "bf_", "zf_", "zm_"))

    def _is_neural_voice(self, voice: Optional[str]) -> bool:
        if not voice:
            return False
        system_voices = {
            "samantha", "alex", "fred", "victoria", "daniel", "karen", "serena",
            "tessa", "oliver", "tom", "fiona", "moira", "veena", "rishi", "yuri"
        }
        return voice.lower() not in system_voices

    def is_available(self) -> bool:
        return (
            (self.use_neural and (self.voicestudio.is_available() or self.kokoro.is_available()))
            or os.path.exists(self._say_bin)
        )

    def set_enabled(self, enabled: bool) -> None:
        with self._lock:
            self.enabled = bool(enabled)
            if not self.enabled:
                self.stop_locked()

    def is_enabled(self) -> bool:
        with self._lock:
            return self.enabled

    def set_neural_enabled(self, use_neural: bool) -> None:
        with self._lock:
            self.use_neural = bool(use_neural)

    def stop(self) -> None:
        """Interrupt and terminate any actively playing or generating speech immediately."""
        with self._lock:
            self.stop_locked()

    def start_streaming_session(self, voice: Optional[str] = None) -> StreamingVoiceSession:
        with self._lock:
            self.stop_locked()
            self._interrupt_event.clear()
            self._drain_queue()
        session = StreamingVoiceSession(self, voice=voice)
        self._current_session = session
        return session

    def stop_locked(self) -> None:
        self._interrupt_event.set()

        if hasattr(self, "_current_session") and self._current_session is not None:
            self._current_session.cancel()
            self._current_session = None

        if self._current_process is not None:
            if self._current_process.poll() is None:
                try:
                    self._current_process.terminate()
                    self._current_process.wait(timeout=0.15)
                except Exception:
                    try:
                        self._current_process.kill()
                    except Exception:
                        pass
            self._current_process = None

        self._drain_queue()

        if self._playback_thread is not None and self._playback_thread.is_alive():
            if threading.current_thread() != self._playback_thread:
                self._playback_thread.join(timeout=0.15)
            self._playback_thread = None

        if self._producer_thread is not None and self._producer_thread.is_alive():
            if threading.current_thread() != self._producer_thread:
                self._producer_thread.join(timeout=0.15)
            self._producer_thread = None

    def _drain_queue(self):
        """Purge any remaining audio chunks from the queue and unlink temp files."""
        while not self._audio_queue.empty():
            try:
                item = self._audio_queue.get_nowait()
                if isinstance(item, str) and os.path.exists(item):
                    try:
                        os.remove(item)
                    except OSError:
                        pass
            except queue.Empty:
                break

    def is_speaking(self) -> bool:
        with self._lock:
            if self._current_process is not None:
                if self._current_process.poll() is None:
                    return True
                self._current_process = None
            if self._playback_thread is not None and self._playback_thread.is_alive():
                return True
            if hasattr(self, "_current_session") and self._current_session is not None:
                if (
                    self._current_session._playback_thread is not None
                    and self._current_session._playback_thread.is_alive()
                ):
                    return True
            return False

    def speak(self, text: str, voice: Optional[str] = None) -> bool:
        """
        Speak text non-blockingly using Kokoro Neural TTS.
        Pipelined sentence-by-sentence background synthesis and afplay playback.
        """
        if not self.enabled or not text.strip():
            return False

        with self._lock:
            self.stop_locked()
            self._interrupt_event.clear()
            self._drain_queue()

        target_voice = voice or self.neural_voice
        if self.use_neural and self._is_neural_voice(target_voice):
            if self.kokoro.is_available():
                self._start_pipelined_playback(text, target_voice)
                return True

        # Fallback to system say
        return self._speak_system_say(text, voice)

    def _start_pipelined_playback(self, text: str, voice: str):
        sentences = split_into_sentences(text)
        if not sentences:
            return

        # Start consumer player thread
        consumer = threading.Thread(
            target=self._play_queued_audio,
            daemon=True,
        )
        self._playback_thread = consumer
        consumer.start()

        # Start producer synthesizer thread
        producer = threading.Thread(
            target=self._synthesize_sentences_to_queue,
            args=(sentences, voice),
            daemon=True,
        )
        self._producer_thread = producer
        producer.start()

    def _synthesize_sentences_to_queue(self, sentences: List[str], voice: str):
        target_voice = voice if self._is_kokoro_voice(voice) else "am_adam"
        for idx, sentence in enumerate(sentences):
            if self._interrupt_event.is_set():
                break

            clean_sentence = clean_for_speech(sentence)
            if not clean_sentence:
                continue

            with tempfile.NamedTemporaryFile(suffix=f"_chunk_{idx}.wav", delete=False) as tf:
                wav_path = tf.name

            # Synthesize exclusively with Kokoro Neural TTS (~1.1s)
            success = self.kokoro.synthesize_sentence(clean_sentence, wav_path, voice=target_voice)

            if self._interrupt_event.is_set():
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass
                break

            if success and os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                self._audio_queue.put(wav_path)
            else:
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass

        # Sentinel to signal playback thread that synthesis is complete
        self._audio_queue.put(None)

    def _play_queued_audio(self):
        """Consumer thread: plays audio files from _audio_queue as they become available."""
        while not self._interrupt_event.is_set():
            try:
                item = self._audio_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if item is None:
                break

            if isinstance(item, tuple) and item[0] == "say":
                _, fallback_text, v = item
                clean = clean_for_speech(fallback_text)
                if clean and os.path.exists(self._say_bin):
                    target_v = self.system_voice if (not v or self._is_neural_voice(v)) else v
                    try:
                        proc = subprocess.Popen(
                            [self._say_bin, "-v", target_v, clean],
                            stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        with self._lock:
                            self._current_process = proc
                        while proc.poll() is None:
                            if self._interrupt_event.is_set():
                                proc.terminate()
                                break
                            time.sleep(0.04)
                    except Exception as e:
                        print(f"[!] say fallback error: {e}")
                continue

            wav_path = item
            if not os.path.exists(wav_path):
                continue

            try:
                proc = subprocess.Popen(
                    [self._afplay_bin, wav_path],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                with self._lock:
                    self._current_process = proc

                while proc.poll() is None:
                    if self._interrupt_event.is_set():
                        proc.terminate()
                        break
                    time.sleep(0.02)
            except Exception as exc:
                print(f"[!] afplay error: {exc}")
                break
            finally:
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass

    def _speak_system_say(self, text: str, voice: Optional[str] = None) -> bool:
        """Fallback to macOS /usr/bin/say."""
        clean_text = clean_for_speech(text)
        if not clean_text or not os.path.exists(self._say_bin):
            return False

        target_voice = self.system_voice if (not voice or self._is_neural_voice(voice)) else voice
        cmd = [self._say_bin, "-v", target_voice, clean_text]

        with self._lock:
            self.stop_locked()
            try:
                self._current_process = subprocess.Popen(
                    cmd,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
                return True
            except OSError:
                self._current_process = None
                return False

    def warmup(self) -> bool:
        """Pre-warm Kokoro Neural TTS in background on startup."""
        if self.kokoro.is_available():
            try:
                self.kokoro._load_model_safe()
                with tempfile.NamedTemporaryFile(suffix="_warmup.wav", delete=False) as tf:
                    tmp_p = tf.name
                ok = self.kokoro.synthesize_sentence("Hi", tmp_p, voice="am_adam")
                if os.path.exists(tmp_p):
                    try:
                        os.remove(tmp_p)
                    except OSError:
                        pass
                return ok
            except Exception:
                return False
        return False


# Global voice engine singleton configured for low-latency streaming
VOICE = VoiceEngine()
