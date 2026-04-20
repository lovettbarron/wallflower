"""AI-03: Section detection using librosa Laplacian segmentation."""
import logging
import string

import librosa
import numpy as np
from scipy.spatial.distance import squareform, pdist
from sklearn.cluster import KMeans

from .base import AnalyzerBase, AnalyzerConfig

logger = logging.getLogger(__name__)


class SectionAnalyzer(AnalyzerBase):
    """Detects structural sections (Intro, A, B, Outro) via spectral clustering."""

    def analyze(self, audio_path: str) -> dict:
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)

        # Compute features for segmentation
        # Use CQT-based chromagram for harmonic content
        C = librosa.feature.chroma_cqt(y=y, sr=sr)
        # Use MFCCs for timbral content
        M = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # Stack features
        features = np.vstack([C, M])

        # Beat-synchronize features for cleaner boundaries
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        if len(beats) < 4:
            # Not enough beats -- fall back to fixed-frame segmentation
            return self._fixed_segmentation(duration)

        beat_features = librosa.util.sync(features, beats, aggregate=np.median)

        # Self-similarity via recurrence matrix
        R = librosa.segment.recurrence_matrix(
            beat_features, width=3, mode="affinity", sym=True
        )

        # Laplacian segmentation: find segment boundaries
        # Try multiple k values, pick best silhouette score
        min_k = self.config.params.get("min_sections", 2)
        max_k = self.config.params.get("max_sections", 8)
        max_k = min(max_k, beat_features.shape[1] - 1)
        if max_k < min_k:
            max_k = min_k

        best_k = min_k
        best_score = -1.0
        best_labels = None

        for k in range(min_k, max_k + 1):
            try:
                # Spectral decomposition of the Laplacian
                L = np.diag(R.sum(axis=1)) - R
                eigvals, eigvecs = np.linalg.eigh(L)
                # Use first k eigenvectors (skip the trivial one)
                X = eigvecs[:, :k]

                kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
                labels = kmeans.fit_predict(X)

                # Silhouette score to evaluate clustering quality
                if k > 1 and k < len(labels):
                    from sklearn.metrics import silhouette_score
                    score = silhouette_score(X, labels)
                    if score > best_score:
                        best_score = score
                        best_k = k
                        best_labels = labels
            except Exception:
                continue

        if best_labels is None:
            # Fallback: use min_k
            L = np.diag(R.sum(axis=1)) - R
            eigvals, eigvecs = np.linalg.eigh(L)
            X = eigvecs[:, :min_k]
            kmeans = KMeans(n_clusters=min_k, n_init=10, random_state=42)
            best_labels = kmeans.fit_predict(X)

        # Convert beat indices to times
        beat_times = librosa.frames_to_time(beats, sr=sr)

        # Build sections from label changes
        sections = []
        current_label = best_labels[0]
        section_start = 0.0

        for i in range(1, len(best_labels)):
            if best_labels[i] != current_label:
                end_time = float(beat_times[i]) if i < len(beat_times) else duration
                sections.append({
                    "start_seconds": float(section_start),
                    "end_seconds": end_time,
                    "cluster_id": int(current_label),
                    "label": "",  # assigned below
                })
                section_start = end_time
                current_label = best_labels[i]

        # Final section
        sections.append({
            "start_seconds": float(section_start),
            "end_seconds": float(duration),
            "cluster_id": int(current_label),
            "label": "",
        })

        # Assign labels: Intro, sequential letters for middle, Outro
        sections = self._assign_labels(sections)

        return sections

    def _fixed_segmentation(self, duration: float) -> list[dict]:
        """Fallback: split into 3 equal sections."""
        third = duration / 3.0
        return [
            {"start_seconds": 0.0, "end_seconds": third, "label": "Intro", "cluster_id": 0},
            {"start_seconds": third, "end_seconds": 2 * third, "label": "A", "cluster_id": 1},
            {"start_seconds": 2 * third, "end_seconds": duration, "label": "Outro", "cluster_id": 2},
        ]

    def _assign_labels(self, sections: list[dict]) -> list[dict]:
        """Label sections: first=Intro, last=Outro, middle=sequential letters.
        Repeated clusters get the same letter."""
        if not sections:
            return sections

        # Map cluster IDs to letters
        seen_clusters: dict[int, str] = {}
        letter_idx = 0
        letters = list(string.ascii_uppercase)

        for i, section in enumerate(sections):
            if i == 0:
                section["label"] = "Intro"
            elif i == len(sections) - 1:
                section["label"] = "Outro"
            else:
                cid = section["cluster_id"]
                if cid not in seen_clusters:
                    if letter_idx < len(letters):
                        seen_clusters[cid] = letters[letter_idx]
                        letter_idx += 1
                    else:
                        seen_clusters[cid] = f"S{letter_idx}"
                        letter_idx += 1
                section["label"] = seen_clusters[cid]

        return sections

    def is_available(self) -> bool:
        try:
            import librosa
            return True
        except ImportError:
            return False
