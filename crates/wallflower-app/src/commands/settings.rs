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
}

impl From<&settings::AppConfig> for SettingsResponse {
    fn from(config: &settings::AppConfig) -> Self {
        Self {
            watch_folder: config.watch_folder.to_string_lossy().to_string(),
            storage_dir: config.storage_dir.to_string_lossy().to_string(),
            duplicate_handling: config.duplicate_handling.clone(),
            silence_threshold_db: config.silence_threshold_db,
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

    settings::save_config(&db.conn, &config).map_err(|e| e.to_string())?;

    Ok(SettingsResponse::from(&*config))
}
