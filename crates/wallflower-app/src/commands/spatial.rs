use tauri::State;
use wallflower_core::db;
use wallflower_core::db::schema::SpatialJam;

use crate::AppState;

/// Get all jams with analysis and metadata for the spatial explorer.
#[tauri::command]
pub fn get_spatial_jams(state: State<'_, AppState>) -> Result<Vec<SpatialJam>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_jams_spatial(&db.conn).map_err(|e| e.to_string())
}
