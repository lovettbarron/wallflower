use serde::Serialize;

use crate::AppState;
use wallflower_core::db;

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

    Ok(StatusResponse {
        jam_count: jams.len() as i64,
        watcher_active: false, // Will be true once watcher is implemented in 01-03
        watch_folder: config.watch_folder.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn get_connected_devices() -> Result<Vec<serde_json::Value>, String> {
    // Stub: device detection will be implemented in plan 01-03
    Ok(vec![])
}
