use crate::AppState;
use wallflower_core::db;
use wallflower_core::db::schema::JamRecord;
use wallflower_core::db::SearchFilter;

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

#[tauri::command]
pub async fn search_jams(
    state: tauri::State<'_, AppState>,
    filter: SearchFilter,
) -> Result<Vec<JamRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::search_jams(&db.conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_filter_options(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let keys = db::get_distinct_keys(&db.conn).map_err(|e| e.to_string())?;
    let tags = db::list_all_tags(&db.conn).map_err(|e| e.to_string())?;
    let collaborators = db::list_all_collaborators(&db.conn).map_err(|e| e.to_string())?;
    let instruments = db::list_all_instruments(&db.conn).map_err(|e| e.to_string())?;
    let tempo_range = db::get_tempo_range(&db.conn).unwrap_or((60.0, 200.0));
    Ok(serde_json::json!({
        "keys": keys,
        "tags": tags,
        "collaborators": collaborators,
        "instruments": instruments,
        "tempoMin": tempo_range.0,
        "tempoMax": tempo_range.1,
    }))
}
