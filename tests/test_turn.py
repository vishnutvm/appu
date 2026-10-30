import io
import unittest

import numpy as np

import turn
from voice import KokoroTTSEngine


@unittest.skipUnless(turn.TurnDetector().available(), "turn detection models not installed")
class TurnDetectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.detector = turn.TurnDetector()
        cls.kokoro = KokoroTTSEngine()

    def speech(self, text):
        if not self.kokoro.is_available():
            self.skipTest("Kokoro model not installed")
        wav = self.kokoro.synthesize_wav(text)
        samples = turn.decode_wav(wav)
        return np.concatenate([samples, np.zeros(3200, dtype=np.float32)])

    def test_features_have_whisper_shape(self):
        features = turn.whisper_log_mel(np.zeros(128000, dtype=np.float32), turn._mel_filters())
        self.assertEqual(features.shape, (80, 800))

    def test_silence_is_not_speech(self):
        result = self.detector.check(np.zeros(32000, dtype=np.float32))
        self.assertFalse(result["speech"])
        self.assertFalse(result["complete"])

    def test_noise_is_not_speech(self):
        rng = np.random.default_rng(0)
        result = self.detector.check((0.02 * rng.standard_normal(32000)).astype(np.float32))
        self.assertFalse(result["speech"])

    def test_finished_question_is_complete(self):
        result = self.detector.check(self.speech("What time is my standup meeting today?"))
        self.assertTrue(result["speech"])
        self.assertTrue(result["complete"])

    def test_trailing_off_is_incomplete(self):
        result = self.detector.check(self.speech("I want to schedule a meeting with"))
        self.assertTrue(result["speech"])
        self.assertFalse(result["complete"])


class DecodeWavTests(unittest.TestCase):
    def test_resamples_to_16k_mono(self):
        import soundfile as sf
        buf = io.BytesIO()
        sf.write(buf, np.zeros((24000, 2), dtype=np.float32), 24000, format="WAV")
        samples = turn.decode_wav(buf.getvalue())
        self.assertEqual(samples.ndim, 1)
        self.assertEqual(len(samples), 16000)


if __name__ == "__main__":
    unittest.main()
