import unittest
from unittest.mock import MagicMock, patch

from voice import VoiceEngine


class TestVoiceEngine(unittest.TestCase):
    def setUp(self):
        self.engine = VoiceEngine(voice_name="Samantha")

    @patch("os.path.exists", return_value=True)
    @patch("subprocess.Popen")
    def test_speak_starts_process(self, mock_popen, mock_exists):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        mock_popen.return_value = mock_proc

        started = self.engine.speak("Hello from Appu")
        self.assertTrue(started)
        mock_popen.assert_called_once()
        cmd = mock_popen.call_args[0][0]
        self.assertIn("Samantha", cmd)
        self.assertIn("Hello from Appu", cmd)

    def test_speak_disabled(self):
        self.engine.set_enabled(False)
        self.assertFalse(self.engine.is_enabled())
        started = self.engine.speak("Should not play")
        self.assertFalse(started)

    @patch("os.path.exists", return_value=True)
    @patch("subprocess.Popen")
    def test_stop_terminates_process(self, mock_popen, mock_exists):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        mock_popen.return_value = mock_proc

        self.engine.speak("Speaking now")
        self.engine.stop()
        mock_proc.terminate.assert_called_once()

    @patch("os.path.exists", return_value=True)
    @patch("subprocess.Popen")
    def test_overlapping_speech_cancels_previous(self, mock_popen, mock_exists):
        mock_proc1 = MagicMock()
        mock_proc1.poll.return_value = None
        mock_proc2 = MagicMock()
        mock_proc2.poll.return_value = None
        mock_popen.side_effect = [mock_proc1, mock_proc2]

        self.engine.speak("First phrase")
        self.engine.speak("Second phrase")

        mock_proc1.terminate.assert_called_once()
        self.assertEqual(mock_popen.call_count, 2)


if __name__ == "__main__":
    unittest.main()
