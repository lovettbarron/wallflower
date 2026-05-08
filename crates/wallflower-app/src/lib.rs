mod api;
mod commands;
mod sidecar;
mod tray;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI32};
use std::sync::{Arc, Mutex};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use wallflower_core::db::Database;
use wallflower_core::recording::scheduler::PriorityScheduler;
use wallflower_core::recording::{RecordingConfig, RecordingEngine, RecordingEvent, RecordingState};
use wallflower_core::settings::{self, AppConfig};
use wallflower_core::watcher::WatcherHandle;

/// Wrapper to make RecordingEngine Send + Sync.
///
/// cpal::Stream deliberately opts out of Send/Sync, but our RecordingEngine
/// already wraps it in Arc<Mutex<Option<Stream>>> and only accesses it
/// through the Mutex, which provides thread safety. The Tauri managed state
/// requires Send + Sync.
pub struct SendableRecordingEngine(pub RecordingEngine);

// SAFETY: RecordingEngine internally uses Arc<Mutex<..>> for all shared state
// including the cpal::Stream. Access is synchronized through the Mutex in AppState.
unsafe impl Send for SendableRecordingEngine {}
unsafe impl Sync for SendableRecordingEngine {}

pub struct AppState {
    pub db: Mutex<Database>,
    pub config: Mutex<AppConfig>,
    pub watcher: Mutex<Option<WatcherHandle>>,
    pub recording_engine: Mutex<SendableRecordingEngine>,
    pub latest_rms_db: Arc<AtomicI32>,
    pub scheduler: PriorityScheduler,
    pub current_recording_jam_id: Mutex<Option<String>>,
    pub sidecar: tokio::sync::Mutex<sidecar::SidecarManager>,
    pub separation_cancel: Arc<AtomicBool>,
}

/// Send a native macOS notification via the Tauri notification plugin.
fn notify(app: &tauri::AppHandle, title: &str, body: &str) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

/// Parse a shortcut string like "Cmd+Shift+R" into a `Shortcut`.
fn parse_shortcut(s: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    if parts.is_empty() {
        return None;
    }

    let mut mods = Modifiers::empty();
    let key_str = parts.last()?;

    for part in &parts[..parts.len() - 1] {
        match part.to_lowercase().as_str() {
            "cmd" | "meta" | "command" | "super" => mods |= Modifiers::META,
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift" => mods |= Modifiers::SHIFT,
            "alt" | "option" | "opt" => mods |= Modifiers::ALT,
            _ => return None,
        }
    }

    let code = match key_str.to_uppercase().as_str() {
        "A" => Code::KeyA, "B" => Code::KeyB, "C" => Code::KeyC, "D" => Code::KeyD,
        "E" => Code::KeyE, "F" => Code::KeyF, "G" => Code::KeyG, "H" => Code::KeyH,
        "I" => Code::KeyI, "J" => Code::KeyJ, "K" => Code::KeyK, "L" => Code::KeyL,
        "M" => Code::KeyM, "N" => Code::KeyN, "O" => Code::KeyO, "P" => Code::KeyP,
        "Q" => Code::KeyQ, "R" => Code::KeyR, "S" => Code::KeyS, "T" => Code::KeyT,
        "U" => Code::KeyU, "V" => Code::KeyV, "W" => Code::KeyW, "X" => Code::KeyX,
        "Y" => Code::KeyY, "Z" => Code::KeyZ,
        "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2, "3" => Code::Digit3,
        "4" => Code::Digit4, "5" => Code::Digit5, "6" => Code::Digit6, "7" => Code::Digit7,
        "8" => Code::Digit8, "9" => Code::Digit9,
        "F1" => Code::F1, "F2" => Code::F2, "F3" => Code::F3, "F4" => Code::F4,
        "F5" => Code::F5, "F6" => Code::F6, "F7" => Code::F7, "F8" => Code::F8,
        "F9" => Code::F9, "F10" => Code::F10, "F11" => Code::F11, "F12" => Code::F12,
        _ => return None,
    };

    let mods_opt = if mods.is_empty() { None } else { Some(mods) };
    Some(Shortcut::new(mods_opt, code))
}

/// Handle a global recording shortcut press.
fn handle_record_shortcut(app: &tauri::AppHandle) {
    let state: tauri::State<'_, AppState> = app.state();
    let status = {
        let engine = state.recording_engine.lock().unwrap();
        engine.0.status()
    };
    match status {
        RecordingState::Idle => {
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let state: tauri::State<'_, AppState> = handle.state();
                match commands::recording::start_recording(handle.clone(), state).await {
                    Ok(result) => {
                        tracing::info!(
                            "Global shortcut: recording started (jam {})",
                            result.jam_id
                        );
                        let device_desc =
                            result.device_name.as_deref().unwrap_or("default device");
                        notify(
                            &handle,
                            "Recording Started",
                            &format!("Wallflower is now recording from {}.", device_desc),
                        );
                    }
                    Err(e) => {
                        tracing::error!("Global shortcut: failed to start recording: {}", e);
                    }
                }
            });
        }
        RecordingState::Recording => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = app.emit("show-stop-dialog", ());
        }
        _ => {}
    }
}

/// Register the global recording shortcut from a shortcut string.
fn register_record_shortcut(app: &tauri::AppHandle, shortcut_str: &str) -> Result<(), String> {
    let shortcut = parse_shortcut(shortcut_str)
        .ok_or_else(|| format!("Invalid shortcut: {}", shortcut_str))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app_handle, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                handle_record_shortcut(app_handle);
            }
        })
        .map_err(|e| e.to_string())
}

/// Check if a file extension is an image type we care about for patch photos.
fn is_image_extension(path: &std::path::Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic"
    )
}

/// Start a background watcher on ~/wallflower/patches/ that auto-attaches new
/// photos to the most recent jam. Fires native notifications and Tauri events.
fn start_patches_watcher(app: tauri::AppHandle) {
    let patches_dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("wallflower")
        .join("patches");

    // Ensure the patches directory exists
    if let Err(e) = std::fs::create_dir_all(&patches_dir) {
        tracing::warn!("Failed to create patches directory: {e}");
        return;
    }

    let patches_dir_clone = patches_dir.clone();

    // Spawn a thread for the synchronous notify watcher, bridging to tokio via a channel
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel::<PathBuf>();

        let mut watcher: RecommendedWatcher =
            match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Create(_)) {
                        for path in event.paths {
                            if is_image_extension(&path) {
                                let _ = tx.send(path);
                            }
                        }
                    }
                }
            }) {
                Ok(w) => w,
                Err(e) => {
                    tracing::warn!("Failed to create patches watcher: {e}");
                    return;
                }
            };

        if let Err(e) = watcher.watch(&patches_dir_clone, RecursiveMode::NonRecursive) {
            tracing::warn!("Failed to watch patches directory: {e}");
            return;
        }

        tracing::info!(
            "Watching {} for new patch photos",
            patches_dir_clone.display()
        );

        // Process incoming photo files
        loop {
            match rx.recv() {
                Ok(photo_path) => {
                    tracing::info!("New patch photo detected: {}", photo_path.display());

                    // Open a fresh DB connection to look up the most recent jam
                    let db_path = Database::default_path();
                    let db = match Database::open(&db_path) {
                        Ok(db) => db,
                        Err(e) => {
                            tracing::error!("Failed to open DB for patches watcher: {e}");
                            continue;
                        }
                    };

                    match wallflower_core::db::get_most_recent_jam(&db.conn) {
                        Ok(Some(jam)) => {
                            let jam_name = jam.original_filename.clone();

                            // Copy photo to app data directory
                            let data_dir = dirs::data_dir()
                                .unwrap_or_else(|| PathBuf::from("."))
                                .join("wallflower")
                                .join("photos");
                            let _ = std::fs::create_dir_all(&data_dir);

                            let photo_filename = format!(
                                "{}_{}",
                                jam.id,
                                photo_path
                                    .file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                            );
                            let dest = data_dir.join(&photo_filename);

                            if let Err(e) = std::fs::copy(&photo_path, &dest) {
                                tracing::error!("Failed to copy patch photo: {e}");
                                continue;
                            }

                            tracing::info!(
                                "Patch photo attached to jam '{}' ({})",
                                jam_name,
                                jam.id
                            );

                            // Send native notification
                            notify(
                                &app,
                                "Patch Photo Attached",
                                &format!("New photo linked to {}", jam_name),
                            );

                            // Emit Tauri event for frontend to refresh
                            let _ = app.emit(
                                "photo-auto-attached",
                                serde_json::json!({
                                    "jamId": jam.id,
                                    "jamName": jam_name,
                                }),
                            );
                        }
                        Ok(None) => {
                            tracing::info!("No jams in library, skipping patch photo auto-attach");
                        }
                        Err(e) => {
                            tracing::error!("Failed to query most recent jam: {e}");
                        }
                    }
                }
                Err(_) => {
                    // Channel closed, watcher was dropped
                    tracing::info!("Patches watcher channel closed");
                    break;
                }
            }
        }
    });
}

/// Start the recording event bridge thread.
///
/// Reads events from the recording engine channel and emits them as Tauri events.
/// Also updates the shared RMS value and tray icon state.
fn start_recording_event_bridge(
    app_handle: tauri::AppHandle,
    event_rx: crossbeam_channel::Receiver<RecordingEvent>,
    latest_rms: Arc<AtomicI32>,
) {
    std::thread::Builder::new()
        .name("recording-event-bridge".into())
        .spawn(move || {
            let mut last_level_emit = std::time::Instant::now();
            let level_throttle = std::time::Duration::from_millis(67); // ~15fps

            loop {
                match event_rx.recv() {
                    Ok(event) => match &event {
                        RecordingEvent::LevelUpdate { rms_db } => {
                            latest_rms.store(
                                (*rms_db * 100.0) as i32,
                                std::sync::atomic::Ordering::Relaxed,
                            );
                            if last_level_emit.elapsed() >= level_throttle {
                                let _ = app_handle
                                    .emit("recording-level", serde_json::json!({ "rmsDb": rms_db }));
                                last_level_emit = std::time::Instant::now();
                            }
                        }
                        RecordingEvent::StateChanged(state) => {
                            let _ = app_handle.emit("recording-state-changed", state);
                            match state {
                                RecordingState::Recording => {
                                    tray::update_tray_for_recording(&app_handle, true, None);
                                }
                                RecordingState::Idle => {
                                    tray::update_tray_for_recording(&app_handle, false, None);
                                }
                                _ => {}
                            }
                        }
                        RecordingEvent::DeviceError(msg) => {
                            let _ = app_handle.emit(
                                "recording-device-error",
                                serde_json::json!({ "error": msg }),
                            );
                        }
                        RecordingEvent::DeviceReconnected => {
                            let _ = app_handle.emit("recording-device-reconnected", ());
                        }
                        RecordingEvent::SilenceStart { offset_samples } => {
                            let _ = app_handle.emit(
                                "recording-silence-start",
                                serde_json::json!({ "offsetSamples": offset_samples }),
                            );
                        }
                        RecordingEvent::SilenceEnd { offset_samples } => {
                            let _ = app_handle.emit(
                                "recording-silence-end",
                                serde_json::json!({ "offsetSamples": offset_samples }),
                            );
                        }
                        RecordingEvent::SamplesWritten { total_samples } => {
                            let _ = app_handle.emit(
                                "recording-samples-written",
                                serde_json::json!({ "totalSamples": total_samples }),
                            );
                        }
                    },
                    Err(_) => {
                        tracing::info!("Recording event bridge: channel disconnected");
                        break;
                    }
                }
            }
        })
        .ok();
}

#[tauri::command]
async fn update_record_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    shortcut: String,
) -> Result<String, String> {
    // Validate the new shortcut parses
    parse_shortcut(&shortcut)
        .ok_or_else(|| format!("Invalid shortcut: {shortcut}"))?;

    // Get the old shortcut to unregister
    let old_str = {
        let cfg = state.config.lock().map_err(|e| e.to_string())?;
        cfg.record_shortcut.clone()
    };
    if let Some(old) = parse_shortcut(&old_str) {
        let _ = app.global_shortcut().unregister(old);
    }

    // Register the new shortcut
    register_record_shortcut(&app, &shortcut)?;

    // Persist to config
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut cfg = state.config.lock().map_err(|e| e.to_string())?;
        cfg.record_shortcut = shortcut.clone();
        wallflower_core::settings::save_config(&db.conn, &cfg).map_err(|e| e.to_string())?;
    }

    Ok(shortcut)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::open_default().expect("failed to open database");
    let config = settings::load_config(&db.conn).expect("failed to load config");

    // Ensure storage directory exists
    settings::ensure_storage_dir(&config).expect("failed to create storage directory");

    // Run crash recovery: scan for orphaned WAV files not in the database (D-06)
    let recovered_recordings =
        commands::recording::recover_crashed_recordings(&config.storage_dir, &db.conn);

    // Start the folder watcher
    let db_path = wallflower_core::db::Database::default_path();
    let watcher = match wallflower_core::watcher::start_watcher(
        config.watch_folder.clone(),
        db_path,
        config.storage_dir.clone(),
        vec![config.export_root.clone(), config.storage_dir.clone()],
    ) {
        Ok(w) => {
            tracing::info!(
                "Watching {} for new audio files",
                config.watch_folder.display()
            );
            Some(w)
        }
        Err(e) => {
            tracing::warn!("Failed to start folder watcher: {e}");
            None
        }
    };

    // Create the recording engine
    let (event_tx, event_rx) = crossbeam_channel::unbounded();
    let scheduler = PriorityScheduler::new();
    let recording_engine = RecordingEngine::new(RecordingConfig::default(), event_tx, scheduler.clone());

    // Shared RMS value for level metering
    let latest_rms = Arc::new(AtomicI32::new(-10000));
    let latest_rms_for_state = latest_rms.clone();

    // Start the HTTP API server in the background
    let audio_dir = config.storage_dir.clone();
    tauri::async_runtime::spawn(async move {
        api::start_api_server(23516, audio_dir).await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--autostarted"])))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            start_patches_watcher(app.handle().clone());

            // Set up system tray (D-07)
            tray::setup_tray(app)?;

            // Register global record shortcut from config (D-08)
            {
                let shortcut_str = {
                    let state: tauri::State<'_, AppState> = app.state();
                    let cfg = state.config.lock().unwrap();
                    cfg.record_shortcut.clone()
                };
                register_record_shortcut(&app.handle().clone(), &shortcut_str)
                    .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            }

            // Notify about recovered recordings (D-06)
            let app_handle = app.handle().clone();
            for (_jam_id, duration) in &recovered_recordings {
                notify(
                    &app_handle,
                    "Recording Recovered",
                    &format!("Recovered recording from crash ({:.0}s)", duration),
                );
            }

            // Start recording event bridge
            start_recording_event_bridge(
                app.handle().clone(),
                event_rx,
                latest_rms.clone(),
            );

            Ok(())
        })
        .manage(AppState {
            db: Mutex::new(db),
            config: Mutex::new(config),
            watcher: Mutex::new(watcher),
            recording_engine: Mutex::new(SendableRecordingEngine(recording_engine)),
            latest_rms_db: latest_rms_for_state,
            scheduler,
            current_recording_jam_id: Mutex::new(None),
            sidecar: tokio::sync::Mutex::new({
                let sidecar_dir = sidecar::resolve_sidecar_dir(None);
                sidecar::SidecarManager::new(50051, sidecar_dir)
            }),
            separation_cancel: Arc::new(AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            // Jam queries
            commands::jams::list_jams,
            commands::jams::get_jam,
            commands::jams::search_jams,
            commands::jams::get_filter_options,
            commands::jams::delete_jam, // Delete
            // Import
            commands::import::import_files,
            commands::import::import_directory,
            commands::import::import_from_device,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            update_record_shortcut,
            // Status
            commands::status::get_status,
            commands::status::get_connected_devices,
            // Metadata (Phase 2)
            commands::metadata::get_jam_with_metadata,
            commands::metadata::add_tag,
            commands::metadata::remove_tag,
            commands::metadata::list_all_tags,
            commands::metadata::add_collaborator,
            commands::metadata::remove_collaborator,
            commands::metadata::list_all_collaborators,
            commands::metadata::add_instrument,
            commands::metadata::remove_instrument,
            commands::metadata::list_all_instruments,
            commands::metadata::update_jam_metadata,
            commands::metadata::attach_photo,
            commands::metadata::remove_photo,
            commands::metadata::get_peaks,
            commands::metadata::generate_peaks_for_jam,
            commands::metadata::send_notification,
            // Recording (Phase 3)
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::get_recording_status,
            commands::recording::list_audio_devices,
            commands::recording::list_audio_devices_detailed,
            commands::recording::get_recording_level,
            commands::recording::monitor_input_levels,
            // Analysis (Phase 4)
            commands::analysis::analyze_jam,
            commands::analysis::queue_pending_analysis,
            commands::analysis::prioritize_analysis,
            commands::analysis::reanalyze_jam,
            commands::analysis::set_manual_tempo,
            commands::analysis::set_manual_key,
            commands::analysis::clear_manual_tempo,
            commands::analysis::clear_manual_key,
            commands::analysis::get_analysis_results,
            // Bookmarks & Export (Phase 5)
            commands::bookmarks::create_bookmark,
            commands::bookmarks::get_bookmarks,
            commands::bookmarks::update_bookmark,
            commands::bookmarks::delete_bookmark,
            commands::export::export_audio,
            commands::export::separate_stems,
            commands::export::export_stems,
            commands::export::cancel_separation,
            commands::export::reveal_in_finder,
            // Spatial explorer (Phase 6)
            commands::spatial::get_spatial_jams,
            // Sample browser (Phase 7)
            commands::samples::get_all_samples,
            commands::samples::get_sample_filter_options,
            commands::export::export_sample_audio,
            commands::export::separate_sample_stems,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
