mod api;
mod commands;

use std::path::PathBuf;
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;
use tauri_plugin_notification::NotificationExt;
use wallflower_core::db::Database;
use wallflower_core::settings::{self, AppConfig};
use wallflower_core::watcher::WatcherHandle;

pub struct AppState {
    pub db: Mutex<Database>,
    pub config: Mutex<AppConfig>,
    pub watcher: Mutex<Option<WatcherHandle>>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::open_default().expect("failed to open database");
    let config = settings::load_config(&db.conn).expect("failed to load config");

    // Ensure storage directory exists
    settings::ensure_storage_dir(&config).expect("failed to create storage directory");

    // Start the folder watcher
    let db_path = wallflower_core::db::Database::default_path();
    let watcher = match wallflower_core::watcher::start_watcher(
        config.watch_folder.clone(),
        db_path,
        config.storage_dir.clone(),
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

    // Start the HTTP API server in the background
    tauri::async_runtime::spawn(async {
        api::start_api_server(23516).await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Start the patches folder watcher for auto-attaching photos
            start_patches_watcher(app.handle().clone());
            Ok(())
        })
        .manage(AppState {
            db: Mutex::new(db),
            config: Mutex::new(config),
            watcher: Mutex::new(watcher),
        })
        .invoke_handler(tauri::generate_handler![
            commands::jams::list_jams,
            commands::jams::get_jam,
            commands::import::import_files,
            commands::import::import_directory,
            commands::import::import_from_device,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::status::get_status,
            commands::status::get_connected_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
