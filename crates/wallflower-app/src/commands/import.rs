use std::path::PathBuf;

use crate::AppState;
use wallflower_core::import;
use wallflower_core::import::ImportResult;

#[tauri::command]
pub async fn import_files(
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> Result<Vec<ImportResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    Ok(import::import_files(&db.conn, &config.storage_dir, path_bufs))
}

#[tauri::command]
pub async fn import_directory(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<ImportResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    import::import_directory(&db.conn, &config.storage_dir, &PathBuf::from(path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_from_device(
    state: tauri::State<'_, AppState>,
    mount_point: String,
    files: Vec<String>,
) -> Result<Vec<ImportResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let mount = PathBuf::from(&mount_point);
    let path_bufs: Vec<PathBuf> = files.into_iter().map(|f| mount.join(f)).collect();
    Ok(import::import_files(&db.conn, &config.storage_dir, path_bufs))
}
