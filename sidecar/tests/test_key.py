"""Tests for AI-02: Key detection."""
import pytest
from wallflower_sidecar.analyzers.key import KeyAnalyzer
from wallflower_sidecar.analyzers.base import AnalyzerBase, AnalyzerConfig

VALID_KEYS = {"C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"}
VALID_SCALES = {"major", "minor"}


def test_key_analyzer_inherits_base():
    config = AnalyzerConfig(name="essentia_key", version="2.1")
    analyzer = KeyAnalyzer(config)
    assert isinstance(analyzer, AnalyzerBase)


def test_key_analyzer_is_available():
    config = AnalyzerConfig(name="essentia_key", version="2.1")
    analyzer = KeyAnalyzer(config)
    assert analyzer.is_available() is True


def test_key_detection_returns_valid_key(complex_audio):
    config = AnalyzerConfig(name="essentia_key", version="2.1")
    analyzer = KeyAnalyzer(config)
    result = analyzer.analyze(str(complex_audio))
    assert "key" in result
    assert result["key"] in VALID_KEYS
    assert "scale" in result
    assert result["scale"] in VALID_SCALES
    assert "strength" in result
    assert 0 <= result["strength"] <= 1
