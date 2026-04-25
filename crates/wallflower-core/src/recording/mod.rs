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

/// Channel mapping configuration for recording.
///
/// Maps physical input channels on the device to output recording slots.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelMapping {
    /// Number of channels to write to the output WAV file.
    pub output_channels: u16,
    /// Maps output channel index -> physical input channel index.
    /// Length must equal output_channels. Values are 0-based indices
    /// into the device's physical input channels.
    /// Example: [0, 1] = stereo from first two inputs
    /// Example: [2, 3] = stereo from inputs 3 and 4
    /// Example: [0] = mono from input 1
    pub channel_map: Vec<u16>,
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

use cpal::traits::{DeviceTrait, StreamTrait};
use crossbeam_channel::Sender;
use scheduler::PriorityScheduler;
use silence::SilenceDetector;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use writer::CrashSafeWriter;

/// The recording engine orchestrates audio capture, crash-safe writing,
/// silence detection, device handling, and priority scheduling.
pub struct RecordingEngine {
    config: RecordingConfig,
    state: Arc<Mutex<RecordingState>>,
    event_tx: Sender<RecordingEvent>,
    scheduler: PriorityScheduler,
    stream: Arc<Mutex<Option<cpal::Stream>>>,
    writer: Arc<Mutex<Option<CrashSafeWriter>>>,
    current_jam_id: Arc<Mutex<Option<String>>>,
    current_file_path: Arc<Mutex<Option<PathBuf>>>,
    current_device_name: Arc<Mutex<Option<String>>>,
    silence_detector: Arc<Mutex<SilenceDetector>>,
}

impl RecordingEngine {
    /// Create a new recording engine.
    pub fn new(
        config: RecordingConfig,
        event_tx: Sender<RecordingEvent>,
        scheduler: PriorityScheduler,
    ) -> Self {
        let silence_detector = SilenceDetector::new(
            config.silence_threshold_db,
            config.sample_rate,
        );

        Self {
            config,
            state: Arc::new(Mutex::new(RecordingState::Idle)),
            event_tx,
            scheduler,
            stream: Arc::new(Mutex::new(None)),
            writer: Arc::new(Mutex::new(None)),
            current_jam_id: Arc::new(Mutex::new(None)),
            current_file_path: Arc::new(Mutex::new(None)),
            current_device_name: Arc::new(Mutex::new(None)),
            silence_detector: Arc::new(Mutex::new(silence_detector)),
        }
    }

    /// Start recording audio from the specified (or default) input device.
    ///
    /// Creates a new WAV file at `storage_dir/{jam_id}.wav` and begins
    /// capturing audio. The priority scheduler is set to recording mode,
    /// pausing all background processing (REC-08, D-13).
    ///
    /// If `device_name` is provided, attempts to use that device; falls back
    /// to the system default if not found. If `channel_mapping` is provided,
    /// only the specified physical channels are written to the WAV file.
    pub fn start(
        &self,
        storage_dir: &Path,
        jam_id: &str,
        device_name: Option<&str>,
        channel_mapping: Option<&ChannelMapping>,
    ) -> anyhow::Result<()> {
        // Set priority scheduler to recording mode (D-13, REC-08)
        self.scheduler.set_recording(true);

        // Get the input device (by name or default)
        let cpal_device = if let Some(name) = device_name {
            device::get_cpal_device_by_name(name)
                .ok_or_else(|| anyhow::anyhow!("No input device available"))?
        } else {
            device::get_default_cpal_device()
                .ok_or_else(|| anyhow::anyhow!("No default input device available"))?
        };

        let actual_device_name = cpal_device
            .name()
            .unwrap_or_else(|_| "Unknown".to_string());

        // Get supported config
        let supported_config = cpal_device
            .default_input_config()
            .map_err(|e| anyhow::anyhow!("Failed to get default input config: {}", e))?;

        let sample_rate = supported_config.sample_rate().0;
        let device_channels = supported_config.channels();

        // Determine output WAV spec based on channel mapping
        let wav_channels = if let Some(mapping) = channel_mapping {
            mapping.output_channels
        } else {
            device_channels
        };

        // Create WavSpec from device config
        let wav_spec = hound::WavSpec {
            channels: wav_channels,
            sample_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };

        // Create output file path
        let file_path = storage_dir.join(format!("{}.wav", jam_id));

        // Create crash-safe writer
        let flush_interval = Duration::from_secs(self.config.flush_interval_secs);
        let crash_writer = CrashSafeWriter::new(&file_path, wav_spec, flush_interval)?;

        // Store writer and metadata
        {
            *self.writer.lock().unwrap() = Some(crash_writer);
            *self.current_jam_id.lock().unwrap() = Some(jam_id.to_string());
            *self.current_file_path.lock().unwrap() = Some(file_path);
            *self.current_device_name.lock().unwrap() = Some(actual_device_name.clone());
        }

        // Build the cpal input stream
        let writer_ref = Arc::clone(&self.writer);
        let event_tx = self.event_tx.clone();
        let silence_ref = Arc::clone(&self.silence_detector);
        let sample_offset = Arc::new(std::sync::atomic::AtomicU64::new(0));

        // The stream receives all physical channels from the device
        let stream_channels = device_channels;

        // Clone channel map for the data callback
        let channel_map: Option<Vec<u16>> = channel_mapping.map(|m| m.channel_map.clone());
        let output_ch_count = wav_channels;

        let stream_config: cpal::StreamConfig = supported_config.into();

        let data_callback = move |data: &[f32], _info: &cpal::InputCallbackInfo| {
            // Remap channels if a mapping is provided
            if let Some(ref map) = channel_map {
                // Extract only the mapped channels from each frame
                let frame_count = data.len() / stream_channels as usize;
                let mut mapped = Vec::with_capacity(frame_count * output_ch_count as usize);
                for frame_idx in 0..frame_count {
                    let frame_start = frame_idx * stream_channels as usize;
                    for &phys_ch in map.iter() {
                        let sample_idx = frame_start + phys_ch as usize;
                        if sample_idx < data.len() {
                            mapped.push(data[sample_idx]);
                        } else {
                            mapped.push(0.0);
                        }
                    }
                }

                // Write mapped samples to crash-safe writer
                if let Ok(guard) = writer_ref.try_lock() {
                    if let Some(ref w) = *guard {
                        let _ = w.write_samples(&mapped);
                    }
                }

                // Compute RMS for level metering on mapped data
                if !mapped.is_empty() {
                    let sum_sq: f32 = mapped.iter().map(|&s| s * s).sum();
                    let rms = (sum_sq / mapped.len() as f32).sqrt();
                    let rms_db = if rms > 0.0 {
                        20.0 * rms.log10()
                    } else {
                        -120.0
                    };
                    let _ = event_tx.try_send(RecordingEvent::LevelUpdate { rms_db });
                }

                // Update sample offset using mapped channel count for frames
                let frames = mapped.len() as u64 / output_ch_count as u64;
                let offset = sample_offset.fetch_add(frames, std::sync::atomic::Ordering::Relaxed);

                // Run silence detection on mapped data
                if let Ok(mut detector) = silence_ref.try_lock() {
                    let events = detector.process_samples(&mapped, output_ch_count, offset);
                    for event in events {
                        match event {
                            silence::SilenceEvent::Start { offset_samples } => {
                                let _ = event_tx.try_send(RecordingEvent::SilenceStart { offset_samples });
                            }
                            silence::SilenceEvent::End { offset_samples } => {
                                let _ = event_tx.try_send(RecordingEvent::SilenceEnd { offset_samples });
                            }
                        }
                    }
                }

                // Send samples written event periodically
                let total = offset + frames;
                if total % 48000 < frames {
                    let _ = event_tx.try_send(RecordingEvent::SamplesWritten {
                        total_samples: total,
                    });
                }
            } else {
                // No channel mapping -- write all channels as before
                if let Ok(guard) = writer_ref.try_lock() {
                    if let Some(ref w) = *guard {
                        let _ = w.write_samples(data);
                    }
                }

                // Compute RMS for level metering
                if !data.is_empty() {
                    let sum_sq: f32 = data.iter().map(|&s| s * s).sum();
                    let rms = (sum_sq / data.len() as f32).sqrt();
                    let rms_db = if rms > 0.0 {
                        20.0 * rms.log10()
                    } else {
                        -120.0
                    };
                    let _ = event_tx.try_send(RecordingEvent::LevelUpdate { rms_db });
                }

                // Update sample offset
                let frames = data.len() as u64 / stream_channels as u64;
                let offset = sample_offset.fetch_add(frames, std::sync::atomic::Ordering::Relaxed);

                // Run silence detection
                if let Ok(mut detector) = silence_ref.try_lock() {
                    let events = detector.process_samples(data, stream_channels, offset);
                    for event in events {
                        match event {
                            silence::SilenceEvent::Start { offset_samples } => {
                                let _ = event_tx.try_send(RecordingEvent::SilenceStart { offset_samples });
                            }
                            silence::SilenceEvent::End { offset_samples } => {
                                let _ = event_tx.try_send(RecordingEvent::SilenceEnd { offset_samples });
                            }
                        }
                    }
                }

                // Send samples written event periodically
                let total = offset + frames;
                if total % 48000 < frames {
                    let _ = event_tx.try_send(RecordingEvent::SamplesWritten {
                        total_samples: total,
                    });
                }
            }
        };

        let error_tx = self.event_tx.clone();
        let error_callback = move |err: cpal::StreamError| {
            tracing::error!("Stream error: {}", err);
            let _ = error_tx.try_send(RecordingEvent::DeviceError(err.to_string()));
        };

        let stream = cpal_device
            .build_input_stream(&stream_config, data_callback, error_callback, None)
            .map_err(|e| anyhow::anyhow!("Failed to build input stream: {}", e))?;

        stream
            .play()
            .map_err(|e| anyhow::anyhow!("Failed to start stream: {}", e))?;

        *self.stream.lock().unwrap() = Some(stream);

        // Update state
        {
            let mut state = self.state.lock().unwrap();
            *state = RecordingState::Recording;
        }
        let _ = self
            .event_tx
            .try_send(RecordingEvent::StateChanged(RecordingState::Recording));

        tracing::info!(
            "Recording started: device={}, sample_rate={}, channels={} (wav={})",
            actual_device_name,
            sample_rate,
            device_channels,
            wav_channels
        );

        Ok(())
    }

    /// Stop recording and finalize the WAV file.
    ///
    /// Returns the path to the finalized WAV file.
    pub fn stop(&self) -> anyhow::Result<PathBuf> {
        // Drop the cpal stream first (stops audio callback)
        {
            let mut stream_guard = self.stream.lock().unwrap();
            *stream_guard = None;
        }

        // Finalize the crash-safe writer
        let file_path = {
            let mut writer_guard = self.writer.lock().unwrap();
            if let Some(writer) = writer_guard.take() {
                writer.finalize()?
            } else {
                return Err(anyhow::anyhow!("No active writer to finalize"));
            }
        };

        // Clear metadata
        {
            *self.current_jam_id.lock().unwrap() = None;
            *self.current_device_name.lock().unwrap() = None;
        }

        // Set scheduler to allow background processing
        self.scheduler.set_recording(false);

        // Update state
        {
            let mut state = self.state.lock().unwrap();
            *state = RecordingState::Idle;
        }
        let _ = self
            .event_tx
            .try_send(RecordingEvent::StateChanged(RecordingState::Idle));

        tracing::info!("Recording stopped: {}", file_path.display());

        Ok(file_path)
    }

    /// Get the current recording state.
    pub fn status(&self) -> RecordingState {
        self.state.lock().unwrap().clone()
    }

    /// Get the name of the current input device.
    pub fn device_name(&self) -> Option<String> {
        self.current_device_name.lock().unwrap().clone()
    }

    /// Handle a device disconnect event.
    ///
    /// Sets the state to DeviceDisconnected and starts polling for the device
    /// to reconnect. If it reconnects within the timeout, the recording
    /// continues with a gap marker. If the timeout expires, recording stops.
    pub fn handle_device_disconnect(&self) {
        // Update state
        {
            let mut state = self.state.lock().unwrap();
            *state = RecordingState::DeviceDisconnected;
        }
        let _ = self.event_tx.try_send(RecordingEvent::StateChanged(
            RecordingState::DeviceDisconnected,
        ));

        let device_name = self
            .current_device_name
            .lock()
            .unwrap()
            .clone()
            .unwrap_or_default();
        let timeout = Duration::from_secs(self.config.reconnect_timeout_secs);

        tracing::warn!(
            "Device disconnected: {}. Waiting {:?} for reconnection.",
            device_name,
            timeout
        );

        // Poll for device reconnection in a background thread
        let state_ref = Arc::clone(&self.state);
        let event_tx = self.event_tx.clone();

        std::thread::Builder::new()
            .name("device-reconnect".into())
            .spawn(move || {
                if let Some(_device) = device::poll_for_device_reconnect(&device_name, timeout) {
                    // Device reconnected
                    let mut state = state_ref.lock().unwrap();
                    *state = RecordingState::Recording;
                    let _ = event_tx.try_send(RecordingEvent::DeviceReconnected);
                    let _ =
                        event_tx.try_send(RecordingEvent::StateChanged(RecordingState::Recording));
                    tracing::info!("Device reconnected, recording resumed");
                } else {
                    // Timeout -- recording will need to be stopped by the caller
                    let mut state = state_ref.lock().unwrap();
                    *state = RecordingState::Error("Device reconnection timeout".into());
                    let _ = event_tx.try_send(RecordingEvent::DeviceError(
                        "Device reconnection timeout".into(),
                    ));
                    tracing::error!("Device reconnection timed out");
                }
            })
            .ok();
    }

    /// Get the current recording configuration.
    pub fn config(&self) -> &RecordingConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_engine() -> (RecordingEngine, crossbeam_channel::Receiver<RecordingEvent>) {
        let (tx, rx) = crossbeam_channel::unbounded();
        let scheduler = PriorityScheduler::new();
        let engine = RecordingEngine::new(RecordingConfig::default(), tx, scheduler);
        (engine, rx)
    }

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
        let (engine, _rx) = make_engine();
        assert_eq!(engine.status(), RecordingState::Idle);
    }

    #[test]
    fn test_recording_event_serialization() {
        let event = RecordingEvent::LevelUpdate { rms_db: -12.5 };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("levelUpdate") || json.contains("LevelUpdate"));
    }

    #[test]
    fn test_device_name_none_before_recording() {
        let (engine, _rx) = make_engine();
        assert!(engine.device_name().is_none());
    }

    #[test]
    fn test_stop_without_start_errors() {
        let (engine, _rx) = make_engine();
        let result = engine.stop();
        assert!(result.is_err());
    }
}
