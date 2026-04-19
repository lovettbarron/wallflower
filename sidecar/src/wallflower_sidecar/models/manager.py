import json
from pathlib import Path
from dataclasses import dataclass


@dataclass
class ModelInfo:
    name: str
    version: str
    size_bytes: int
    path: Path
    status: str  # "ready", "downloading", "not_installed", "failed"


class ModelManager:
    """Manages ML model downloads, versioning, and caching.
    Models are stored in ~/Library/Application Support/wallflower/models/"""

    def __init__(self, models_dir: Path | None = None):
        if models_dir is None:
            app_support = (
                Path.home() / "Library" / "Application Support" / "wallflower" / "models"
            )
            self.models_dir = app_support
        else:
            self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._manifest_path = self.models_dir / "manifest.json"
        self._manifest = self._load_manifest()

    def _load_manifest(self) -> dict:
        if self._manifest_path.exists():
            return json.loads(self._manifest_path.read_text())
        return {"models": {}}

    def _save_manifest(self):
        self._manifest_path.write_text(json.dumps(self._manifest, indent=2))

    def get_model_info(self, name: str) -> ModelInfo | None:
        entry = self._manifest.get("models", {}).get(name)
        if entry is None:
            return None
        return ModelInfo(
            name=name,
            version=entry["version"],
            size_bytes=entry.get("size_bytes", 0),
            path=self.models_dir / entry["path"],
            status=entry.get("status", "ready"),
        )

    def list_models(self) -> list[ModelInfo]:
        return [
            self.get_model_info(n)
            for n in self._manifest.get("models", {})
            if self.get_model_info(n)
        ]

    def register_model(
        self, name: str, version: str, path: str, size_bytes: int = 0
    ):
        self._manifest.setdefault("models", {})[name] = {
            "version": version,
            "path": path,
            "size_bytes": size_bytes,
            "status": "ready",
        }
        self._save_manifest()

    def total_disk_usage(self) -> int:
        return sum(m.size_bytes for m in self.list_models())

    def is_model_ready(self, name: str) -> bool:
        info = self.get_model_info(name)
        return info is not None and info.status == "ready"
