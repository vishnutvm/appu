"""
APPU Voice Engine.
Kokoro ONNX neural TTS streamed phrase-by-phrase as WAV bytes to the browser,
which plays them (so Chrome's echo cancellation can hear Appu and allow barge-in).
macOS /usr/bin/say is kept only for alerts when no window is open.
"""

import io
import os
from pathlib import Path
import queue
import re
import shutil
import subprocess
import threading
import time
from typing import Callable, Dict, List, Optional

try:
    from kokoro_onnx import Kokoro
    import soundfile as sf
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False


KOKORO_MODEL_PATH = Path.home() / "Developer" / "jarvis" / "models" / "kokoro" / "kokoro-v1.0.onnx"
KOKORO_VOICES_PATH = Path.home() / "Developer" / "jarvis" / "models" / "kokoro" / "voices-v1.0.bin"
KOKORO_SPEED = 1.05

# Voices offered in the UI; selection requests are validated against this list.
KOKORO_VOICES = {
    "am_adam": "Adam (American male)",
    "af_bella": "Bella (American female)",
    "af_sarah": "Sarah (American female)",
    "bm_george": "George (British male)",
    "bf_emma": "Emma (British female)",
}

DETAILS_ON_SCREEN = "I've put the details on screen."


def clean_for_speech(text: str) -> str:
    """
    Transform assistant response into natural, concise spoken speech:
    - Strips code blocks, URLs, markdown symbols, and technical formatting.
    - Preserves clean English sentences suitable for conversational speech.
    """
    # 1. Replace code blocks with brief natural announcement
    text = re.sub(r"```[\s\S]*?```", "I've put the code on screen.", text)

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


class SpokenPartFilter:
    """
    Passes through only the spoken part of a streamed reply.

    The reply's opening paragraph is spoken. Anything after a blank line, a list,
    a code fence or a table is "show" content: it is displayed but not read aloud.
    """
    _SHOW_START = re.compile(r"(?m)(\n\s*\n|^\s*(?:[-+*•]\s|\d+[.)]\s|```|\|))")

    def __init__(self):
        self._seen = ""
        self._emitted = 0
        self.truncated = False

    def feed(self, token: str) -> str:
        if self.truncated:
            return ""
        self._seen += token
        match = self._SHOW_START.search(self._seen)
        if match and self._seen[:match.start()].strip():
            self.truncated = True
            end = match.start()
        elif match:
            # Reply opens with show content (e.g. a list). Nothing to speak.
            self.truncated = True
            end = 0
        else:
            # Hold back a few characters: a list/code marker may still be arriving.
            end = max(self._emitted, len(self._seen) - 4)
        out = self._seen[self._emitted:end] if end > self._emitted else ""
        self._emitted = max(self._emitted, end)
        return out

    def flush(self) -> str:
        if self.truncated:
            return ""
        out = self._seen[self._emitted:]
        self._emitted = len(self._seen)
        return out

    def reset(self) -> None:
        self.__init__()


class StreamingPhraseBuffer:
    """
    Accumulates incoming text tokens and extracts natural speakable sentences/phrases:
    - Sentence terminators (. ! ? \n)
    - Preserves commas and internal punctuation within sentences for natural human intonation
    - First phrase emitted as soon as a complete sentence or natural opening thought (>= 3 words) is ready
    - Subsequent phrases bundle complete sentences (8-18 words) so playback runs continuously without queue starvation
    - Fallback word limit (16-20 words) on whitespace only for unpunctuated runs
    """
    def __init__(
        self,
        min_words_first: int = 3,
        min_words_subsequent: int = 8,
        max_words_chunk: int = 18,
        max_words_first: int = 10,
    ):
        self.buffer = ""
        self.is_first = True
        self.min_words_first = min_words_first
        self.min_words_subsequent = min_words_subsequent
        self.max_words_chunk = max_words_chunk
        self.max_words_first = max_words_first

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

            # The first phrase sets time-to-first-audio, so it may break early at a comma.
            if self.is_first:
                first_cut = next(
                    (sm.end() for sm in re.finditer(r"([,;:\—]+)(\s+)", self.buffer)
                     if len(self.buffer[:sm.start()].split()) > min_w),
                    None,
                )
                if first_cut:
                    ready.append(self.buffer[:first_cut].strip())
                    self.buffer = self.buffer[first_cut:]
                    self.is_first = False
                    continue

            # Word-count fallback: if unpunctuated run exceeds the limit, split at comma or whitespace
            limit = self.max_words_first if self.is_first else self.max_words_chunk
            if len(words) >= limit:
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
                        if w_count == limit:
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

    def discard(self) -> None:
        self.buffer = ""


AudioSink = Callable[[bytes, str], None]


class StreamingVoiceSession:
    """
    One spoken reply.

    LLM tokens go in through feed_token(); only the spoken part (see SpokenPartFilter)
    is split into phrases, synthesised by Kokoro on a worker thread, and handed to
    `on_audio(wav_bytes, phrase_text)` in order. The caller sends those to the browser.
    """
    def __init__(self, engine: "VoiceEngine", on_audio: AudioSink, voice: Optional[str] = None):
        self.engine = engine
        self.on_audio = on_audio
        self.voice = voice or engine.neural_voice
        self.spoken_filter = SpokenPartFilter()
        self.phrase_buffer = StreamingPhraseBuffer()
        self.phrase_queue: queue.Queue = queue.Queue()
        self.interrupt_event = threading.Event()
        self._finished = False
        self._details_queued = False

        self.timestamps: Dict[str, Optional[float]] = {
            "start": time.time(),
            "first_token": None,
            "first_phrase": None,
            "first_audio": None,
            "stream_done": None,
        }

        self._tts_thread = threading.Thread(target=self._tts_worker, daemon=True)
        self._tts_thread.start()

    def _queue_phrase(self, phrase: str) -> None:
        if self.timestamps["first_phrase"] is None:
            self.timestamps["first_phrase"] = time.time()
        self.phrase_queue.put(phrase)

    def feed_token(self, token: str) -> None:
        if self.interrupt_event.is_set() or self._finished:
            return
        if self.timestamps["first_token"] is None:
            self.timestamps["first_token"] = time.time()

        spoken = self.spoken_filter.feed(token)
        phrases = self.phrase_buffer.add_token(spoken) if spoken else []
        if self.spoken_filter.truncated and not self._details_queued:
            # The rest is on-screen detail: speak what we have now instead of
            # waiting for generation to finish.
            phrases += self.phrase_buffer.flush()
            phrases.append(DETAILS_ON_SCREEN)
            self._details_queued = True
        for phrase in phrases:
            self._queue_phrase(phrase)

    def say(self, phrase: str) -> None:
        """Speak a fixed phrase now, e.g. an acknowledgement while a tool runs."""
        if not self.interrupt_event.is_set() and not self._finished:
            self._queue_phrase(phrase)

    def discard_pending_text(self) -> None:
        """Drop unspoken model text (used when the model switches to a tool call)."""
        self.phrase_buffer.discard()
        self.spoken_filter.reset()
        self._details_queued = False

    def finish_text(self) -> None:
        if self._finished:
            return
        self.timestamps["stream_done"] = time.time()
        tail = self.spoken_filter.flush()
        phrases = self.phrase_buffer.add_token(tail) if tail else []
        phrases += self.phrase_buffer.flush()
        for phrase in phrases:
            self._queue_phrase(phrase)
        if self.spoken_filter.truncated and not self._details_queued:
            self._queue_phrase(DETAILS_ON_SCREEN)
            self._details_queued = True
        self._finished = True
        self.phrase_queue.put(None)

    def cancel(self) -> None:
        self.interrupt_event.set()
        while True:
            try:
                self.phrase_queue.get_nowait()
            except queue.Empty:
                break
        self.phrase_queue.put(None)

    def wait(self, timeout: Optional[float] = None) -> None:
        """Block until every queued phrase has been synthesised and delivered."""
        self._tts_thread.join(timeout)

    def _tts_worker(self) -> None:
        while not self.interrupt_event.is_set():
            phrase = self.phrase_queue.get()
            if phrase is None:
                break

            clean = clean_for_speech(phrase)
            if not clean:
                continue

            wav = self.engine.kokoro.synthesize_wav(clean, voice=self.voice)
            if self.interrupt_event.is_set():
                break
            if not wav:
                continue

            if self.timestamps["first_audio"] is None:
                self.timestamps["first_audio"] = time.time()
            try:
                self.on_audio(wav, clean)
            except Exception as exc:
                print(f"[!] Audio delivery error: {exc}")
                self.interrupt_event.set()
                break

    def latency(self) -> Dict[str, Optional[float]]:
        """Seconds from session start to each milestone (None if not reached)."""
        t0 = self.timestamps["start"] or time.time()
        return {
            key: round(value - t0, 3) if value else None
            for key, value in self.timestamps.items()
            if key != "start"
        }


def _reuse_espeak_backend(tokenizer) -> None:
    """
    kokoro-onnx calls phonemizer.phonemize(), which builds a new espeak backend
    (reloading the shared library) on every call: ~0.5 s per phrase. Keep one per language.
    espeak is not thread-safe; callers must hold KokoroTTSEngine._lock.
    """
    try:
        from phonemizer.backend import EspeakBackend
        from phonemizer.separator import default_separator
    except ImportError:
        return

    backends = {}

    def phonemize(text, lang="en-us", norm=True):
        if norm:
            text = tokenizer.normalize_text(text)
        backend = backends.get(lang)
        if backend is None:
            backend = EspeakBackend(lang, preserve_punctuation=True, with_stress=True)
            backends[lang] = backend
        phonemes = backend.phonemize([text], separator=default_separator, strip=False)[0]
        return "".join(p for p in phonemes if p in tokenizer.vocab).strip()

    tokenizer.phonemize = phonemize


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
                    _reuse_espeak_backend(self.kokoro.tokenizer)
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

    def synthesize_wav(self, text: str, voice: Optional[str] = None) -> Optional[bytes]:
        """Synthesize text to 16-bit PCM WAV bytes, or None on failure."""
        if not self.is_available():
            return None
        target_voice = voice or self.voice_name
        if not self.is_valid_voice(target_voice):
            target_voice = self.voice_name
        if not self.kokoro and not self._load_model_safe():
            return None

        try:
            with self._lock:
                samples, sample_rate = self.kokoro.create(text, voice=target_voice, speed=KOKORO_SPEED, lang="en-us")
            buf = io.BytesIO()
            sf.write(buf, samples, sample_rate, format="WAV", subtype="PCM_16")
            return buf.getvalue()
        except Exception as e:
            print(f"[!] Kokoro synthesis error on '{text[:30]}...': {e}")
            return None


class VoiceEngine:
    def __init__(self, voice_name: str = "am_adam"):
        self.kokoro = KokoroTTSEngine(voice_name=voice_name if self._is_kokoro_voice(voice_name) else "am_adam")
        self.neural_voice = voice_name
        self.system_voice = voice_name if not self._is_neural_voice(voice_name) else "Samantha"
        self.enabled = True
        self.use_neural = self._is_neural_voice(voice_name)

        self._current_process: Optional[subprocess.Popen] = None
        self._current_session: Optional[StreamingVoiceSession] = None
        self._lock = threading.Lock()
        self._say_bin = shutil.which("say") or "/usr/bin/say"

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
        return (self.use_neural and self.kokoro.is_available()) or os.path.exists(self._say_bin)

    def set_enabled(self, enabled: bool) -> None:
        with self._lock:
            self.enabled = bool(enabled)
            if not self.enabled:
                self.stop_locked()

    def is_enabled(self) -> bool:
        with self._lock:
            return self.enabled

    def stop(self) -> None:
        """Interrupt any active spoken reply or alert immediately."""
        with self._lock:
            self.stop_locked()

    def stop_locked(self) -> None:
        if self._current_session is not None:
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

    def start_streaming_session(self, on_audio: AudioSink, voice: Optional[str] = None) -> StreamingVoiceSession:
        with self._lock:
            self.stop_locked()
            session = StreamingVoiceSession(self, on_audio=on_audio, voice=voice)
            self._current_session = session
        return session

    def synthesize(self, text: str, voice: Optional[str] = None) -> Optional[bytes]:
        """One-shot WAV synthesis for short alerts played by the browser."""
        clean = clean_for_speech(text)
        if not clean:
            return None
        return self.kokoro.synthesize_wav(clean, voice=voice or self.neural_voice)

    def is_speaking(self) -> bool:
        with self._lock:
            if self._current_process is not None:
                if self._current_process.poll() is None:
                    return True
                self._current_process = None
            return False

    def speak(self, text: str, voice: Optional[str] = None) -> bool:
        """Speak an alert through the Mac speakers. Only used when no Appu window is open."""
        if not self.enabled or not text.strip():
            return False
        return self._speak_system_say(text, voice)

    def _speak_system_say(self, text: str, voice: Optional[str] = None) -> bool:
        """Speak via macOS /usr/bin/say."""
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
        if not self.kokoro.is_available():
            return False
        try:
            return self.kokoro.synthesize_wav("Hi", voice="am_adam") is not None
        except Exception:
            return False


# Global voice engine singleton configured for low-latency streaming
VOICE = VoiceEngine()
