"""AI-02: Key detection using essentia KeyExtractor."""
import logging

from .base import AnalyzerBase, AnalyzerConfig

logger = logging.getLogger(__name__)


class KeyAnalyzer(AnalyzerBase):
    """Detects musical key (e.g., 'A minor') using essentia KeyExtractor.
    Uses 'edma' profile by default (good for electronic music)."""

    def analyze(self, audio_path: str) -> dict:
        import essentia.standard as es

        profile = self.config.params.get("profile_type", "edma")

        loader = es.MonoLoader(filename=audio_path, sampleRate=44100)
        audio = loader()

        key_extractor = es.KeyExtractor(profileType=profile)
        key, scale, strength = key_extractor(audio)

        return {
            "key": key,
            "scale": scale,
            "strength": float(strength),
        }

    def is_available(self) -> bool:
        try:
            import essentia.standard
            return True
        except ImportError:
            return False
