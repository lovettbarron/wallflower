use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::AppState;
use wallflower_core::settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    pub watch_folder: String,
    pub storage_dir: String,
    pub duplicate_handling: String,
    pub silence_threshold_db: f32,
    pub export_root: String,
    pub export_format: String,
    pub export_bit_depth: i32,
    pub separation_model: String,
    pub separation_memory_limit_gb: i32,
    pub recording_device_name: Option<String>,
    pub recording_channels: Option<u16>,
    pub recording_channel_map: Option<Vec<u16>>,
}

impl From<&settings::AppConfig> for SettingsResponse {
    fn from(config: &settings::AppConfig) -> Self {
        Self {
            watch_folder: config.watch_folder.to_string_lossy().to_string(),
            storage_dir: config.storage_dir.to_string_lossy().to_string(),
            duplicate_handling: config.duplicate_handling.clone(),
            silence_threshold_db: config.silence_threshold_db,
            export_root: config.export_root.to_string_lossy().to_string(),
            export_format: config.export_format.clone(),
            export_bit_depth: config.export_bit_depth,
            separation_model: config.separation_model.clone(),
            separation_memory_limit_gb: config.separation_memory_limit_gb,
            recording_device_name: config.recording_device_name.clone(),
            recording_channels: config.recording_channels,
            recording_channel_map: config.recording_channel_map.clone(),
        }
    }
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, AppState>) -> Result<SettingsResponse, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(SettingsResponse::from(&*config))
}

#[tauri::command]
pub async fn update_settings(
    state: tauri::State<'_, AppState>,
    settings: serde_json::Value,
) -> Result<SettingsResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut config = state.config.lock().map_err(|e| e.to_string())?;

    // Partial update: only modify fields that are present in the input
    if let Some(v) = settings.get("watchFolder").and_then(|v| v.as_str()) {
        config.watch_folder = PathBuf::from(v);
    }
    if let Some(v) = settings.get("storageDir").and_then(|v| v.as_str()) {
        config.storage_dir = PathBuf::from(v);
    }
    if let Some(v) = settings.get("duplicateHandling").and_then(|v| v.as_str()) {
        config.duplicate_handling = v.to_string();
    }
    if let Some(v) = settings.get("silenceThresholdDb").and_then(|v| v.as_f64()) {
        config.silence_threshold_db = v as f32;
    }
    if let Some(v) = settings.get("exportRoot").and_then(|v| v.as_str()) {
        config.export_root = PathBuf::from(v);
    }
    if let Some(v) = settings.get("exportFormat").and_then(|v| v.as_str()) {
        config.export_format = v.to_string();
    }
    if let Some(v) = settings.get("exportBitDepth").and_then(|v| v.as_i64()) {
        config.export_bit_depth = v as i32;
    }
    if let Some(v) = settings.get("separationModel").and_then(|v| v.as_str()) {
        config.separation_model = v.to_string();
    }
    if let Some(v) = settings.get("separationMemoryLimitGb").and_then(|v| v.as_i64()) {
        config.separation_memory_limit_gb = v as i32;
    }

    // Audio device settings -- allow null to clear
    if let Some(v) = settings.get("recordingDeviceName") {
        config.recording_device_name = v.as_str().map(|s| s.to_string());
    }
    if let Some(v) = settings.get("recordingChannels") {
        config.recording_channels = v.as_u64().map(|n| n as u16);
    }
    if let Some(v) = settings.get("recordingChannelMap") {
        config.recording_channel_map = v
            .as_array()
            .map(|arr| arr.iter().filter_map(|n| n.as_u64().map(|n| n as u16)).collect());
    }

    settings::save_config(&db.conn, &config).map_err(|e| e.to_string())?;

    Ok(SettingsResponse::from(&*config))
}
