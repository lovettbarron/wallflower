"""Tests for AI-07: Model caching and management."""
import pytest
from wallflower_sidecar.models.manager import ModelManager, ModelInfo


def test_model_manager_creates_dir(tmp_path):
    manager = ModelManager(models_dir=tmp_path / "models")
    assert (tmp_path / "models").exists()


def test_register_and_retrieve_model(tmp_path):
    manager = ModelManager(models_dir=tmp_path / "models")
    manager.register_model("test_model", "1.0", "test_model.bin", 1024)
    info = manager.get_model_info("test_model")
    assert info is not None
    assert info.name == "test_model"
    assert info.version == "1.0"
    assert info.size_bytes == 1024
    assert info.status == "ready"


def test_list_models(tmp_path):
    manager = ModelManager(models_dir=tmp_path / "models")
    manager.register_model("model_a", "1.0", "a.bin", 100)
    manager.register_model("model_b", "2.0", "b.bin", 200)
    models = manager.list_models()
    assert len(models) == 2


def test_total_disk_usage(tmp_path):
    manager = ModelManager(models_dir=tmp_path / "models")
    manager.register_model("model_a", "1.0", "a.bin", 100)
    manager.register_model("model_b", "2.0", "b.bin", 200)
    assert manager.total_disk_usage() == 300


def test_model_not_found(tmp_path):
    manager = ModelManager(models_dir=tmp_path / "models")
    assert manager.get_model_info("nonexistent") is None


def test_is_model_ready(tmp_path):
    manager = ModelManager(models_dir=tmp_path / "models")
    manager.register_model("ready_model", "1.0", "ready.bin", 50)
    assert manager.is_model_ready("ready_model") is True
    assert manager.is_model_ready("missing") is False


def test_manifest_persists(tmp_path):
    """AI-07: Models cached and reused across app updates."""
    models_dir = tmp_path / "models"
    manager1 = ModelManager(models_dir=models_dir)
    manager1.register_model("persist_model", "1.0", "persist.bin", 500)

    # New manager instance reads from disk
    manager2 = ModelManager(models_dir=models_dir)
    info = manager2.get_model_info("persist_model")
    assert info is not None
    assert info.version == "1.0"
