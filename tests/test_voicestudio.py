"""
Unit tests for VoiceStudio integration in Appu (TTS, STT, and voice switching).
"""

import io
import json
import unittest
from unittest.mock import MagicMock, patch

from stt import VoiceStudioSTTEngine, LOCAL_STT
from voice import VoiceStudioTTSClient, VoiceEngine, VOICE


class TestVoiceStudioIntegration(unittest.TestCase):
    def setUp(self):
        self.tts_client = VoiceStudioTTSClient(base_url="http://127.0.0.1:3900")
        self.stt_engine = VoiceStudioSTTEngine(base_url="http://127.0.0.1:3900")

    @patch("urllib.request.urlopen")
    def test_voicestudio_tts_client_available(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        available = self.tts_client.is_available()
        self.assertTrue(available)

    @patch("urllib.request.urlopen")
    def test_voicestudio_tts_list_voices(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({"voices": [{"id": "alloy", "name": "Alloy"}]}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        voices = self.tts_client.list_voices()
        self.assertIsInstance(voices, list)
        self.assertGreater(len(voices), 0)
        voice_ids = [v.get("voice_id") or v.get("id") for v in voices]
        self.assertIn("alloy", voice_ids)

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
    def test_voicestudio_tts_synthesize_mock(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b"RIFF....WAVEfmt "
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        import tempfile, os
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            tmp_path = tf.name

        try:
            success = self.tts_client.synthesize_sentence("Hello testing", tmp_path, voice="alloy")
            self.assertTrue(success)
            self.assertTrue(os.path.exists(tmp_path))
            with open(tmp_path, "rb") as f:
                content = f.read()
            self.assertEqual(content, b"RIFF....WAVEfmt ")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

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

    def test_voice_engine_voice_configuration(self):
        engine = VoiceEngine(voice_name="demo0001")
        self.assertEqual(engine.neural_voice, "demo0001")
        self.assertEqual(engine.voicestudio.voice_name, "demo0001")
        self.assertTrue(engine.use_neural)

    def test_voice_engine_macos_voice_selection(self):
        engine = VoiceEngine(voice_name="Samantha")
        self.assertFalse(engine.use_neural)
        self.assertEqual(engine.system_voice, "Samantha")


if __name__ == "__main__":
    unittest.main()
