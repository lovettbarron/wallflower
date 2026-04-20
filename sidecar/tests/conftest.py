import pytest
import numpy as np
import soundfile as sf
from pathlib import Path


@pytest.fixture
def test_audio_dir(tmp_path):
    """Provides a temporary directory for test audio files."""
    return tmp_path


@pytest.fixture
def sine_wave_audio(test_audio_dir) -> Path:
    """Generate a 10-second 440Hz sine wave WAV for testing."""
    sr = 44100
    duration = 10.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    audio = 0.5 * np.sin(2 * np.pi * 440 * t)
    path = test_audio_dir / "test_sine.wav"
    sf.write(str(path), audio, sr)
    return path


@pytest.fixture
def complex_audio(test_audio_dir) -> Path:
    """Generate a 30-second audio with tempo and key characteristics for testing."""
    sr = 44100
    duration = 30.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # 120 BPM kick-like pulse (2Hz = 120BPM)
    kick = (
        0.3
        * np.sin(2 * np.pi * 60 * t)
        * (np.sin(2 * np.pi * 2 * t) > 0.8).astype(float)
    )
    # A minor chord tones (A=220, C=261.6, E=329.6)
    chord = 0.15 * (
        np.sin(2 * np.pi * 220 * t)
        + np.sin(2 * np.pi * 261.6 * t)
        + np.sin(2 * np.pi * 329.6 * t)
    )
    audio = kick + chord
    audio = audio / np.max(np.abs(audio)) * 0.8
    path = test_audio_dir / "test_complex.wav"
    sf.write(str(path), audio, sr)
    return path
