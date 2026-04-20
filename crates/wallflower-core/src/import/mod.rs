pub mod hasher;
pub mod metadata;

use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;
use walkdir::WalkDir;

use crate::db;
use crate::db::schema::{JamRecord, NewJam};
use crate::error::{Result, WallflowerError};

/// Result of attempting to import a single audio file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(tag = "status")]
pub enum ImportResult {
    #[serde(rename = "imported")]
    Imported { filename: String, jam: JamRecord },
    #[serde(rename = "duplicate")]
    Duplicate { filename: String },
    #[serde(rename = "error")]
    Error { filename: String, error: String },
}

/// Supported audio file extensions (case-insensitive).
const AUDIO_EXTENSIONS: &[&str] = &["wav", "flac", "mp3"];

/// Check whether a path has a supported audio file extension.
pub fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Import a single audio file into the library.
///
/// The import pipeline:
/// 1. Validate file extension
/// 2. Compute SHA-256 content hash
/// 3. Check for duplicates by hash
/// 4. Extract audio metadata via symphonia
/// 5. Atomic copy: write to temp file, fsync, rename into storage_dir
/// 6. Insert database record
///
/// The original file is never modified.
pub fn import_file(conn: &Connection, storage_dir: &Path, source: &Path) -> ImportResult {
    let filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // 1. Validate extension
    if !is_audio_file(source) {
        return ImportResult::Error {
            filename,
            error: format!(
                "Unsupported file format. Supported: {}",
                AUDIO_EXTENSIONS.join(", ")
            ),
        };
    }

    // 2. Compute content hash
    let hash = match hasher::compute_sha256(source) {
        Ok(h) => h,
        Err(e) => {
            return ImportResult::Error {
                filename,
                error: format!("Failed to hash file: {e}"),
            }
        }
    };

    // 3. Check for duplicate
    match db::find_by_hash(conn, &hash) {
        Ok(Some(_)) => {
            return ImportResult::Duplicate { filename };
        }
        Err(e) => {
            return ImportResult::Error {
                filename,
                error: format!("Database error during duplicate check: {e}"),
            };
        }
        Ok(None) => {} // Not a duplicate, continue
    }

    // 4. Extract metadata
    let meta = metadata::extract(source);

    // 5. Get file size
    let file_size = match std::fs::metadata(source) {
        Ok(m) => m.len() as i64,
        Err(e) => {
            return ImportResult::Error {
                filename,
                error: format!("Failed to read file metadata: {e}"),
            };
        }
    };

    // 6. Ensure storage directory exists
    if let Err(e) = std::fs::create_dir_all(storage_dir) {
        return ImportResult::Error {
            filename,
            error: format!("Failed to create storage directory: {e}"),
        };
    }

    // 7. Determine target filename (handle collisions)
    let target_filename = unique_filename(storage_dir, &filename);
    let target_path = storage_dir.join(&target_filename);

    // 8. Atomic copy: temp file -> fsync -> rename
    let temp_result = (|| -> Result<()> {
        let temp = NamedTempFile::new_in(storage_dir)
            .map_err(|e| WallflowerError::Import(format!("Failed to create temp file: {e}")))?;

        // Copy source to temp
        let mut src = std::fs::File::open(source)?;
        let mut dst = temp.as_file().try_clone()?;
        std::io::copy(&mut src, &mut dst)?;

        // fsync to ensure data is on disk
        dst.sync_all()?;

        // Atomic rename
        temp.persist(&target_path)
            .map_err(|e| WallflowerError::Import(format!("Failed to persist file: {e}")))?;

        Ok(())
    })();

    if let Err(e) = temp_result {
        return ImportResult::Error {
            filename,
            error: format!("Failed to copy file: {e}"),
        };
    }

    // 9. Insert database record
    let format = meta.format.clone();
    let new_jam = NewJam {
        filename: target_filename.clone(),
        original_filename: filename.clone(),
        content_hash: hash,
        file_path: target_path.to_string_lossy().to_string(),
        format,
        duration_seconds: meta.duration_seconds,
        sample_rate: meta.sample_rate,
        bit_depth: meta.bit_depth,
        channels: meta.channels,
        file_size_bytes: file_size,
        created_at: None,
    };

    match db::insert_jam(conn, &new_jam) {
        Ok(jam) => ImportResult::Imported {
            filename: target_filename,
            jam,
        },
        Err(e) => {
            // Clean up the copied file on db insert failure
            let _ = std::fs::remove_file(&target_path);
            ImportResult::Error {
                filename,
                error: format!("Failed to insert database record: {e}"),
            }
        }
    }
}

/// Import multiple files into the library.
pub fn import_files(
    conn: &Connection,
    storage_dir: &Path,
    paths: Vec<PathBuf>,
) -> Vec<ImportResult> {
    paths
        .iter()
        .map(|p| import_file(conn, storage_dir, p))
        .collect()
}

/// Check whether a path is inside any of the given directories.
pub fn is_under_any(path: &Path, dirs: &[PathBuf]) -> bool {
    dirs.iter().any(|d| path.starts_with(d))
}

/// Import all audio files from a directory (recursively).
/// Paths under any entry in `exclude_dirs` are skipped.
pub fn import_directory(
    conn: &Connection,
    storage_dir: &Path,
    dir: &Path,
    exclude_dirs: &[PathBuf],
) -> Result<Vec<ImportResult>> {
    if !dir.is_dir() {
        return Err(WallflowerError::Import(format!(
            "Not a directory: {}",
            dir.display()
        )));
    }

    let audio_files: Vec<PathBuf> = WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| !is_under_any(e.path(), exclude_dirs))
        .filter(|e| is_audio_file(e.path()))
        .map(|e| e.path().to_path_buf())
        .collect();

    Ok(import_files(conn, storage_dir, audio_files))
}

/// Generate a unique filename in the target directory.
/// If `name` already exists, appends `-1`, `-2`, etc. before the extension.
fn unique_filename(dir: &Path, name: &str) -> String {
    if !dir.join(name).exists() {
        return name.to_string();
    }

    let path = Path::new(name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let mut counter = 1u32;
    loop {
        let candidate = if ext.is_empty() {
            format!("{stem}-{counter}")
        } else {
            format!("{stem}-{counter}.{ext}")
        };
        if !dir.join(&candidate).exists() {
            return candidate;
        }
        counter += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Create a minimal WAV file at the given path using hound.
    fn create_test_wav(path: &Path, samples: u32) {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(path, spec).unwrap();
        for i in 0..samples {
            writer
                .write_sample((i as f32 * 0.01).sin() as i16)
                .unwrap();
        }
        writer.finalize().unwrap();
    }

    #[test]
    fn test_is_audio_file() {
        assert!(is_audio_file(Path::new("song.wav")));
        assert!(is_audio_file(Path::new("song.WAV")));
        assert!(is_audio_file(Path::new("song.flac")));
        assert!(is_audio_file(Path::new("song.mp3")));
        assert!(!is_audio_file(Path::new("notes.txt")));
        assert!(!is_audio_file(Path::new("image.png")));
        assert!(!is_audio_file(Path::new("noext")));
    }

    #[test]
    fn test_import_wav_file() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let storage = TempDir::new().unwrap();
        let source_dir = TempDir::new().unwrap();
        let source_path = source_dir.path().join("test-jam.wav");
        create_test_wav(&source_path, 44100);

        let result = import_file(&db.conn, storage.path(), &source_path);
        match result {
            ImportResult::Imported { filename, jam } => {
                assert_eq!(filename, "test-jam.wav");
                assert_eq!(jam.original_filename, "test-jam.wav");
                assert_eq!(jam.format, "wav");
                assert!(jam.file_size_bytes > 0);
                // Verify file was copied to storage
                assert!(storage.path().join(&filename).exists());
            }
            other => panic!("Expected Imported, got {other:?}"),
        }

        // Verify jam appears in database
        let jams = db::list_jams(&db.conn).unwrap();
        assert_eq!(jams.len(), 1);
    }

    #[test]
    fn test_import_duplicate_skipped() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let storage = TempDir::new().unwrap();
        let source_dir = TempDir::new().unwrap();
        let source_path = source_dir.path().join("dup.wav");
        create_test_wav(&source_path, 44100);

        // First import succeeds
        let r1 = import_file(&db.conn, storage.path(), &source_path);
        assert!(matches!(r1, ImportResult::Imported { .. }));

        // Second import of same file is duplicate
        let r2 = import_file(&db.conn, storage.path(), &source_path);
        assert!(matches!(r2, ImportResult::Duplicate { .. }));

        // Only one jam in database
        let jams = db::list_jams(&db.conn).unwrap();
        assert_eq!(jams.len(), 1);
    }

    #[test]
    fn test_import_unsupported_format() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let storage = TempDir::new().unwrap();
        let source_dir = TempDir::new().unwrap();
        let txt_path = source_dir.path().join("notes.txt");
        std::fs::write(&txt_path, "not audio").unwrap();

        let result = import_file(&db.conn, storage.path(), &txt_path);
        assert!(matches!(result, ImportResult::Error { .. }));
    }

    #[test]
    fn test_import_directory() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let storage = TempDir::new().unwrap();
        let source_dir = TempDir::new().unwrap();

        create_test_wav(&source_dir.path().join("one.wav"), 22050);
        create_test_wav(&source_dir.path().join("two.wav"), 44100);
        // Non-audio file should be skipped
        std::fs::write(source_dir.path().join("readme.txt"), "skip me").unwrap();

        let results = import_directory(&db.conn, storage.path(), source_dir.path(), &[]).unwrap();
        assert_eq!(results.len(), 2);
        for r in &results {
            assert!(matches!(r, ImportResult::Imported { .. }));
        }
    }

    #[test]
    fn test_atomic_copy_preserves_original() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let storage = TempDir::new().unwrap();
        let source_dir = TempDir::new().unwrap();
        let source_path = source_dir.path().join("preserve.wav");
        create_test_wav(&source_path, 44100);

        // Hash before import
        let hash_before = hasher::compute_sha256(&source_path).unwrap();

        let _ = import_file(&db.conn, storage.path(), &source_path);

        // Original file still exists with same hash
        assert!(source_path.exists());
        let hash_after = hasher::compute_sha256(&source_path).unwrap();
        assert_eq!(hash_before, hash_after);
    }

    #[test]
    fn test_unique_filename() {
        let dir = TempDir::new().unwrap();
        assert_eq!(unique_filename(dir.path(), "song.wav"), "song.wav");

        // Create the file to force collision
        std::fs::write(dir.path().join("song.wav"), "x").unwrap();
        assert_eq!(unique_filename(dir.path(), "song.wav"), "song-1.wav");

        std::fs::write(dir.path().join("song-1.wav"), "x").unwrap();
        assert_eq!(unique_filename(dir.path(), "song.wav"), "song-2.wav");
    }
}
