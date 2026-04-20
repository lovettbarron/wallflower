"""AI-04/AI-10: Source separation using demucs-mlx with chunked processing and overlap-add crossfading."""
import time
import threading
import logging
from pathlib import Path
from typing import Callable, Optional
from dataclasses import dataclass

import numpy as np
import soundfile as sf

from .base import AnalyzerBase, AnalyzerConfig

logger = logging.getLogger(__name__)

STEM_NAMES_4 = ["drums", "bass", "vocals", "other"]
STEM_NAMES_6 = ["drums", "bass", "vocals", "guitar", "piano", "other"]


@dataclass
class ChunkBoundary:
    """Defines a chunk's sample range and fade regions for overlap-add."""
    start_sample: int
    end_sample: int
    fade_in_samples: int   # number of samples to fade in at start
    fade_out_samples: int  # number of samples to fade out at end


@dataclass
class SeparationProgress:
    """Progress report for a separation job."""
    current_chunk: int
    total_chunks: int
    percent_complete: float
    estimated_seconds_remaining: float


class SeparationAnalyzer(AnalyzerBase):
    """Source separation using demucs-mlx. Processes audio in chunks with overlap-add crossfading.

    Per AI-04: performs source separation using local AI models.
    Per AI-10: model interface is abstracted -- model_name config selects the model.
    """

    def __init__(self, config: AnalyzerConfig | None = None):
        super().__init__(config or AnalyzerConfig(name="demucs-mlx", version="0.1"))
        self._cancel_flag = threading.Event()
        self._separator = None

    def is_available(self) -> bool:
        """Check if demucs-mlx is installed and importable."""
        try:
            import demucs_mlx  # noqa: F401
            return True
        except ImportError:
            return False

    def analyze(self, audio_path: str) -> dict:
        """Not used for separation -- use separate() instead."""
        raise NotImplementedError("Use separate() for source separation")

    def cancel(self):
        """Signal cancellation. Processing stops between chunks."""
        self._cancel_flag.set()

    def reset_cancel(self):
        """Clear the cancellation flag for a new job."""
        self._cancel_flag.clear()

    @staticmethod
    def calculate_chunks(
        total_samples: int,
        segment_samples: int,
        overlap_ratio: float = 0.25,
    ) -> list[ChunkBoundary]:
        """Calculate chunk boundaries with overlap for overlap-add crossfading.

        Args:
            total_samples: Total number of audio samples.
            segment_samples: Target chunk size in samples.
            overlap_ratio: Fraction of segment_samples to overlap (0.0-1.0).

        Returns:
            List of ChunkBoundary with sample ranges and fade regions.
        """
        if total_samples <= segment_samples:
            return [ChunkBoundary(0, total_samples, 0, 0)]

        overlap_samples = int(segment_samples * overlap_ratio)
        step = segment_samples - overlap_samples
        chunks: list[ChunkBoundary] = []
        pos = 0

        while pos < total_samples:
            end = min(pos + segment_samples, total_samples)
            fade_in = overlap_samples if pos > 0 else 0
            fade_out = overlap_samples if end < total_samples else 0
            chunks.append(ChunkBoundary(pos, end, fade_in, fade_out))
            if end >= total_samples:
                break
            pos += step

        return chunks

    @staticmethod
    def linear_crossfade(
        prev_chunk: np.ndarray,
        next_chunk: np.ndarray,
        overlap_samples: int,
    ) -> np.ndarray:
        """Apply linear crossfade on the overlap region between two chunks.

        Args:
            prev_chunk: Shape (stems, channels, samples) -- the previous chunk output.
            next_chunk: Shape (stems, channels, samples) -- the current chunk output.
            overlap_samples: Number of samples in the overlap region.

        Returns:
            Blended overlap region with shape (stems, channels, overlap_samples).
        """
        fade_out = np.linspace(1.0, 0.0, overlap_samples, dtype=np.float32)
        fade_in = np.linspace(0.0, 1.0, overlap_samples, dtype=np.float32)
        prev_tail = prev_chunk[:, :, -overlap_samples:]
        next_head = next_chunk[:, :, :overlap_samples]
        return prev_tail * fade_out + next_head * fade_in

    def separate(
        self,
        audio_path: str,
        start_seconds: float,
        end_seconds: float,
        output_dir: str,
        model_name: str = "htdemucs",
        segment_seconds: float = 10.0,
        overlap: float = 0.25,
        sample_rate: int = 44100,
        on_progress: Optional[Callable[[SeparationProgress], None]] = None,
        _test_audio: Optional[np.ndarray] = None,
    ) -> dict[str, str]:
        """Separate audio into stems using demucs-mlx.

        Args:
            audio_path: Path to the audio file.
            start_seconds: Start time of the region to separate.
            end_seconds: End time of the region to separate.
            output_dir: Directory to write stem WAV files.
            model_name: Demucs model name ("htdemucs" or "htdemucs_6s").
            segment_seconds: Chunk size in seconds for processing.
            overlap: Overlap ratio between chunks (0.0-1.0).
            sample_rate: Sample rate for reading audio.
            on_progress: Optional callback for progress updates.
            _test_audio: Optional pre-loaded audio for testing (bypasses file I/O).

        Returns:
            Dict of stem_name -> output_file_path. Empty dict if cancelled.
        """
        self.reset_cancel()
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        stem_names = STEM_NAMES_6 if "6s" in model_name else STEM_NAMES_4

        # 1. Load audio segment
        if _test_audio is not None:
            audio = _test_audio
            sr = sample_rate
        else:
            audio, sr = sf.read(
                audio_path,
                start=int(start_seconds * sample_rate),
                stop=int(end_seconds * sample_rate),
                dtype="float32",
            )
        if audio.ndim == 1:
            audio = audio[:, np.newaxis]  # mono -> (samples, 1)
        # audio shape: (samples, channels)

        total_samples = audio.shape[0]
        segment_samples = int(segment_seconds * sr)
        chunks = self.calculate_chunks(total_samples, segment_samples, overlap)
        total_chunks = len(chunks)
        overlap_samples = int(segment_samples * overlap)

        # Initialize output arrays: one per stem
        n_stems = len(stem_names)
        n_channels = audio.shape[1]
        result = np.zeros((n_stems, n_channels, total_samples), dtype=np.float32)

        start_time = time.time()

        # 2. Lazy-load demucs-mlx separator
        if self._separator is None:
            from demucs_mlx import Separator
            self._separator = Separator(model=model_name)

        prev_chunk_output = None

        for i, chunk in enumerate(chunks):
            # Check cancellation between chunks
            if self._cancel_flag.is_set():
                logger.info("Separation cancelled after chunk %d/%d", i, total_chunks)
                return {}

            # Extract chunk audio
            chunk_audio = audio[chunk.start_sample:chunk.end_sample]

            # Run demucs on chunk -- expects (channels, samples)
            chunk_input = chunk_audio.T  # (channels, samples)
            separated = self._separator.separate(chunk_input, sr=sr)
            # separated shape expected: (stems, channels, samples)

            # Apply crossfade with previous chunk overlap region
            if prev_chunk_output is not None and chunk.fade_in_samples > 0:
                blended = self.linear_crossfade(
                    prev_chunk_output, separated, overlap_samples
                )
                write_start = chunk.start_sample
                result[:, :, write_start:write_start + overlap_samples] = blended
                # Write non-overlap portion of current chunk
                result[:, :, write_start + overlap_samples:chunk.end_sample] = \
                    separated[:, :, overlap_samples:]
            else:
                # First chunk or no overlap
                result[:, :, chunk.start_sample:chunk.end_sample] = separated

            prev_chunk_output = separated

            # Report progress
            elapsed = time.time() - start_time
            chunks_done = i + 1
            if chunks_done > 0 and chunks_done < total_chunks:
                eta = (elapsed / chunks_done) * (total_chunks - chunks_done)
            else:
                eta = 0.0
            pct = (chunks_done / total_chunks) * 100.0

            if on_progress:
                on_progress(SeparationProgress(
                    current_chunk=chunks_done,
                    total_chunks=total_chunks,
                    percent_complete=pct,
                    estimated_seconds_remaining=eta,
                ))

        # 3. Write stem files
        stem_paths: dict[str, str] = {}
        for j, name in enumerate(stem_names):
            stem_path = out / f"{name}.wav"
            stem_audio = result[j].T  # (samples, channels)
            sf.write(str(stem_path), stem_audio, sr, subtype="FLOAT")
            stem_paths[name] = str(stem_path)

        return stem_paths
