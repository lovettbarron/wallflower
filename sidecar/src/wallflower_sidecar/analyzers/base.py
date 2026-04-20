from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AnalyzerConfig:
    """Configuration for an analyzer. Allows model swapping via config change only."""

    name: str
    version: str
    model_path: str | None = None  # None = use default/built-in
    params: dict[str, Any] = field(default_factory=dict)


class AnalyzerBase(ABC):
    """Abstract base for all analysis steps. Subclass for each step (tempo, key, sections, loops).
    Per AI-08: swapping a model requires only a configuration change, not code changes."""

    def __init__(self, config: AnalyzerConfig):
        self.config = config

    @abstractmethod
    def analyze(self, audio_path: str) -> dict:
        """Run analysis on the given audio file. Returns a dict matching the protobuf result type."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this analyzer's dependencies (models, libraries) are available."""
        ...

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def version(self) -> str:
        return self.config.version
