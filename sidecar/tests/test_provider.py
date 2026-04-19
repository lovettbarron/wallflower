"""Tests for AI-08: Model interface abstracted for configuration-based swapping."""

import pytest
from wallflower_sidecar.analyzers.base import AnalyzerBase, AnalyzerConfig


class MockAnalyzer(AnalyzerBase):
    def analyze(self, audio_path: str) -> dict:
        return {"mock": True}

    def is_available(self) -> bool:
        return True


def test_analyzer_base_requires_config():
    config = AnalyzerConfig(name="test", version="1.0")
    analyzer = MockAnalyzer(config)
    assert analyzer.name == "test"
    assert analyzer.version == "1.0"


def test_analyzer_config_swap():
    """AI-08: Swapping requires only config change, not code change."""
    config_a = AnalyzerConfig(name="model_a", version="1.0", model_path="/models/a")
    config_b = AnalyzerConfig(name="model_b", version="2.0", model_path="/models/b")
    analyzer_a = MockAnalyzer(config_a)
    analyzer_b = MockAnalyzer(config_b)
    assert analyzer_a.name != analyzer_b.name
    assert analyzer_a.version != analyzer_b.version


def test_analyzer_base_is_abstract():
    config = AnalyzerConfig(name="test", version="1.0")
    with pytest.raises(TypeError):
        AnalyzerBase(config)  # Cannot instantiate abstract class
