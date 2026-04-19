pub mod device;
pub mod scheduler;
pub mod silence;
pub mod writer;

use serde::{Deserialize, Serialize};

/// State of the recording engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecordingState {
    Idle,
    Recording,
    Paused,
    DeviceDisconnected,
    Error(String),
}

/// Events emitted by the recording engine during capture.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum RecordingEvent {
    LevelUpdate { rms_db: f32 },
    SilenceStart { offset_samples: u64 },
    SilenceEnd { offset_samples: u64 },
    DeviceError(String),
    DeviceReconnected,
    SamplesWritten { total_samples: u64 },
    StateChanged(RecordingState),
}

/// Configuration for a recording session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub silence_threshold_db: f32,
    pub flush_interval_secs: u64,
    pub reconnect_timeout_secs: u64,
}

impl Default for RecordingConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 2,
            silence_threshold_db: -40.0,
            flush_interval_secs: 5,
            reconnect_timeout_secs: 30,
        }
    }
}

/// The recording engine orchestrates audio capture, crash-safe writing,
/// silence detection, device handling, and priority scheduling.
/// Full implementation in Task 2.
pub struct RecordingEngine {
    pub config: RecordingConfig,
    pub state: std::sync::Arc<std::sync::Mutex<RecordingState>>,
}

impl RecordingEngine {
    /// Create a new recording engine (placeholder - full impl in Task 2).
    pub fn new(config: RecordingConfig) -> Self {
        Self {
            config,
            state: std::sync::Arc::new(std::sync::Mutex::new(RecordingState::Idle)),
        }
    }

    /// Get the current recording state.
    pub fn status(&self) -> RecordingState {
        self.state.lock().unwrap().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recording_config_default() {
        let config = RecordingConfig::default();
        assert_eq!(config.sample_rate, 48000);
        assert_eq!(config.channels, 2);
        assert!((config.silence_threshold_db - (-40.0)).abs() < f32::EPSILON);
        assert_eq!(config.flush_interval_secs, 5);
        assert_eq!(config.reconnect_timeout_secs, 30);
    }

    #[test]
    fn test_recording_state_starts_idle() {
        let engine = RecordingEngine::new(RecordingConfig::default());
        assert_eq!(engine.status(), RecordingState::Idle);
    }

    #[test]
    fn test_recording_event_serialization() {
        let event = RecordingEvent::LevelUpdate { rms_db: -12.5 };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("levelUpdate") || json.contains("LevelUpdate"));
    }
}
