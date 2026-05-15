use std::sync::atomic::Ordering;

use serde::Serialize;

use crate::AppState;
use wallflower_core::db;
use wallflower_core::device;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub jam_count: i64,
    pub watcher_active: bool,
    pub watch_folder: String,
}

#[tauri::command]
pub async fn get_status(state: tauri::State<'_, AppState>) -> Result<StatusResponse, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;

    let jams = db::list_jams(&db_guard.conn).map_err(|e| e.to_string())?;

    let watcher_active = state
        .watcher
        .lock()
        .map(|w| w.as_ref().is_some_and(|h| h.is_active()))
        .unwrap_or(false);

    Ok(StatusResponse {
        jam_count: jams.len() as i64,
        watcher_active,
        watch_folder: config.watch_folder.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn get_connected_devices() -> Result<Vec<device::DeviceInfo>, String> {
    Ok(device::detect_devices())
}

#[tauri::command]
pub async fn get_sidecar_status(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(state.sidecar_ready.load(Ordering::Acquire))
}
