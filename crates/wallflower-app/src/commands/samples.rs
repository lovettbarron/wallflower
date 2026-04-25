use crate::AppState;
use wallflower_core::db;
use wallflower_core::db::schema::{SampleFilter, SampleFilterOptions, SampleRecord};

#[tauri::command]
pub async fn get_all_samples(
    state: tauri::State<'_, AppState>,
    filter: SampleFilter,
) -> Result<Vec<SampleRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_samples(&db.conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sample_filter_options(
    state: tauri::State<'_, AppState>,
) -> Result<SampleFilterOptions, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_sample_filter_options(&db.conn).map_err(|e| e.to_string())
}
