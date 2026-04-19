mod api;
mod commands;

use std::sync::Mutex;

use wallflower_core::db::Database;
use wallflower_core::settings::{self, AppConfig};
use wallflower_core::watcher::WatcherHandle;

pub struct AppState {
    pub db: Mutex<Database>,
    pub config: Mutex<AppConfig>,
    pub watcher: Mutex<Option<WatcherHandle>>,
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
            tracing::info!("Watching {} for new audio files", config.watch_folder.display());
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
        .manage(AppState {
            db: Mutex::new(db),
            config: Mutex::new(config),
            watcher: Mutex::new(watcher),
        })
        .invoke_handler(tauri::generate_handler![
            // Jam queries
            commands::jams::list_jams,
            commands::jams::get_jam,
            // Import
            commands::import::import_files,
            commands::import::import_directory,
            commands::import::import_from_device,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
