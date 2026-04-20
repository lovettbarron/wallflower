"""AI-01: Tempo (BPM) detection using essentia RhythmExtractor2013."""
import logging

import numpy as np

from .base import AnalyzerBase, AnalyzerConfig

logger = logging.getLogger(__name__)


class TempoAnalyzer(AnalyzerBase):
    """Detects tempo (BPM), beat positions, and rhythm confidence."""

    def analyze(self, audio_path: str) -> dict:
        import essentia.standard as es

        loader = es.MonoLoader(filename=audio_path, sampleRate=44100)
        audio = loader()

        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)

        # Clamp confidence to [0, 1]
        # beats_confidence may be a float or an array depending on essentia version
        if isinstance(beats_confidence, (int, float)):
            confidence = float(np.clip(beats_confidence, 0.0, 1.0))
        elif hasattr(beats_confidence, '__len__') and len(beats_confidence) > 0:
            confidence = float(np.clip(np.mean(beats_confidence), 0.0, 1.0))
        else:
            confidence = 0.0

        # Clamp BPM to valid range
        bpm = float(np.clip(bpm, 20.0, 300.0))

        return {
            "bpm": bpm,
            "confidence": confidence,
            "beats": [float(b) for b in beats],
        }

    def is_available(self) -> bool:
        try:
            import essentia.standard
            return True
        except ImportError:
            return False
