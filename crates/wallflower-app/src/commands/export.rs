use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter};
use tokio_stream::StreamExt;

use crate::sidecar::grpc_client;
use crate::AppState;
use wallflower_core::bookmarks;
use wallflower_core::export;

/// Information about a separated stem file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemInfo {
    pub stem_name: String,
    pub file_path: String,
    pub file_size_bytes: i64,
}

/// Check if cached stems exist and are valid for the given bookmark and model.
pub fn should_use_cache(
    cache_entries: &[wallflower_core::bookmarks::schema::StemCacheRecord],
    model_name: &str,
) -> bool {
    if cache_entries.is_empty() {
        return false;
    }
    // All entries must match the requested model and have existing files
    cache_entries.iter().all(|entry| {
        entry.model_name == model_name && Path::new(&entry.file_path).exists()
    })
}

/// Export a bookmark as a time-sliced audio file with JSON sidecar metadata.
#[command]
pub async fn export_audio(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    bookmark_id: String,
) -> Result<String, String> {
    // Fetch bookmark
    let (bookmark, jam, export_root, format_ext, bit_depth) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let bookmark = bookmarks::get_bookmark(&db.conn, &bookmark_id)
            .map_err(|e| e.to_string())?;
        let jam = wallflower_core::db::get_jam(&db.conn, &bookmark.jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", bookmark.jam_id))?;

        // Get export settings
        let export_root = wallflower_core::db::get_setting(&db.conn, "export_dir")
            .ok()
            .flatten()
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("wallflower")
                    .join("exports")
                    .to_string_lossy()
                    .to_string()
            });
        let format_ext = wallflower_core::db::get_setting(&db.conn, "export_format")
            .ok()
            .flatten()
            .unwrap_or_else(|| "wav".to_string());
        let bit_depth: u32 = wallflower_core::db::get_setting(&db.conn, "export_bit_depth")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(24);

        (bookmark, jam, PathBuf::from(export_root), format_ext, bit_depth)
    };

    let jam_name = &jam.original_filename;
    let source_path = Path::new(&jam.file_path);

    // Resolve export path with collision avoidance
    let dest_path = export::sanitize::resolve_export_path(
        &export_root,
        jam_name,
        &bookmark.name,
        &format_ext,
    );

    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Export the time slice
    let export_result = export::writer::export_time_slice(
        source_path,
        &dest_path,
        bookmark.start_seconds,
        bookmark.end_seconds,
        bit_depth,
    )
    .map_err(|e| e.to_string())?;

    // Generate JSON sidecar
    let sidecar_path = dest_path.with_extension("json");

    // Fetch analysis results for the jam
    let (tags, collaborators, instruments, key_str, bpm) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let analysis = wallflower_core::db::get_jam_analysis_results(&db.conn, &jam.id)
            .map_err(|e| e.to_string())?;

        let key_str = analysis
            .key
            .as_ref()
            .map(|k| format!("{} {}", k.key_name, k.scale));
        let bpm = analysis.tempo.as_ref().map(|t| t.bpm);

        // Get metadata
        let tags: Vec<String> = wallflower_core::db::list_tags_for_jam(&db.conn, &jam.id)
            .unwrap_or_default()
            .into_iter()
            .map(|t| t.tag)
            .collect();
        let collaborators: Vec<String> = wallflower_core::db::list_collaborators_for_jam(&db.conn, &jam.id)
            .unwrap_or_default()
            .into_iter()
            .map(|c| c.name)
            .collect();
        let instruments: Vec<String> = wallflower_core::db::list_instruments_for_jam(&db.conn, &jam.id)
            .unwrap_or_default()
            .into_iter()
            .map(|i| i.name)
            .collect();

        (tags, collaborators, instruments, key_str, bpm)
    };

    let sidecar_data = export::sidecar::ExportSidecar {
        wallflower_version: "0.1.0".to_string(),
        source_jam: export::sidecar::SourceJamInfo {
            name: jam_name.clone(),
            id: jam.id.clone(),
            duration_seconds: jam.duration_seconds.unwrap_or(0.0),
            recorded_at: jam.created_at.clone(),
        },
        bookmark: export::sidecar::BookmarkInfo {
            name: bookmark.name.clone(),
            start_seconds: bookmark.start_seconds,
            end_seconds: bookmark.end_seconds,
            notes: bookmark.notes.clone(),
        },
        analysis: export::sidecar::AnalysisInfo {
            key: key_str,
            bpm,
            tags,
            collaborators,
            instruments,
        },
        export: export::sidecar::ExportInfo {
            format: export_result.format.clone(),
            bit_depth: export_result.bit_depth as i32,
            sample_rate: export_result.sample_rate,
            channels: export_result.channels,
            stems: None,
            model: None,
            exported_at: chrono_now(),
        },
    };

    export::sidecar::generate_sidecar(&sidecar_data, &sidecar_path)
        .map_err(|e| e.to_string())?;

    // Record in exports table
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        bookmarks::create_export_record(
            &db.conn,
            &bookmark_id,
            "audio",
            &export_result.path,
            &export_result.format,
            export_result.bit_depth as i32,
            None,
            Some(&sidecar_path.to_string_lossy()),
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit export-complete event
    let _ = app.emit(
        "export-complete",
        serde_json::json!({
            "bookmarkId": bookmark_id,
            "path": export_result.path,
        }),
    );

    Ok(export_result.path)
}

/// Separate stems for a bookmark using the gRPC sidecar.
/// Streams progress via Tauri events. Respects PriorityScheduler for recording priority.
/// Uses stem cache: if cached stems exist for this bookmark+model, returns them immediately.
/// Computes segment_seconds from memory_limit via calculate_segment_seconds (D-15).
#[command]
pub async fn separate_stems(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    bookmark_id: String,
) -> Result<Vec<StemInfo>, String> {
    // Fetch bookmark and jam
    let (bookmark, jam, model_name, memory_limit_gb) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let bookmark = bookmarks::get_bookmark(&db.conn, &bookmark_id)
            .map_err(|e| e.to_string())?;
        let jam = wallflower_core::db::get_jam(&db.conn, &bookmark.jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", bookmark.jam_id))?;

        let model_name = wallflower_core::db::get_setting(&db.conn, "separation_model")
            .ok()
            .flatten()
            .unwrap_or_else(|| "htdemucs".to_string());
        let memory_limit_gb: f64 = wallflower_core::db::get_setting(&db.conn, "separation_memory_limit_gb")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(4.0);

        (bookmark, jam, model_name, memory_limit_gb)
    };

    // Check stem cache
    let cached_stems = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        bookmarks::get_stem_cache(&db.conn, &bookmark_id, &model_name)
            .map_err(|e| e.to_string())?
    };

    if should_use_cache(&cached_stems, &model_name) {
        return Ok(cached_stems
            .into_iter()
            .map(|s| StemInfo {
                stem_name: s.stem_name,
                file_path: s.file_path,
                file_size_bytes: s.file_size_bytes,
            })
            .collect());
    }

    // Compute chunk size from memory limit (D-15)
    let sample_rate = jam.sample_rate.unwrap_or(44100) as u32;
    let channels = jam.channels.unwrap_or(2) as u16;
    let memory_limit_bytes = (memory_limit_gb * 1024.0 * 1024.0 * 1024.0) as u64;
    let segment_seconds =
        export::calculate_segment_seconds(memory_limit_bytes, &model_name, sample_rate, channels);

    // Determine output directory for stem cache
    let stem_cache_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("wallflower")
        .join("stem_cache")
        .join(&bookmark_id);
    std::fs::create_dir_all(&stem_cache_dir).map_err(|e| e.to_string())?;

    // Ensure sidecar is running
    let port = {
        let mut sidecar = state.sidecar.lock().await;
        sidecar.ensure_running().await.map_err(|e| e.to_string())?
    };

    // Check recording priority before starting
    if !state.scheduler.may_proceed() {
        return Err("Recording in progress -- separation deferred".to_string());
    }

    // Store cancellation flag in AppState-accessible location
    let cancel_flag = state
        .separation_cancel
        .clone();
    cancel_flag.store(false, Ordering::Release);

    // Call gRPC SeparateStems
    let mut stream = grpc_client::separate_stems(
        port,
        &bookmark_id,
        &jam.file_path,
        bookmark.start_seconds as f32,
        bookmark.end_seconds as f32,
        &model_name,
        segment_seconds as f32,
        0.25, // default overlap
        &stem_cache_dir.to_string_lossy(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut final_stems: Vec<StemInfo> = Vec::new();

    while let Some(progress) = stream.next().await {
        // Check cancellation
        if cancel_flag.load(Ordering::Acquire) {
            let _ = app.emit(
                "separation-progress",
                serde_json::json!({
                    "bookmarkId": bookmark_id,
                    "status": "cancelled",
                    "currentChunk": 0,
                    "totalChunks": 0,
                    "percentComplete": 0.0,
                    "estimatedSecondsRemaining": 0.0,
                }),
            );
            return Err("Separation cancelled".to_string());
        }

        match progress {
            Ok(p) => {
                let status_str = match p.status {
                    0 => "separating",
                    1 => "chunk_complete",
                    2 => "completed",
                    3 => "failed",
                    4 => "cancelled",
                    5 => "paused",
                    _ => "unknown",
                };

                // Emit progress event
                let _ = app.emit(
                    "separation-progress",
                    serde_json::json!({
                        "bookmarkId": p.bookmark_id,
                        "status": status_str,
                        "currentChunk": p.current_chunk,
                        "totalChunks": p.total_chunks,
                        "percentComplete": p.percent_complete,
                        "estimatedSecondsRemaining": p.estimated_seconds_remaining,
                    }),
                );

                // Handle failure
                if p.status == 3 {
                    // SEPARATION_FAILED
                    return Err(format!("Separation failed: {}", p.error_message));
                }

                // Handle completion -- save stems to cache
                if p.status == 2 {
                    // SEPARATION_COMPLETED
                    for stem_file in &p.stem_files {
                        final_stems.push(StemInfo {
                            stem_name: stem_file.stem_name.clone(),
                            file_path: stem_file.file_path.clone(),
                            file_size_bytes: stem_file.file_size_bytes,
                        });
                    }
                }

                // Between chunks, check scheduler for recording priority
                if p.status == 1 {
                    // CHUNK_COMPLETE
                    while !state.scheduler.may_proceed() {
                        let _ = app.emit(
                            "separation-progress",
                            serde_json::json!({
                                "bookmarkId": bookmark_id,
                                "status": "paused",
                                "currentChunk": p.current_chunk,
                                "totalChunks": p.total_chunks,
                                "percentComplete": p.percent_complete,
                                "estimatedSecondsRemaining": p.estimated_seconds_remaining,
                            }),
                        );
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    }
                }
            }
            Err(e) => {
                tracing::error!("gRPC separation stream error: {}", e);
                return Err(format!("Separation stream error: {}", e));
            }
        }
    }

    // Save stems to cache in DB
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        for stem in &final_stems {
            bookmarks::save_stem_cache(
                &db.conn,
                &bookmark_id,
                &model_name,
                &stem.stem_name,
                &stem.file_path,
                stem.file_size_bytes,
                None,
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Reset sidecar restart count on success
    {
        let mut sidecar = state.sidecar.lock().await;
        sidecar.reset_restart_count();
    }

    Ok(final_stems)
}

/// Export cached stems for a bookmark to the export directory.
#[command]
pub async fn export_stems(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    bookmark_id: String,
    stem_names: Vec<String>,
) -> Result<String, String> {
    let (bookmark, jam, model_name, export_root) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let bookmark = bookmarks::get_bookmark(&db.conn, &bookmark_id)
            .map_err(|e| e.to_string())?;
        let jam = wallflower_core::db::get_jam(&db.conn, &bookmark.jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", bookmark.jam_id))?;

        let model_name = wallflower_core::db::get_setting(&db.conn, "separation_model")
            .ok()
            .flatten()
            .unwrap_or_else(|| "htdemucs".to_string());
        let export_root = wallflower_core::db::get_setting(&db.conn, "export_dir")
            .ok()
            .flatten()
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("wallflower")
                    .join("exports")
                    .to_string_lossy()
                    .to_string()
            });

        (bookmark, jam, model_name, PathBuf::from(export_root))
    };

    // Fetch cached stems
    let cached_stems = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        bookmarks::get_stem_cache(&db.conn, &bookmark_id, &model_name)
            .map_err(|e| e.to_string())?
    };

    if cached_stems.is_empty() {
        return Err("No cached stems found. Run separation first.".to_string());
    }

    // Resolve stems export directory
    let stems_dir = export::sanitize::resolve_stems_dir(
        &export_root,
        &jam.original_filename,
        &bookmark.name,
    );
    std::fs::create_dir_all(&stems_dir).map_err(|e| e.to_string())?;

    // Copy requested stems to export dir
    let mut exported_stem_names = Vec::new();
    for stem in &cached_stems {
        if stem_names.contains(&stem.stem_name) {
            let source = Path::new(&stem.file_path);
            let dest = stems_dir.join(format!("{}.wav", &stem.stem_name));
            std::fs::copy(source, &dest).map_err(|e| {
                format!("Failed to copy stem {}: {}", stem.stem_name, e)
            })?;
            exported_stem_names.push(stem.stem_name.clone());
        }
    }

    // Generate JSON sidecar for stems export
    let sidecar_path = stems_dir.join("stems.json");

    // Fetch analysis and metadata
    let (tags, collaborators, instruments, key_str, bpm) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let analysis = wallflower_core::db::get_jam_analysis_results(&db.conn, &jam.id)
            .map_err(|e| e.to_string())?;

        let key_str = analysis
            .key
            .as_ref()
            .map(|k| format!("{} {}", k.key_name, k.scale));
        let bpm = analysis.tempo.as_ref().map(|t| t.bpm);

        let tags: Vec<String> = wallflower_core::db::list_tags_for_jam(&db.conn, &jam.id)
            .unwrap_or_default()
            .into_iter()
            .map(|t| t.tag)
            .collect();
        let collaborators: Vec<String> =
            wallflower_core::db::list_collaborators_for_jam(&db.conn, &jam.id)
                .unwrap_or_default()
                .into_iter()
                .map(|c| c.name)
                .collect();
        let instruments: Vec<String> =
            wallflower_core::db::list_instruments_for_jam(&db.conn, &jam.id)
                .unwrap_or_default()
                .into_iter()
                .map(|i| i.name)
                .collect();

        (tags, collaborators, instruments, key_str, bpm)
    };

    let sidecar_data = export::sidecar::ExportSidecar {
        wallflower_version: "0.1.0".to_string(),
        source_jam: export::sidecar::SourceJamInfo {
            name: jam.original_filename.clone(),
            id: jam.id.clone(),
            duration_seconds: jam.duration_seconds.unwrap_or(0.0),
            recorded_at: jam.created_at.clone(),
        },
        bookmark: export::sidecar::BookmarkInfo {
            name: bookmark.name.clone(),
            start_seconds: bookmark.start_seconds,
            end_seconds: bookmark.end_seconds,
            notes: bookmark.notes.clone(),
        },
        analysis: export::sidecar::AnalysisInfo {
            key: key_str,
            bpm,
            tags,
            collaborators,
            instruments,
        },
        export: export::sidecar::ExportInfo {
            format: "wav".to_string(),
            bit_depth: 24,
            sample_rate: jam.sample_rate.unwrap_or(44100) as u32,
            channels: jam.channels.unwrap_or(2) as u16,
            stems: Some(exported_stem_names),
            model: Some(model_name.clone()),
            exported_at: chrono_now(),
        },
    };

    export::sidecar::generate_sidecar(&sidecar_data, &sidecar_path)
        .map_err(|e| e.to_string())?;

    // Record in exports table
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        bookmarks::create_export_record(
            &db.conn,
            &bookmark_id,
            "stems",
            &stems_dir.to_string_lossy(),
            "wav",
            24,
            Some(&model_name),
            Some(&sidecar_path.to_string_lossy()),
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit export-complete event
    let _ = app.emit(
        "export-complete",
        serde_json::json!({
            "bookmarkId": bookmark_id,
            "path": stems_dir.to_string_lossy(),
        }),
    );

    Ok(stems_dir.to_string_lossy().to_string())
}

/// Cancel an in-progress stem separation.
#[command]
pub async fn cancel_separation(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.separation_cancel.store(true, Ordering::Release);
    Ok(())
}

/// Get current timestamp as ISO 8601 string.
fn chrono_now() -> String {
    // Use std::time to avoid adding chrono dependency
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}Z", now)
}
