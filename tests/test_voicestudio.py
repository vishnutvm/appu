"""
Unit tests for VoiceStudio speech-to-text and voice selection in Appu.
"""

import json
import unittest
from unittest.mock import MagicMock, patch

from stt import VoiceStudioSTTEngine
from voice import VoiceEngine


class TestVoiceStudioIntegration(unittest.TestCase):
    def setUp(self):
        self.stt_engine = VoiceStudioSTTEngine(base_url="http://127.0.0.1:3900")

    @patch("urllib.request.urlopen")
    def test_voicestudio_stt_available(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        available = self.stt_engine.is_available()
        self.assertTrue(available)

    def test_voicestudio_stt_transcribes_empty_audio_raises(self):
        with self.assertRaises(ValueError):
            self.stt_engine.transcribe(b"")

    @patch("urllib.request.urlopen")
    def test_voicestudio_stt_transcribe_mock(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({"text": "Hello world from test"}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        # Create dummy WAV bytes (>= 44 bytes header)
        dummy_wav = b"RIFF" + b"\x00" * 40
        text, latency = self.stt_engine.transcribe(dummy_wav)
        self.assertEqual(text, "Hello world from test")
        self.assertGreaterEqual(latency, 0)

    def test_voice_engine_kokoro_voice_configuration(self):
        engine = VoiceEngine(voice_name="bf_emma")
        self.assertEqual(engine.neural_voice, "bf_emma")
        self.assertEqual(engine.kokoro.voice_name, "bf_emma")
        self.assertTrue(engine.use_neural)

    def test_voice_engine_macos_voice_selection(self):
        engine = VoiceEngine(voice_name="Samantha")
        self.assertFalse(engine.use_neural)
        self.assertEqual(engine.system_voice, "Samantha")


if __name__ == "__main__":
    unittest.main()
