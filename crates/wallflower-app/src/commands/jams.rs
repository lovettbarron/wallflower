use crate::AppState;
use wallflower_core::db;
use wallflower_core::db::schema::JamRecord;
use wallflower_core::db::SearchFilter;
use wallflower_core::bookmarks;
use tracing::warn;

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
pub async fn delete_jam(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    // Collect bookmark IDs before DB delete (cascade will remove them)
    let (jam, bookmark_ids, storage_dir) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let bm = bookmarks::get_bookmarks_for_jam(&db.conn, &id)
            .map_err(|e| e.to_string())?;
        let bm_ids: Vec<String> = bm.into_iter().map(|b| b.id).collect();

        // Delete from DB (cascades child tables, manually cleans FTS5)
        let jam = db::delete_jam(&db.conn, &id).map_err(|e| e.to_string())?;

        let config = state.config.lock().map_err(|e| e.to_string())?;
        let sd = config.storage_dir.clone();
        (jam, bm_ids, sd)
    };
    // DB lock released -- now clean up files (best-effort)

    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("wallflower");

    // 1. Delete audio file
    let audio_path = storage_dir.join(&jam.filename);
    if audio_path.exists() {
        if let Err(e) = std::fs::remove_file(&audio_path) {
            warn!("Failed to remove audio file {}: {}", audio_path.display(), e);
        }
    }

    // 2. Delete peaks cache
    let peaks_path = data_dir.join("peaks").join(format!("{}.json", id));
    if peaks_path.exists() {
        if let Err(e) = std::fs::remove_file(&peaks_path) {
            warn!("Failed to remove peaks cache {}: {}", peaks_path.display(), e);
        }
    }

    // 3. Delete photos (files matching {id}_* in photos dir)
    let photos_dir = data_dir.join("photos");
    if photos_dir.exists() {
        let prefix = format!("{}_", id);
        if let Ok(entries) = std::fs::read_dir(&photos_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.starts_with(&prefix) {
                        if let Err(e) = std::fs::remove_file(entry.path()) {
                            warn!("Failed to remove photo {}: {}", entry.path().display(), e);
                        }
                    }
                }
            }
        }
    }

    // 4. Delete stem cache directories for each bookmark
    let stem_cache_dir = data_dir.join("stem_cache");
    for bm_id in &bookmark_ids {
        let bm_dir = stem_cache_dir.join(bm_id);
        if bm_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&bm_dir) {
                warn!("Failed to remove stem cache {}: {}", bm_dir.display(), e);
            }
        }
    }

    Ok(())
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
