use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tracing::{error, info, warn};

use crate::db::Database;
use crate::import;

/// Handle to a running folder watcher.
/// Drop this to stop watching.
pub struct WatcherHandle {
    _watcher: RecommendedWatcher,
    thread: Option<JoinHandle<()>>,
    active: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
}

impl WatcherHandle {
    /// Returns true if the watcher is actively monitoring.
    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }

    /// Stop the watcher and wait for the debounce thread to exit.
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for WatcherHandle {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        // Don't join in Drop -- it would block. The thread will notice the stop flag.
    }
}

/// Start watching a folder for new audio files.
///
/// Files are debounced for 5 seconds after last modification before being imported.
/// Only files with supported audio extensions are processed.
pub fn start_watcher(
    watch_path: PathBuf,
    db_path: PathBuf,
    storage_dir: PathBuf,
) -> crate::error::Result<WatcherHandle> {
    // Ensure the watch directory exists
    if !watch_path.exists() {
        std::fs::create_dir_all(&watch_path)?;
        info!("Created watch directory: {}", watch_path.display());
    }

    let (tx, rx) = mpsc::channel();
    let active = Arc::new(AtomicBool::new(false));
    let stop = Arc::new(AtomicBool::new(false));

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let _ = tx.send(event);
        }
    })
    .map_err(|e| crate::error::WallflowerError::Config(format!("Failed to create watcher: {e}")))?;

    watcher
        .watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| {
            crate::error::WallflowerError::Config(format!(
                "Failed to watch {}: {e}",
                watch_path.display()
            ))
        })?;

    let active_clone = active.clone();
    let stop_clone = stop.clone();

    let thread = std::thread::Builder::new()
        .name("wallflower-watcher".into())
        .spawn(move || {
            active_clone.store(true, Ordering::Relaxed);
            let mut pending: HashMap<PathBuf, Instant> = HashMap::new();
            let debounce_duration = Duration::from_secs(5);
            let poll_interval = Duration::from_millis(500);

            loop {
                if stop_clone.load(Ordering::Relaxed) {
                    break;
                }

                // Drain all available events
                while let Ok(event) = rx.try_recv() {
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) => {
                            for path in event.paths {
                                if path.is_file() && import::is_audio_file(&path) {
                                    pending.insert(path, Instant::now());
                                }
                            }
                        }
                        _ => {}
                    }
                }

                // Process debounced entries
                let now = Instant::now();
                let ready: Vec<PathBuf> = pending
                    .iter()
                    .filter(|(_, last_modified)| now.duration_since(**last_modified) >= debounce_duration)
                    .map(|(path, _)| path.clone())
                    .collect();

                for path in ready {
                    pending.remove(&path);
                    info!("Auto-importing: {}", path.display());

                    match Database::open(&db_path) {
                        Ok(db) => {
                            let result = import::import_file(&db.conn, &storage_dir, &path);
                            match &result {
                                import::ImportResult::Imported { filename, .. } => {
                                    info!("Auto-imported: {filename}");
                                }
                                import::ImportResult::Duplicate { filename } => {
                                    info!("Skipped duplicate: {filename}");
                                }
                                import::ImportResult::Error { filename, error } => {
                                    warn!("Import error for {filename}: {error}");
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to open database for auto-import: {e}");
                        }
                    }
                }

                std::thread::sleep(poll_interval);
            }

            active_clone.store(false, Ordering::Relaxed);
        })
        .map_err(|e| {
            crate::error::WallflowerError::Config(format!("Failed to spawn watcher thread: {e}"))
        })?;

    Ok(WatcherHandle {
        _watcher: watcher,
        thread: Some(thread),
        active,
        stop,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_watcher_detects_new_file() {
        let watch_dir = TempDir::new().unwrap();
        let storage_dir = TempDir::new().unwrap();

        // Create a temporary database
        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");

        // Open db to initialize schema
        let _db = Database::open(&db_path).unwrap();

        let handle = start_watcher(
            watch_dir.path().to_path_buf(),
            db_path.clone(),
            storage_dir.path().to_path_buf(),
        )
        .unwrap();

        // Give the thread a moment to start
        std::thread::sleep(Duration::from_millis(100));
        assert!(handle.is_active());

        // Write a WAV file into the watched directory
        let wav_path = watch_dir.path().join("test-auto.wav");
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&wav_path, spec).unwrap();
        for i in 0..4410 {
            writer.write_sample((i as f32 * 0.01).sin() as i16).unwrap();
        }
        writer.finalize().unwrap();

        // Wait for debounce (5s) + processing time
        std::thread::sleep(Duration::from_secs(7));

        // Check the file was imported
        let db = Database::open(&db_path).unwrap();
        let jams = crate::db::list_jams(&db.conn).unwrap();
        assert_eq!(jams.len(), 1, "Expected 1 jam after auto-import");
        assert_eq!(jams[0].original_filename, "test-auto.wav");

        // Verify file was copied to storage
        assert!(storage_dir.path().join("test-auto.wav").exists());

        handle.stop();
    }
}
