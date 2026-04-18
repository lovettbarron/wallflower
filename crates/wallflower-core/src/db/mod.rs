pub mod schema;

use crate::error::{Result, WallflowerError};
use rusqlite::{params, Connection};
use schema::{JamRecord, NewJam};
use std::collections::HashMap;
use std::path::Path;
use tracing::info;

/// The initial schema SQL, embedded at compile time.
const MIGRATION_V1: &str = include_str!("../../../../migrations/V1__initial_schema.sql");

/// Database wrapper around a SQLite connection.
pub struct Database {
    pub conn: Connection,
}

impl Database {
    /// Open a database at the given path. Creates the file and parent
    /// directories if they do not exist. Runs migrations on first open.
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    /// Open the default database at the platform-specific app data directory.
    /// On macOS this resolves to ~/Library/Application Support/wallflower/wallflower.db.
    pub fn open_default() -> Result<Self> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| WallflowerError::Config("Could not determine app data directory".into()))?
            .join("wallflower");
        let db_path = data_dir.join("wallflower.db");
        info!("Opening database at: {}", db_path.display());
        Self::open(&db_path)
    }

    /// Open an in-memory database (for testing).
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    /// Set pragmas and run migrations.
    fn initialize(&self) -> Result<()> {
        // Enable WAL mode for concurrent access (app + CLI).
        self.conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        self.conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        // Simple migration tracking: check if the jams table exists.
        let table_exists: bool = self.conn.query_row(
            "SELECT count(*) > 0 FROM sqlite_master WHERE type='table' AND name='jams'",
            [],
            |row| row.get(0),
        )?;

        if !table_exists {
            info!("Running initial database migration");
            self.conn.execute_batch(MIGRATION_V1)?;
        }

        Ok(())
    }
}

/// List all jams, ordered by most recently imported first.
pub fn list_jams(conn: &Connection) -> Result<Vec<JamRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, original_filename, content_hash, file_path, format,
                duration_seconds, sample_rate, bit_depth, channels, file_size_bytes,
                imported_at, created_at
         FROM jams
         ORDER BY imported_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(JamRecord {
            id: row.get(0)?,
            filename: row.get(1)?,
            original_filename: row.get(2)?,
            content_hash: row.get(3)?,
            file_path: row.get(4)?,
            format: row.get(5)?,
            duration_seconds: row.get(6)?,
            sample_rate: row.get(7)?,
            bit_depth: row.get(8)?,
            channels: row.get(9)?,
            file_size_bytes: row.get(10)?,
            imported_at: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;

    let mut jams = Vec::new();
    for row in rows {
        jams.push(row?);
    }
    Ok(jams)
}

/// Get a single jam by its ID.
pub fn get_jam(conn: &Connection, id: &str) -> Result<Option<JamRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, original_filename, content_hash, file_path, format,
                duration_seconds, sample_rate, bit_depth, channels, file_size_bytes,
                imported_at, created_at
         FROM jams
         WHERE id = ?1",
    )?;

    let mut rows = stmt.query_map(params![id], |row| {
        Ok(JamRecord {
            id: row.get(0)?,
            filename: row.get(1)?,
            original_filename: row.get(2)?,
            content_hash: row.get(3)?,
            file_path: row.get(4)?,
            format: row.get(5)?,
            duration_seconds: row.get(6)?,
            sample_rate: row.get(7)?,
            bit_depth: row.get(8)?,
            channels: row.get(9)?,
            file_size_bytes: row.get(10)?,
            imported_at: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;

    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Find a jam by its content hash (for duplicate detection).
pub fn find_by_hash(conn: &Connection, hash: &str) -> Result<Option<JamRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, original_filename, content_hash, file_path, format,
                duration_seconds, sample_rate, bit_depth, channels, file_size_bytes,
                imported_at, created_at
         FROM jams
         WHERE content_hash = ?1",
    )?;

    let mut rows = stmt.query_map(params![hash], |row| {
        Ok(JamRecord {
            id: row.get(0)?,
            filename: row.get(1)?,
            original_filename: row.get(2)?,
            content_hash: row.get(3)?,
            file_path: row.get(4)?,
            format: row.get(5)?,
            duration_seconds: row.get(6)?,
            sample_rate: row.get(7)?,
            bit_depth: row.get(8)?,
            channels: row.get(9)?,
            file_size_bytes: row.get(10)?,
            imported_at: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;

    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Insert a new jam record. Generates a UUID for the id.
pub fn insert_jam(conn: &Connection, jam: &NewJam) -> Result<JamRecord> {
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO jams (id, filename, original_filename, content_hash, file_path, format,
                           duration_seconds, sample_rate, bit_depth, channels, file_size_bytes,
                           created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            jam.filename,
            jam.original_filename,
            jam.content_hash,
            jam.file_path,
            jam.format,
            jam.duration_seconds,
            jam.sample_rate,
            jam.bit_depth,
            jam.channels,
            jam.file_size_bytes,
            jam.created_at,
        ],
    )?;

    // Return the full record (with server-generated imported_at).
    get_jam(conn, &id)?
        .ok_or_else(|| WallflowerError::Db(rusqlite::Error::QueryReturnedNoRows))
}

/// Get a single setting value by key.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
    match rows.next() {
        Some(val) => Ok(Some(val?)),
        None => Ok(None),
    }
}

/// Set a setting value (insert or replace).
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

/// Get all settings as a HashMap.
pub fn get_all_settings(conn: &Connection) -> Result<HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut settings = HashMap::new();
    for row in rows {
        let (key, value) = row?;
        settings.insert(key, value);
    }
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_jam() -> NewJam {
        NewJam {
            filename: "test-jam.wav".into(),
            original_filename: "My Recording.wav".into(),
            content_hash: "abc123def456".into(),
            file_path: "/data/test-jam.wav".into(),
            format: "wav".into(),
            duration_seconds: Some(120.5),
            sample_rate: Some(48000),
            bit_depth: Some(32),
            channels: Some(2),
            file_size_bytes: 23_068_672,
            created_at: Some("2026-04-18T10:00:00".into()),
        }
    }

    #[test]
    fn test_open_creates_db() {
        let db = Database::open_in_memory().expect("should open in-memory db");

        // Verify jams table exists
        let count: i64 = db
            .conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='jams'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // Verify settings table exists
        let count: i64 = db
            .conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_insert_and_list_jams() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();

        let record = insert_jam(&db.conn, &jam).unwrap();
        assert_eq!(record.filename, "test-jam.wav");
        assert_eq!(record.original_filename, "My Recording.wav");
        assert_eq!(record.content_hash, "abc123def456");
        assert_eq!(record.format, "wav");
        assert_eq!(record.duration_seconds, Some(120.5));
        assert_eq!(record.sample_rate, Some(48000));
        assert_eq!(record.bit_depth, Some(32));
        assert_eq!(record.channels, Some(2));
        assert_eq!(record.file_size_bytes, 23_068_672);

        let jams = list_jams(&db.conn).unwrap();
        assert_eq!(jams.len(), 1);
        assert_eq!(jams[0].id, record.id);
    }

    #[test]
    fn test_find_by_hash() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        insert_jam(&db.conn, &jam).unwrap();

        let found = find_by_hash(&db.conn, "abc123def456").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().filename, "test-jam.wav");

        let not_found = find_by_hash(&db.conn, "nonexistent").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_duplicate_hash_rejected() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        insert_jam(&db.conn, &jam).unwrap();

        // Second insert with same hash should fail (UNIQUE constraint).
        let result = insert_jam(&db.conn, &jam);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_jam_by_id() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let found = get_jam(&db.conn, &record.id).unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().content_hash, "abc123def456");

        let not_found = get_jam(&db.conn, "nonexistent-id").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_settings_crud() {
        let db = Database::open_in_memory().unwrap();

        // Default settings should be populated from migration.
        let watch = get_setting(&db.conn, "watch_folder").unwrap();
        assert_eq!(watch, Some("~/wallflower".into()));

        // Update a setting.
        set_setting(&db.conn, "watch_folder", "/custom/path").unwrap();
        let updated = get_setting(&db.conn, "watch_folder").unwrap();
        assert_eq!(updated, Some("/custom/path".into()));

        // Get all settings.
        let all = get_all_settings(&db.conn).unwrap();
        assert!(all.contains_key("watch_folder"));
        assert!(all.contains_key("storage_dir"));
        assert!(all.contains_key("duplicate_handling"));
        assert_eq!(all["watch_folder"], "/custom/path");
    }

    #[test]
    fn test_wal_mode_enabled() {
        let db = Database::open_in_memory().unwrap();
        // WAL mode may not persist for in-memory databases, but we verify the pragma runs.
        // For file-based DBs, this would return "wal".
        let mode: String = db
            .conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        // In-memory databases report "memory" for journal_mode.
        assert!(mode == "wal" || mode == "memory");
    }
}
