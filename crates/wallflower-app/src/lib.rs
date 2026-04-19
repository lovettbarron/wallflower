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
