"""Tests for SeparationAnalyzer chunking logic, crossfade, and cancellation."""
import threading
import numpy as np
import pytest
from unittest.mock import patch, MagicMock

from wallflower_sidecar.analyzers.separation import (
    SeparationAnalyzer,
    ChunkBoundary,
)
from wallflower_sidecar.analyzers.base import AnalyzerConfig


@pytest.fixture
def analyzer():
    return SeparationAnalyzer(AnalyzerConfig(name="demucs-mlx", version="0.1"))


class TestCalculateChunks:
    """Tests for chunk boundary calculation."""

    def test_short_audio_single_chunk(self, analyzer):
        """5s audio with 10s segment = 1 chunk, no overlap."""
        sr = 44100
        total = 5 * sr  # 5 seconds
        segment = 10 * sr  # 10 seconds
        chunks = analyzer.calculate_chunks(total, segment, overlap_ratio=0.25)
        assert len(chunks) == 1
        assert chunks[0].start_sample == 0
        assert chunks[0].end_sample == total
        assert chunks[0].fade_in_samples == 0
        assert chunks[0].fade_out_samples == 0

    def test_exact_segment_single_chunk(self, analyzer):
        """Audio exactly equal to segment size = 1 chunk."""
        sr = 44100
        total = 10 * sr
        segment = 10 * sr
        chunks = analyzer.calculate_chunks(total, segment, overlap_ratio=0.25)
        assert len(chunks) == 1

    def test_with_overlap_produces_correct_count(self, analyzer):
        """30s audio with 10s segment and 0.25 overlap produces 4 chunks.
        step = 10 - 2.5 = 7.5s. Chunks start at 0, 7.5, 15, 22.5.
        """
        sr = 44100
        total = 30 * sr
        segment = 10 * sr
        chunks = analyzer.calculate_chunks(total, segment, overlap_ratio=0.25)
        assert len(chunks) == 4

    def test_chunk_boundaries_correct(self, analyzer):
        """Verify start/end/fade values are correct for multi-chunk case."""
        sr = 44100
        total = 30 * sr
        segment = 10 * sr
        overlap_ratio = 0.25
        overlap_samples = int(segment * overlap_ratio)
        step = segment - overlap_samples

        chunks = analyzer.calculate_chunks(total, segment, overlap_ratio)

        # First chunk: no fade in
        assert chunks[0].start_sample == 0
        assert chunks[0].fade_in_samples == 0

        # Middle chunks: have fade in
        for c in chunks[1:]:
            assert c.fade_in_samples == overlap_samples

        # Last chunk: no fade out
        assert chunks[-1].fade_out_samples == 0
        assert chunks[-1].end_sample == total

        # Non-last chunks: have fade out
        for c in chunks[:-1]:
            assert c.fade_out_samples == overlap_samples


class TestLinearCrossfade:
    """Tests for overlap-add crossfade."""

    def test_crossfade_blends_correctly(self, analyzer):
        """Verify fade in/out with known values."""
        overlap = 100
        n_stems = 2
        n_channels = 2

        # prev_chunk: all 1.0 in tail
        prev = np.ones((n_stems, n_channels, overlap + 50), dtype=np.float32)
        # next_chunk: all 1.0 in head
        nxt = np.ones((n_stems, n_channels, overlap + 50), dtype=np.float32)

        result = analyzer.linear_crossfade(prev, nxt, overlap)

        assert result.shape == (n_stems, n_channels, overlap)
        # At midpoint, fade_out ~= 0.5, fade_in ~= 0.5, sum ~= 1.0
        mid = overlap // 2
        np.testing.assert_allclose(result[0, 0, mid], 1.0, atol=0.02)

    def test_crossfade_endpoints(self, analyzer):
        """At start: prev dominates. At end: next dominates."""
        overlap = 1000
        prev = np.full((1, 1, overlap + 100), 2.0, dtype=np.float32)
        nxt = np.full((1, 1, overlap + 100), 4.0, dtype=np.float32)

        result = analyzer.linear_crossfade(prev, nxt, overlap)

        # Start: mostly prev (2.0)
        assert result[0, 0, 0] == pytest.approx(2.0, abs=0.01)
        # End: mostly next (4.0)
        assert result[0, 0, -1] == pytest.approx(4.0, abs=0.01)


class TestCancellation:
    """Tests for cancellation flag."""

    def test_cancel_flag_stops_processing(self, analyzer):
        """Set cancel flag between chunks, verify separate returns empty dict."""
        # Create a mock separator that sets the cancel flag after first chunk
        mock_sep = MagicMock()

        def fake_separate(chunk_input, sr=44100):
            # After first call, set the cancel flag so processing stops
            analyzer._cancel_flag.set()
            n_stems = 4
            n_channels = chunk_input.shape[0]
            n_samples = chunk_input.shape[1]
            return np.zeros((n_stems, n_channels, n_samples), dtype=np.float32)

        mock_sep.separate = fake_separate
        analyzer._separator = mock_sep

        # Use audio long enough to need multiple chunks (20s > 10s segment)
        result = analyzer.separate(
            audio_path="dummy.wav",
            start_seconds=0.0,
            end_seconds=20.0,
            output_dir="/tmp/test_stems",
            segment_seconds=10.0,
            _test_audio=np.zeros((44100 * 20, 2), dtype=np.float32),
        )
        assert result == {}


class TestAvailability:
    """Tests for is_available check."""

    def test_is_available_without_demucs(self, analyzer):
        """Mock import failure, verify returns False."""
        with patch.dict("sys.modules", {"demucs_mlx": None}):
            # Force reimport check
            result = analyzer.is_available()
            # When demucs_mlx is set to None in sys.modules, import raises ImportError
            assert result is False
