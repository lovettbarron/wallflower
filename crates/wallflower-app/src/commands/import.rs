use std::path::PathBuf;

use tauri_plugin_notification::NotificationExt;

use crate::AppState;
use wallflower_core::import;
use wallflower_core::import::ImportResult;

/// Send a native macOS notification for import completion.
fn notify_import_complete(app: &tauri::AppHandle, results: &[ImportResult]) {
    let successful_filenames: Vec<&str> = results
        .iter()
        .filter_map(|r| match r {
            ImportResult::Imported { filename, .. } => Some(filename.as_str()),
            _ => None,
        })
        .collect();

    if successful_filenames.is_empty() {
        return;
    }

    let body = if successful_filenames.len() == 1 {
        format!("{} added to your library", successful_filenames[0])
    } else {
        format!("{} files added to your library", successful_filenames.len())
    };

    let _ = app
        .notification()
        .builder()
        .title("Import Complete")
        .body(&body)
        .show();
}

#[tauri::command]
pub async fn import_files(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> Result<Vec<ImportResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    let results = import::import_files(&db.conn, &config.storage_dir, path_bufs);
    notify_import_complete(&app, &results);
    Ok(results)
}

#[tauri::command]
pub async fn import_directory(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<ImportResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let exclude_dirs = vec![config.export_root.clone(), config.storage_dir.clone()];
    let results = import::import_directory(&db.conn, &config.storage_dir, &PathBuf::from(path), &exclude_dirs)
        .map_err(|e| e.to_string())?;
    notify_import_complete(&app, &results);
    Ok(results)
}

#[tauri::command]
pub async fn import_from_device(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    mount_point: String,
    files: Vec<String>,
) -> Result<Vec<ImportResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let mount = PathBuf::from(&mount_point);
    let path_bufs: Vec<PathBuf> = files.into_iter().map(|f| mount.join(f)).collect();
    let results = import::import_files(&db.conn, &config.storage_dir, path_bufs);
    notify_import_complete(&app, &results);
    Ok(results)
}
