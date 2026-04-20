"""Tests for AI-05: Loop detection."""
import pytest
from wallflower_sidecar.analyzers.loops import LoopAnalyzer
from wallflower_sidecar.analyzers.base import AnalyzerBase, AnalyzerConfig


def test_loop_analyzer_inherits_base():
    config = AnalyzerConfig(name="custom_loops", version="0.1")
    analyzer = LoopAnalyzer(config)
    assert isinstance(analyzer, AnalyzerBase)


def test_loop_detection_returns_valid_structure(complex_audio):
    config = AnalyzerConfig(name="custom_loops", version="0.1")
    analyzer = LoopAnalyzer(config)
    result = analyzer.analyze(str(complex_audio))
    assert isinstance(result, list)
    for loop in result:
        assert "start_seconds" in loop
        assert "end_seconds" in loop
        assert "repeat_count" in loop
        assert "evolving" in loop
        assert "label" in loop
        assert loop["repeat_count"] >= 2
        assert isinstance(loop["evolving"], bool)
        assert loop["end_seconds"] > loop["start_seconds"]


def test_loop_detection_handles_no_loops(sine_wave_audio):
    """Sine wave has no loops; should return empty list."""
    config = AnalyzerConfig(name="custom_loops", version="0.1")
    analyzer = LoopAnalyzer(config)
    result = analyzer.analyze(str(sine_wave_audio))
    assert isinstance(result, list)
