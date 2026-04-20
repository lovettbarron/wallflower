"""AI-05: Loop detection using self-similarity matrix and diagonal stripe detection."""
import logging

import librosa
import numpy as np

from .base import AnalyzerBase, AnalyzerConfig

logger = logging.getLogger(__name__)


class LoopAnalyzer(AnalyzerBase):
    """Detects repeated sections (loops) and marks evolving loops (D-05).
    Uses chroma self-similarity matrix with diagonal stripe detection."""

    def analyze(self, audio_path: str) -> dict:
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)

        if duration < 4.0:
            return []

        # Compute chroma features
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        # Compute MFCCs for evolving detection
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # Beat-synchronize for cleaner analysis
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        if len(beats) < 4:
            return []

        beat_chroma = librosa.util.sync(chroma, beats, aggregate=np.median)
        beat_mfcc = librosa.util.sync(mfcc, beats, aggregate=np.median)
        beat_times = librosa.frames_to_time(beats, sr=sr)

        # Build self-similarity matrix from chroma
        # Normalize columns
        norms = np.linalg.norm(beat_chroma, axis=0, keepdims=True)
        norms[norms == 0] = 1.0
        beat_chroma_norm = beat_chroma / norms

        sim = beat_chroma_norm.T @ beat_chroma_norm  # cosine similarity

        n = sim.shape[0]

        # Detect diagonal stripes: look for off-diagonal bands with high similarity
        min_loop_beats = max(2, self.config.params.get("min_loop_beats", 4))
        similarity_threshold = self.config.params.get("similarity_threshold", 0.85)
        evolving_threshold = self.config.params.get("evolving_threshold", 0.15)

        loops = []
        used_regions: list[tuple[int, int]] = []

        # Scan for repeated regions by checking off-diagonal stripes
        for offset in range(min_loop_beats, n):
            # Get the diagonal at this offset
            diag = np.array([sim[i, i + offset] for i in range(n - offset)])

            if len(diag) < min_loop_beats:
                continue

            # Find runs of high similarity
            high = diag > similarity_threshold
            runs = self._find_runs(high, min_loop_beats)

            for start, length in runs:
                # Check if this region overlaps with already-found loops
                region_a = (start, start + length)
                region_b = (start + offset, start + offset + length)

                if self._overlaps(region_a, used_regions) or self._overlaps(region_b, used_regions):
                    continue

                # Count total repetitions of this pattern
                pattern = beat_chroma_norm[:, start:start + length]
                repeat_count = self._count_repetitions(
                    beat_chroma_norm, pattern, similarity_threshold
                )

                if repeat_count < 2:
                    continue

                # Detect evolving: compare MFCC features between repetitions
                evolving = self._detect_evolving(
                    beat_mfcc, start, length, offset, evolving_threshold
                )

                # Convert to time
                start_time = float(beat_times[start]) if start < len(beat_times) else 0.0
                end_idx = min(start + length, len(beat_times) - 1)
                end_time = float(beat_times[end_idx]) if end_idx < len(beat_times) else duration

                if end_time <= start_time:
                    continue

                loops.append({
                    "start_seconds": start_time,
                    "end_seconds": end_time,
                    "repeat_count": repeat_count,
                    "evolving": evolving,
                    "label": "",
                })

                used_regions.append(region_a)
                used_regions.append(region_b)

        # Assign labels: Loop A, Loop B, etc.
        for i, loop in enumerate(loops):
            letter = chr(ord("A") + i) if i < 26 else f"L{i}"
            loop["label"] = f"Loop {letter}"

        return loops

    def _find_runs(self, mask: np.ndarray, min_length: int) -> list[tuple[int, int]]:
        """Find contiguous runs of True values with minimum length."""
        runs = []
        start = None
        for i, val in enumerate(mask):
            if val:
                if start is None:
                    start = i
            else:
                if start is not None and (i - start) >= min_length:
                    runs.append((start, i - start))
                start = None
        if start is not None and (len(mask) - start) >= min_length:
            runs.append((start, len(mask) - start))
        return runs

    def _overlaps(self, region: tuple[int, int], used: list[tuple[int, int]]) -> bool:
        """Check if a region overlaps with any used region."""
        a_start, a_end = region
        for b_start, b_end in used:
            if a_start < b_end and a_end > b_start:
                return True
        return False

    def _count_repetitions(
        self, features: np.ndarray, pattern: np.ndarray, threshold: float
    ) -> int:
        """Count how many times a pattern repeats across the full feature matrix."""
        pat_len = pattern.shape[1]
        n = features.shape[1]
        count = 0

        for i in range(0, n - pat_len + 1, pat_len):
            segment = features[:, i:i + pat_len]
            if segment.shape[1] != pat_len:
                continue
            # Cosine similarity between flattened vectors
            p_flat = pattern.flatten()
            s_flat = segment.flatten()
            norm_p = np.linalg.norm(p_flat)
            norm_s = np.linalg.norm(s_flat)
            if norm_p == 0 or norm_s == 0:
                continue
            cos_sim = np.dot(p_flat, s_flat) / (norm_p * norm_s)
            if cos_sim > threshold:
                count += 1

        return count

    def _detect_evolving(
        self,
        mfcc: np.ndarray,
        start: int,
        length: int,
        offset: int,
        threshold: float,
    ) -> bool:
        """Detect if a loop is evolving by comparing MFCC features between repetitions.
        Per D-05: if feature distance > threshold, the loop is evolving."""
        try:
            seg1 = mfcc[:, start:start + length]
            seg2_start = start + offset
            seg2 = mfcc[:, seg2_start:seg2_start + length]

            if seg1.shape[1] == 0 or seg2.shape[1] == 0:
                return False
            if seg1.shape != seg2.shape:
                return False

            # Normalize and compute distance
            dist = np.mean(np.abs(seg1 - seg2)) / (np.mean(np.abs(seg1)) + 1e-8)
            return bool(dist > threshold)
        except Exception:
            return False

    def is_available(self) -> bool:
        try:
            import librosa
            return True
        except ImportError:
            return False
