"""Tests for AI-01: Tempo (BPM) detection."""
import pytest
from wallflower_sidecar.analyzers.tempo import TempoAnalyzer
from wallflower_sidecar.analyzers.base import AnalyzerBase, AnalyzerConfig


def test_tempo_analyzer_inherits_base():
    config = AnalyzerConfig(name="essentia_rhythm", version="2.1")
    analyzer = TempoAnalyzer(config)
    assert isinstance(analyzer, AnalyzerBase)


def test_tempo_analyzer_is_available():
    config = AnalyzerConfig(name="essentia_rhythm", version="2.1")
    analyzer = TempoAnalyzer(config)
    assert analyzer.is_available() is True


def test_tempo_detection_returns_valid_bpm(complex_audio):
    config = AnalyzerConfig(name="essentia_rhythm", version="2.1")
    analyzer = TempoAnalyzer(config)
    result = analyzer.analyze(str(complex_audio))
    assert "bpm" in result
    assert 20 <= result["bpm"] <= 300
    assert "confidence" in result
    assert 0 <= result["confidence"] <= 1
    assert "beats" in result
    assert isinstance(result["beats"], list)


def test_tempo_detection_on_sine_wave(sine_wave_audio):
    """Sine wave has no rhythm; should still return a result without crashing."""
    config = AnalyzerConfig(name="essentia_rhythm", version="2.1")
    analyzer = TempoAnalyzer(config)
    result = analyzer.analyze(str(sine_wave_audio))
    assert "bpm" in result
    assert isinstance(result["bpm"], float)
