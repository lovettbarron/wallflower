use tauri::command;
use wallflower_core::bookmarks;
use wallflower_core::bookmarks::schema::{BookmarkRecord, CreateBookmark, UpdateBookmark};

use crate::AppState;

/// Create a new bookmark on a jam.
#[command]
pub async fn create_bookmark(
    state: tauri::State<'_, AppState>,
    input: CreateBookmark,
) -> Result<BookmarkRecord, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    bookmarks::create_bookmark(&db.conn, input).map_err(|e| e.to_string())
}

/// Get all bookmarks for a jam, sorted by sort_order then start_seconds.
#[command]
pub async fn get_bookmarks(
    state: tauri::State<'_, AppState>,
    jam_id: String,
) -> Result<Vec<BookmarkRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    bookmarks::get_bookmarks_for_jam(&db.conn, &jam_id).map_err(|e| e.to_string())
}

/// Update a bookmark. If start_seconds or end_seconds changed, invalidate the stem cache.
#[command]
pub async fn update_bookmark(
    state: tauri::State<'_, AppState>,
    id: String,
    input: UpdateBookmark,
) -> Result<BookmarkRecord, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Check if time range changed -- need to invalidate stem cache
    let time_changed = input.start_seconds.is_some() || input.end_seconds.is_some();

    let updated = bookmarks::update_bookmark(&db.conn, &id, input).map_err(|e| e.to_string())?;

    if time_changed {
        // Invalidate cached stems since the audio region changed
        bookmarks::invalidate_stem_cache(&db.conn, &id).map_err(|e| e.to_string())?;
    }

    Ok(updated)
}

/// Delete a bookmark by id. Cascade handles stem_cache and exports cleanup.
#[command]
pub async fn delete_bookmark(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    bookmarks::delete_bookmark(&db.conn, &id).map_err(|e| e.to_string())
}
