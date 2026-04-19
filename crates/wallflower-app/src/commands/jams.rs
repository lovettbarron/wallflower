use crate::AppState;
use wallflower_core::db;
use wallflower_core::db::schema::JamRecord;

#[tauri::command]
pub async fn list_jams(state: tauri::State<'_, AppState>) -> Result<Vec<JamRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_jams(&db.conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_jam(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<JamRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_jam(&db.conn, &id).map_err(|e| e.to_string())
}
