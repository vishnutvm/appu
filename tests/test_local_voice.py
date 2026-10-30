import io
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

from stt import LocalSTTEngine
from voice import VoiceEngine, clean_for_speech, split_into_sentences


class TestLocalVoice(unittest.TestCase):
    def setUp(self):
        self.engine = VoiceEngine(voice_name="am_adam")

    def test_clean_for_speech_strips_markdown_and_code(self):
        sample = (
            "Here is the result:\n"
            "```python\nimport sys\nprint('hello')\n```\n"
            "Check [Project Documentation](https://example.com/docs) for more details.\n"
            "* Point A\n* Point B\n"
            "#1 [PENDING] Call John at 5pm."
        )
        cleaned = clean_for_speech(sample)
        self.assertNotIn("```", cleaned)
        self.assertNotIn("https://", cleaned)
        self.assertIn("Project Documentation", cleaned)
        self.assertIn("Here is the code in your timeline.", cleaned)
        self.assertNotIn("*", cleaned)
        self.assertNotIn("#1 [PENDING]", cleaned)

    def test_split_into_sentences(self):
        text = "Hello Vishnu! Appu is online. How can I help you today?"
        sentences = split_into_sentences(text)
        self.assertEqual(len(sentences), 3)
        self.assertEqual(sentences[0], "Hello Vishnu!")
        self.assertEqual(sentences[1], "Appu is online.")
        self.assertEqual(sentences[2], "How can I help you today?")

    def test_stt_handles_empty_or_tiny_audio(self):
        stt = LocalSTTEngine()
        if not stt.is_available():
            self.skipTest("mlx-whisper / soundfile not installed in current environment")
        with self.assertRaises(ValueError):
            stt.transcribe(b"too_short")

    def test_stt_handles_silent_audio_gracefully(self):
        stt = LocalSTTEngine()
        if not stt.is_available():
            self.skipTest("mlx-whisper / soundfile not installed in current environment")

        import soundfile as sf
        import numpy as np

        buf = io.BytesIO()
        silence = np.zeros(16000, dtype=np.float32)  # 1s silence
        sf.write(buf, silence, 16000, format="WAV", subtype="PCM_16")
        text, latency = stt.transcribe(buf.getvalue())
        self.assertIsInstance(text, str)
        self.assertGreaterEqual(latency, 0)

    def test_neural_voice_interruption(self):
        self.engine.stop()
        self.assertFalse(self.engine.is_speaking())

    @patch("subprocess.Popen")
    def test_voice_speak_system_fallback(self, mock_popen):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        mock_popen.return_value = mock_proc

        started = self.engine._speak_system_say("Hello from fallback")
        self.assertTrue(started)
        mock_popen.assert_called_once()
        cmd = mock_popen.call_args[0][0]
        self.assertIn("Hello from fallback", cmd)


if __name__ == "__main__":
    unittest.main()
