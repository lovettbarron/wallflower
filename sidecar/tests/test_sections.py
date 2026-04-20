"""Tests for AI-03: Section detection."""
import pytest
from wallflower_sidecar.analyzers.sections import SectionAnalyzer
from wallflower_sidecar.analyzers.base import AnalyzerBase, AnalyzerConfig


def test_section_analyzer_inherits_base():
    config = AnalyzerConfig(name="librosa_sections", version="0.10")
    analyzer = SectionAnalyzer(config)
    assert isinstance(analyzer, AnalyzerBase)


def test_section_detection_returns_boundaries(complex_audio):
    config = AnalyzerConfig(name="librosa_sections", version="0.10")
    analyzer = SectionAnalyzer(config)
    result = analyzer.analyze(str(complex_audio))
    assert isinstance(result, list)
    assert len(result) >= 2
    for section in result:
        assert "start_seconds" in section
        assert "end_seconds" in section
        assert "label" in section
        assert "cluster_id" in section
        assert section["end_seconds"] > section["start_seconds"]


def test_section_labels_use_letter_scheme(complex_audio):
    config = AnalyzerConfig(name="librosa_sections", version="0.10")
    analyzer = SectionAnalyzer(config)
    result = analyzer.analyze(str(complex_audio))
    if len(result) > 0:
        assert result[0]["label"] == "Intro"
    if len(result) > 1:
        assert result[-1]["label"] == "Outro"
