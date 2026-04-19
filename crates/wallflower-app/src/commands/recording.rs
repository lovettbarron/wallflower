use serde::Serialize;
use tauri::Emitter;

use crate::AppState;
use wallflower_core::import::hasher;
use wallflower_core::recording::device;
use wallflower_core::recording::RecordingState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingResult {
    pub jam_id: String,
    pub device_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopRecordingResult {
    pub jam_id: String,
    pub file_path: String,
    pub duration_seconds: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStatusResult {
    pub state: String,
    pub device_name: Option<String>,
    pub is_recording: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingLevelResult {
    pub rms_db: f32,
}

/// Start a new recording session.
///
/// Creates a jam record in the database, starts audio capture from the default
/// input device, and emits a "recording-started" Tauri event.
#[tauri::command]
pub async fn start_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<StartRecordingResult, String> {
    let jam_id = uuid::Uuid::new_v4().to_string();
    let filename = format!("{}.wav", jam_id);

    // Get storage dir from config
    let storage_dir = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.storage_dir.clone()
    };

    // Create a placeholder jam record in the database
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.conn
            .execute(
                "INSERT INTO jams (id, filename, original_filename, content_hash, file_path, format,
                                   bit_depth, file_size_bytes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    jam_id,
                    filename,
                    filename,
                    "",  // content_hash computed on stop
                    storage_dir.join(&filename).to_string_lossy().to_string(),
                    "wav",
                    32i32,
                    0i64,
                ],
            )
            .map_err(|e| format!("Failed to create jam record: {}", e))?;
    }

    // Store the jam_id for later use on stop
    {
        let mut current_jam = state
            .current_recording_jam_id
            .lock()
            .map_err(|e| e.to_string())?;
        *current_jam = Some(jam_id.clone());
    }

    // Start the recording engine
    let device_name = {
        let engine = state
            .recording_engine
            .lock()
            .map_err(|e| e.to_string())?;
        engine
            .0
            .start(&storage_dir, &jam_id)
            .map_err(|e| format!("Failed to start recording: {}", e))?;
        engine.0.device_name()
    };

    // Emit Tauri event
    let _ = app.emit(
        "recording-started",
        serde_json::json!({
            "jamId": jam_id,
            "jamName": filename,
            "deviceName": device_name,
        }),
    );

    tracing::info!(
        "Recording started: jam_id={}, device={:?}",
        jam_id,
        device_name
    );

    Ok(StartRecordingResult {
        jam_id,
        device_name,
    })
}

/// Stop the current recording session.
///
/// Finalizes the WAV file, updates the jam record with duration/size/hash,
/// and emits a "recording-stopped" Tauri event.
#[tauri::command]
pub async fn stop_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<StopRecordingResult, String> {
    // Stop the recording engine and get the finalized file path
    let file_path = {
        let engine = state
            .recording_engine
            .lock()
            .map_err(|e| e.to_string())?;
        engine
            .0
            .stop()
            .map_err(|e| format!("Failed to stop recording: {}", e))?
    };

    // Get the jam_id
    let jam_id = {
        let mut current_jam = state
            .current_recording_jam_id
            .lock()
            .map_err(|e| e.to_string())?;
        current_jam
            .take()
            .ok_or_else(|| "No active recording jam ID".to_string())?
    };

    // Compute file metadata
    let file_size_bytes = std::fs::metadata(&file_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    // Read WAV duration using hound
    let (duration_seconds, sample_rate, channels) = match hound::WavReader::open(&file_path) {
        Ok(reader) => {
            let spec = reader.spec();
            let duration = if spec.sample_rate > 0 {
                reader.duration() as f64 / spec.sample_rate as f64
            } else {
                0.0
            };
            (
                duration,
                Some(spec.sample_rate as i32),
                Some(spec.channels as i32),
            )
        }
        Err(e) => {
            tracing::warn!("Failed to read WAV duration: {}", e);
            (0.0, None, None)
        }
    };

    // Compute content hash
    let content_hash = match hasher::compute_sha256(&file_path) {
        Ok(hash) => hash,
        Err(e) => {
            tracing::warn!("Failed to compute content hash: {}", e);
            String::new()
        }
    };

    // Update the jam record in the database
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.conn
            .execute(
                "UPDATE jams SET duration_seconds = ?1, file_size_bytes = ?2,
                 content_hash = ?3, file_path = ?4, sample_rate = ?5, channels = ?6
                 WHERE id = ?7",
                rusqlite::params![
                    duration_seconds,
                    file_size_bytes,
                    content_hash,
                    file_path.to_string_lossy().to_string(),
                    sample_rate,
                    channels,
                    jam_id,
                ],
            )
            .map_err(|e| format!("Failed to update jam record: {}", e))?;
    }

    // Emit Tauri event
    let _ = app.emit(
        "recording-stopped",
        serde_json::json!({
            "jamId": jam_id,
            "filePath": file_path.to_string_lossy(),
            "durationSeconds": duration_seconds,
        }),
    );

    tracing::info!(
        "Recording stopped: jam_id={}, duration={:.1}s, size={}",
        jam_id,
        duration_seconds,
        file_size_bytes
    );

    Ok(StopRecordingResult {
        jam_id,
        file_path: file_path.to_string_lossy().to_string(),
        duration_seconds,
    })
}

/// Get the current recording status.
#[tauri::command]
pub async fn get_recording_status(
    state: tauri::State<'_, AppState>,
) -> Result<RecordingStatusResult, String> {
    let engine = state
        .recording_engine
        .lock()
        .map_err(|e| e.to_string())?;
    let status = engine.0.status();
    let device_name = engine.0.device_name();
    let is_recording = matches!(status, RecordingState::Recording);

    let state_str = match &status {
        RecordingState::Idle => "idle",
        RecordingState::Recording => "recording",
        RecordingState::Paused => "paused",
        RecordingState::DeviceDisconnected => "deviceDisconnected",
        RecordingState::Error(_) => "error",
    };

    Ok(RecordingStatusResult {
        state: state_str.to_string(),
        device_name,
        is_recording,
    })
}

/// List all available audio input devices.
#[tauri::command]
pub async fn list_audio_devices() -> Result<Vec<device::InputDeviceInfo>, String> {
    Ok(device::list_input_devices())
}

/// Get the current recording level (RMS dB) from the shared atomic value.
///
/// The event bridge thread continuously updates the latest RMS value.
/// Silence events are delivered via Tauri events.
#[tauri::command]
pub async fn get_recording_level(
    state: tauri::State<'_, AppState>,
) -> Result<RecordingLevelResult, String> {
    let rms_raw = state
        .latest_rms_db
        .load(std::sync::atomic::Ordering::Relaxed);
    let rms_db = rms_raw as f32 / 100.0;

    Ok(RecordingLevelResult { rms_db })
}

/// Scan storage directory for WAV files not in the database (crash recovery).
///
/// Returns a list of (jam_id, duration_seconds) for each recovered recording.
pub fn recover_crashed_recordings(
    storage_dir: &std::path::Path,
    db_conn: &rusqlite::Connection,
) -> Vec<(String, f64)> {
    let mut recovered = Vec::new();

    let entries = match std::fs::read_dir(storage_dir) {
        Ok(entries) => entries,
        Err(e) => {
            tracing::warn!("Failed to scan storage dir for crash recovery: {}", e);
            return recovered;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("wav") {
            continue;
        }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // Check if this file is already in the database
        let exists = db_conn
            .query_row(
                "SELECT COUNT(*) FROM jams WHERE filename = ?1",
                rusqlite::params![filename],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or(0)
            > 0;

        if exists {
            continue;
        }

        // Try to read the WAV file
        let (duration_seconds, sample_rate, channels) = match hound::WavReader::open(&path) {
            Ok(reader) => {
                let spec = reader.spec();
                let duration = if spec.sample_rate > 0 {
                    reader.duration() as f64 / spec.sample_rate as f64
                } else {
                    0.0
                };
                (
                    duration,
                    Some(spec.sample_rate as i32),
                    Some(spec.channels as i32),
                )
            }
            Err(e) => {
                tracing::warn!("Failed to read recovered WAV {}: {}", filename, e);
                continue;
            }
        };

        // Compute content hash
        let content_hash = hasher::compute_sha256(&path).unwrap_or_default();

        // Get file size
        let file_size_bytes = std::fs::metadata(&path)
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        // Insert as a recovered jam
        let jam_id = uuid::Uuid::new_v4().to_string();
        let result = db_conn.execute(
            "INSERT INTO jams (id, filename, original_filename, content_hash, file_path, format,
                               duration_seconds, sample_rate, bit_depth, channels, file_size_bytes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                jam_id,
                filename,
                filename,
                content_hash,
                path.to_string_lossy().to_string(),
                "wav",
                duration_seconds,
                sample_rate,
                32i32,
                channels,
                file_size_bytes,
            ],
        );

        match result {
            Ok(_) => {
                tracing::info!(
                    "Recovered crashed recording: {} ({:.1}s)",
                    filename,
                    duration_seconds
                );
                recovered.push((jam_id, duration_seconds));
            }
            Err(e) => {
                tracing::warn!("Failed to insert recovered recording {}: {}", filename, e);
            }
        }
    }

    recovered
}
