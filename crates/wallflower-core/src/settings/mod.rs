use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::{Result, WallflowerError};

/// Application configuration loaded from the settings table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub watch_folder: PathBuf,
    pub storage_dir: PathBuf,
    pub duplicate_handling: String,
}

/// Load application configuration from the database settings table.
/// Expands `~` to the user's home directory.
/// Falls back to sensible defaults if settings are missing.
pub fn load_config(conn: &Connection) -> Result<AppConfig> {
    let watch_raw = db::get_setting(conn, "watch_folder")?
        .unwrap_or_else(|| "~/wallflower".to_string());
    let storage_raw = db::get_setting(conn, "storage_dir")?
        .unwrap_or_default();
    let dup = db::get_setting(conn, "duplicate_handling")?
        .unwrap_or_else(|| "skip".to_string());

    let watch_folder = expand_tilde(&watch_raw);

    let storage_dir = if storage_raw.is_empty() {
        dirs::data_dir()
            .ok_or_else(|| {
                WallflowerError::Config("Could not determine app data directory".into())
            })?
            .join("wallflower")
            .join("audio")
    } else {
        expand_tilde(&storage_raw)
    };

    Ok(AppConfig {
        watch_folder,
        storage_dir,
        duplicate_handling: dup,
    })
}

/// Save application configuration to the database settings table.
pub fn save_config(conn: &Connection, config: &AppConfig) -> Result<()> {
    db::set_setting(
        conn,
        "watch_folder",
        &config.watch_folder.to_string_lossy(),
    )?;
    db::set_setting(
        conn,
        "storage_dir",
        &config.storage_dir.to_string_lossy(),
    )?;
    db::set_setting(conn, "duplicate_handling", &config.duplicate_handling)?;
    Ok(())
}

/// Detect if a path is inside a cloud sync folder.
/// Returns the sync service name if detected, None otherwise.
pub fn is_in_sync_folder(path: &Path) -> Option<&'static str> {
    let path_str = path.to_string_lossy();

    if path_str.contains("/Dropbox/") || path_str.contains("/Dropbox") {
        Some("Dropbox")
    } else if path_str.contains("/Library/Mobile Documents/") {
        Some("iCloud")
    } else if path_str.contains("/OneDrive/") || path_str.contains("/OneDrive") {
        Some("OneDrive")
    } else if path_str.contains("/Google Drive/")
        || path_str.contains("/GoogleDrive/")
        || path_str.contains("/Google Drive")
        || path_str.contains("/GoogleDrive")
    {
        Some("Google Drive")
    } else {
        None
    }
}

/// Ensure the storage directory exists, creating it if necessary.
pub fn ensure_storage_dir(config: &AppConfig) -> Result<()> {
    std::fs::create_dir_all(&config.storage_dir)?;
    Ok(())
}

/// Expand `~` at the start of a path string to the user's home directory.
fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    } else if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
    }
    PathBuf::from(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_config_defaults() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let config = load_config(&db.conn).unwrap();

        // watch_folder should be expanded from ~/wallflower
        assert!(config.watch_folder.to_string_lossy().contains("wallflower"));
        assert!(!config.watch_folder.to_string_lossy().starts_with("~"));

        // storage_dir should default to data_dir/wallflower/audio
        assert!(config.storage_dir.to_string_lossy().contains("wallflower"));
        assert!(config.storage_dir.to_string_lossy().contains("audio"));

        assert_eq!(config.duplicate_handling, "skip");
    }

    #[test]
    fn test_save_and_reload_config() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let mut config = load_config(&db.conn).unwrap();

        config.watch_folder = PathBuf::from("/custom/watch");
        config.storage_dir = PathBuf::from("/custom/storage");
        config.duplicate_handling = "replace".into();
        save_config(&db.conn, &config).unwrap();

        let reloaded = load_config(&db.conn).unwrap();
        assert_eq!(reloaded.watch_folder, PathBuf::from("/custom/watch"));
        assert_eq!(reloaded.storage_dir, PathBuf::from("/custom/storage"));
        assert_eq!(reloaded.duplicate_handling, "replace");
    }

    #[test]
    fn test_is_in_sync_folder() {
        assert_eq!(
            is_in_sync_folder(Path::new("/Users/me/Dropbox/audio/jam.wav")),
            Some("Dropbox")
        );
        assert_eq!(
            is_in_sync_folder(Path::new(
                "/Users/me/Library/Mobile Documents/com~apple~CloudDocs/jam.wav"
            )),
            Some("iCloud")
        );
        assert_eq!(
            is_in_sync_folder(Path::new("/Users/me/OneDrive/music/jam.wav")),
            Some("OneDrive")
        );
        assert_eq!(
            is_in_sync_folder(Path::new("/Users/me/Google Drive/jam.wav")),
            Some("Google Drive")
        );
        assert_eq!(
            is_in_sync_folder(Path::new("/Users/me/Music/jam.wav")),
            None
        );
    }

    #[test]
    fn test_expand_tilde() {
        let expanded = expand_tilde("~/wallflower");
        assert!(!expanded.to_string_lossy().starts_with("~"));
        assert!(expanded.to_string_lossy().contains("wallflower"));

        let abs = expand_tilde("/absolute/path");
        assert_eq!(abs, PathBuf::from("/absolute/path"));
    }

    #[test]
    fn test_ensure_storage_dir() {
        let tmp = tempfile::TempDir::new().unwrap();
        let config = AppConfig {
            watch_folder: PathBuf::from("/tmp"),
            storage_dir: tmp.path().join("new_subdir"),
            duplicate_handling: "skip".into(),
        };
        ensure_storage_dir(&config).unwrap();
        assert!(config.storage_dir.exists());
    }
}
