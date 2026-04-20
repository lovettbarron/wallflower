use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use wallflower_core::db;
use wallflower_core::db::schema::{
    JamCollaborator, JamInstrument, JamPhoto, JamRecord, JamTag,
};
use wallflower_core::peaks::PeakData;

/// Extended jam detail with all metadata attached.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamDetail {
    #[serde(flatten)]
    pub jam: JamRecord,
    pub tags: Vec<JamTag>,
    pub collaborators: Vec<JamCollaborator>,
    pub instruments: Vec<JamInstrument>,
    pub photos: Vec<JamPhoto>,
}

#[tauri::command]
pub async fn get_jam_with_metadata(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<JamDetail>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let jam = match db::get_jam(&db.conn, &id).map_err(|e| e.to_string())? {
        Some(j) => j,
        None => return Ok(None),
    };

    let tags = db::list_tags_for_jam(&db.conn, &id).map_err(|e| e.to_string())?;
    let collaborators =
        db::list_collaborators_for_jam(&db.conn, &id).map_err(|e| e.to_string())?;
    let instruments =
        db::list_instruments_for_jam(&db.conn, &id).map_err(|e| e.to_string())?;
    let photos = db::list_photos_for_jam(&db.conn, &id).map_err(|e| e.to_string())?;

    Ok(Some(JamDetail {
        jam,
        tags,
        collaborators,
        instruments,
        photos,
    }))
}

// ── Tag commands ──────────────────────────────────────────

#[tauri::command]
pub async fn add_tag(
    state: tauri::State<'_, AppState>,
    jam_id: String,
    tag: String,
) -> Result<JamTag, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_tag(&db.conn, &jam_id, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_tag(
    state: tauri::State<'_, AppState>,
    tag_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_tag(&db.conn, &tag_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_tags(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_all_tags(&db.conn).map_err(|e| e.to_string())
}

// ── Collaborator commands ─────────────────────────────────

#[tauri::command]
pub async fn add_collaborator(
    state: tauri::State<'_, AppState>,
    jam_id: String,
    name: String,
) -> Result<JamCollaborator, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_collaborator(&db.conn, &jam_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_collaborator(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_collaborator(&db.conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_collaborators(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_all_collaborators(&db.conn).map_err(|e| e.to_string())
}

// ── Instrument commands ───────────────────────────────────

#[tauri::command]
pub async fn add_instrument(
    state: tauri::State<'_, AppState>,
    jam_id: String,
    name: String,
) -> Result<JamInstrument, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_instrument(&db.conn, &jam_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_instrument(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_instrument(&db.conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_instruments(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_all_instruments(&db.conn).map_err(|e| e.to_string())
}

// ── Metadata update ───────────────────────────────────────

#[tauri::command]
pub async fn update_jam_metadata(
    state: tauri::State<'_, AppState>,
    jam_id: String,
    original_filename: Option<String>,
    location: Option<String>,
    notes: Option<String>,
    patch_notes: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let metadata = wallflower_core::db::schema::JamMetadata {
        original_filename,
        location,
        notes,
        patch_notes,
    };
    db::update_jam_metadata(&db.conn, &jam_id, &metadata).map_err(|e| e.to_string())
}

// ── Photo commands ────────────────────────────────────────

#[tauri::command]
pub async fn attach_photo(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    jam_id: String,
    file_path: String,
) -> Result<JamPhoto, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let source = std::path::Path::new(&file_path);

    // Store the photo file
    let (filename, stored_path) =
        wallflower_core::photos::store_photo(source, &app_data_dir, &jam_id)
            .map_err(|e| e.to_string())?;

    // Generate thumbnail
    let thumbnail_path =
        wallflower_core::photos::generate_thumbnail(source, &app_data_dir, 200)
            .ok();

    // Insert database record
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_photo(
        &db.conn,
        &jam_id,
        &filename,
        &stored_path,
        thumbnail_path.as_deref(),
        "drop",
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_photo(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_photo(&db.conn, &id).map_err(|e| e.to_string())
}

// ── Peaks commands ────────────────────────────────────────

#[tauri::command]
pub async fn get_peaks(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    jam_id: String,
) -> Result<PeakData, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let peaks_dir = app_data_dir.join("peaks");
    let peaks_file = peaks_dir.join(format!("{}.json", jam_id));

    // Check cached peaks first
    if peaks_file.exists() {
        let data = std::fs::read_to_string(&peaks_file).map_err(|e| e.to_string())?;
        let peaks: PeakData =
            serde_json::from_str(&data).map_err(|e| e.to_string())?;
        return Ok(peaks);
    }

    // Generate peaks from audio file
    let file_path = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let jam = db::get_jam(&db.conn, &jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", jam_id))?;
        jam.file_path.clone()
    };

    let audio_path = std::path::Path::new(&file_path);
    let peaks = wallflower_core::peaks::generate_peaks(audio_path, 256)
        .map_err(|e| e.to_string())?;

    // Cache to disk
    std::fs::create_dir_all(&peaks_dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&peaks).map_err(|e| e.to_string())?;
    std::fs::write(&peaks_file, json).map_err(|e| e.to_string())?;

    // Mark in DB
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db::set_peaks_generated(&db.conn, &jam_id, true)
            .map_err(|e| e.to_string())?;
    }

    Ok(peaks)
}

#[tauri::command]
pub async fn generate_peaks_for_jam(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    jam_id: String,
) -> Result<PeakData, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Get file path from DB
    let file_path = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let jam = db::get_jam(&db.conn, &jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", jam_id))?;
        jam.file_path.clone()
    };

    let audio_path = std::path::Path::new(&file_path);
    let peaks = wallflower_core::peaks::generate_peaks(audio_path, 256)
        .map_err(|e| e.to_string())?;

    // Cache to disk (overwrite if exists)
    let peaks_dir = app_data_dir.join("peaks");
    std::fs::create_dir_all(&peaks_dir).map_err(|e| e.to_string())?;
    let peaks_file = peaks_dir.join(format!("{}.json", jam_id));
    let json = serde_json::to_string(&peaks).map_err(|e| e.to_string())?;
    std::fs::write(&peaks_file, json).map_err(|e| e.to_string())?;

    // Mark in DB
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db::set_peaks_generated(&db.conn, &jam_id, true)
            .map_err(|e| e.to_string())?;
    }

    Ok(peaks)
}

// ── Notification command ──────────────────────────────────

#[tauri::command]
pub async fn send_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app_handle
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())
}
