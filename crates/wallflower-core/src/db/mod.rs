pub mod schema;

use crate::error::{Result, WallflowerError};
use rusqlite::{params, Connection};
use schema::{
    JamCollaborator, JamInstrument, JamMetadata, JamPhoto, JamRecord, JamTag, NewJam,
};
use std::collections::HashMap;
use std::path::Path;
use tracing::info;

/// The initial schema SQL, embedded at compile time.
const MIGRATION_V1: &str = include_str!("../../../../migrations/V1__initial_schema.sql");

/// The V2 schema migration: metadata tables, additional jams columns.
const MIGRATION_V2: &str = include_str!("../../../../migrations/V2__metadata_tables.sql");

/// V3: Recording support tables (gap tracking for device disconnects).
const MIGRATION_V3: &str = include_str!("../../../../migrations/V3__recording_tables.sql");

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
            .ok_or_else(|| {
                WallflowerError::Config("Could not determine app data directory".into())
            })?
            .join("wallflower");
        let db_path = data_dir.join("wallflower.db");
        info!("Opening database at: {}", db_path.display());
        Self::open(&db_path)
    }

    /// Returns the default database path without opening it.
    /// On macOS: ~/Library/Application Support/wallflower/wallflower.db
    pub fn default_path() -> std::path::PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("wallflower")
            .join("wallflower.db")
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

        // Check if schema_version table exists (V2+ tracking).
        let has_schema_version: bool = self.conn.query_row(
            "SELECT count(*) > 0 FROM sqlite_master WHERE type='table' AND name='schema_version'",
            [],
            |row| row.get(0),
        )?;

        if has_schema_version {
            // Database has versioning. Check current version and run needed migrations.
            let current_version: i32 = self.conn.query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )?;

            if current_version < 2 {
                info!("Running V2 migration (current version: {})", current_version);
                self.conn.execute_batch(MIGRATION_V2)?;
            }
        } else {
            // No schema_version table. Check if this is an existing V1 database or fresh.
            let has_jams: bool = self.conn.query_row(
                "SELECT count(*) > 0 FROM sqlite_master WHERE type='table' AND name='jams'",
                [],
                |row| row.get(0),
            )?;

            if has_jams {
                // Existing V1 database. Insert schema_version with V1, then run V2.
                info!("Upgrading V1 database to V2");
                self.conn.execute_batch(
                    "CREATE TABLE IF NOT EXISTS schema_version (
                        version INTEGER PRIMARY KEY,
                        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
                    );
                    INSERT INTO schema_version (version) VALUES (1);",
                )?;
                self.conn.execute_batch(MIGRATION_V2)?;
            } else {
                // Fresh database. Run V1 then V2.
                info!("Running initial database migrations (V1 + V2)");
                self.conn.execute_batch(MIGRATION_V1)?;
                self.conn.execute_batch(MIGRATION_V2)?;
            }
        }

        // Schema version tracking via user_version pragma.
        let current_version: i32 = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;

        // V3: Recording support tables
        if current_version < 3 {
            info!("Running V3 migration: recording tables");
            self.conn.execute_batch(MIGRATION_V3)?;
            self.conn.execute_batch("PRAGMA user_version = 3;")?;
        }

        Ok(())
    }
}

// Helper to map a row to a JamRecord (with V2 columns).
fn map_jam_row(row: &rusqlite::Row) -> rusqlite::Result<JamRecord> {
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
        location: row.get(13)?,
        notes: row.get(14)?,
        patch_notes: row.get(15)?,
        peaks_generated: row.get::<_, i32>(16).unwrap_or(0) != 0,
    })
}

const JAM_SELECT: &str = "SELECT id, filename, original_filename, content_hash, file_path, format,
                duration_seconds, sample_rate, bit_depth, channels, file_size_bytes,
                imported_at, created_at, location, notes, patch_notes, peaks_generated
         FROM jams";

/// List all jams, ordered by most recently imported first.
pub fn list_jams(conn: &Connection) -> Result<Vec<JamRecord>> {
    let mut stmt = conn.prepare(&format!("{} ORDER BY imported_at DESC", JAM_SELECT))?;

    let rows = stmt.query_map([], |row| map_jam_row(row))?;

    let mut jams = Vec::new();
    for row in rows {
        jams.push(row?);
    }
    Ok(jams)
}

/// Get a single jam by its ID.
pub fn get_jam(conn: &Connection, id: &str) -> Result<Option<JamRecord>> {
    let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", JAM_SELECT))?;

    let mut rows = stmt.query_map(params![id], |row| map_jam_row(row))?;

    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Find a jam by its content hash (for duplicate detection).
pub fn find_by_hash(conn: &Connection, hash: &str) -> Result<Option<JamRecord>> {
    let mut stmt = conn.prepare(&format!("{} WHERE content_hash = ?1", JAM_SELECT))?;

    let mut rows = stmt.query_map(params![hash], |row| map_jam_row(row))?;

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

/// Get the most recent jam (by imported_at DESC). Used by patches watcher
/// to determine which jam to auto-attach photos to.
pub fn get_most_recent_jam(conn: &Connection) -> Result<Option<JamRecord>> {
    let mut stmt = conn.prepare(&format!("{} ORDER BY imported_at DESC LIMIT 1", JAM_SELECT))?;

    let mut rows = stmt.query_map([], map_jam_row)?;

    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
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

// ── Tag CRUD ──────────────────────────────────────────────────

/// Insert a tag for a jam.
pub fn insert_tag(conn: &Connection, jam_id: &str, tag: &str) -> Result<JamTag> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO jam_tags (id, jam_id, tag) VALUES (?1, ?2, ?3)",
        params![id, jam_id, tag],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, jam_id, tag, created_at FROM jam_tags WHERE id = ?1",
    )?;
    let tag_record = stmt.query_row(params![id], |row| {
        Ok(JamTag {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            tag: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    Ok(tag_record)
}

/// List all tags for a jam.
pub fn list_tags_for_jam(conn: &Connection, jam_id: &str) -> Result<Vec<JamTag>> {
    let mut stmt = conn.prepare(
        "SELECT id, jam_id, tag, created_at FROM jam_tags WHERE jam_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![jam_id], |row| {
        Ok(JamTag {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            tag: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    let mut tags = Vec::new();
    for row in rows {
        tags.push(row?);
    }
    Ok(tags)
}

/// Delete a tag by ID.
pub fn delete_tag(conn: &Connection, tag_id: &str) -> Result<()> {
    conn.execute("DELETE FROM jam_tags WHERE id = ?1", params![tag_id])?;
    Ok(())
}

/// List all distinct tags across all jams (for autocomplete).
pub fn list_all_tags(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT DISTINCT tag FROM jam_tags ORDER BY tag")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut tags = Vec::new();
    for row in rows {
        tags.push(row?);
    }
    Ok(tags)
}

// ── Collaborator CRUD ─────────────────────────────────────────

/// Insert a collaborator for a jam.
pub fn insert_collaborator(
    conn: &Connection,
    jam_id: &str,
    name: &str,
) -> Result<JamCollaborator> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO jam_collaborators (id, jam_id, name) VALUES (?1, ?2, ?3)",
        params![id, jam_id, name],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, jam_id, name, created_at FROM jam_collaborators WHERE id = ?1",
    )?;
    let record = stmt.query_row(params![id], |row| {
        Ok(JamCollaborator {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    Ok(record)
}

/// List all collaborators for a jam.
pub fn list_collaborators_for_jam(
    conn: &Connection,
    jam_id: &str,
) -> Result<Vec<JamCollaborator>> {
    let mut stmt = conn.prepare(
        "SELECT id, jam_id, name, created_at FROM jam_collaborators WHERE jam_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![jam_id], |row| {
        Ok(JamCollaborator {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

/// Delete a collaborator by ID.
pub fn delete_collaborator(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM jam_collaborators WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

/// List all distinct collaborator names (for autocomplete).
pub fn list_all_collaborators(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT DISTINCT name FROM jam_collaborators ORDER BY name")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut names = Vec::new();
    for row in rows {
        names.push(row?);
    }
    Ok(names)
}

// ── Instrument CRUD ───────────────────────────────────────────

/// Insert an instrument for a jam.
pub fn insert_instrument(
    conn: &Connection,
    jam_id: &str,
    name: &str,
) -> Result<JamInstrument> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO jam_instruments (id, jam_id, name) VALUES (?1, ?2, ?3)",
        params![id, jam_id, name],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, jam_id, name, created_at FROM jam_instruments WHERE id = ?1",
    )?;
    let record = stmt.query_row(params![id], |row| {
        Ok(JamInstrument {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    Ok(record)
}

/// List all instruments for a jam.
pub fn list_instruments_for_jam(
    conn: &Connection,
    jam_id: &str,
) -> Result<Vec<JamInstrument>> {
    let mut stmt = conn.prepare(
        "SELECT id, jam_id, name, created_at FROM jam_instruments WHERE jam_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![jam_id], |row| {
        Ok(JamInstrument {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

/// Delete an instrument by ID.
pub fn delete_instrument(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM jam_instruments WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

/// List all distinct instrument names (for autocomplete).
pub fn list_all_instruments(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT DISTINCT name FROM jam_instruments ORDER BY name")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut names = Vec::new();
    for row in rows {
        names.push(row?);
    }
    Ok(names)
}

// ── Jam Metadata ──────────────────────────────────────────────

/// Update the metadata fields (location, notes, patch_notes) on a jam.
pub fn update_jam_metadata(
    conn: &Connection,
    jam_id: &str,
    metadata: &JamMetadata,
) -> Result<()> {
    conn.execute(
        "UPDATE jams SET location = ?1, notes = ?2, patch_notes = ?3 WHERE id = ?4",
        params![metadata.location, metadata.notes, metadata.patch_notes, jam_id],
    )?;
    Ok(())
}

/// Set (or clear) the peaks_generated flag on a jam.
pub fn set_peaks_generated(conn: &Connection, jam_id: &str, generated: bool) -> Result<()> {
    conn.execute(
        "UPDATE jams SET peaks_generated = ?1 WHERE id = ?2",
        params![generated as i32, jam_id],
    )?;
    Ok(())
}

// ── Photo CRUD ────────────────────────────────────────────────

/// Insert a photo record for a jam.
pub fn insert_photo(
    conn: &Connection,
    jam_id: &str,
    filename: &str,
    file_path: &str,
    thumbnail_path: Option<&str>,
    source: &str,
) -> Result<JamPhoto> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO jam_photos (id, jam_id, filename, file_path, thumbnail_path, source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, jam_id, filename, file_path, thumbnail_path, source],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, jam_id, filename, file_path, thumbnail_path, source, created_at
         FROM jam_photos WHERE id = ?1",
    )?;
    let record = stmt.query_row(params![id], |row| {
        Ok(JamPhoto {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            filename: row.get(2)?,
            file_path: row.get(3)?,
            thumbnail_path: row.get(4)?,
            source: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    Ok(record)
}

/// List all photos for a jam.
pub fn list_photos_for_jam(conn: &Connection, jam_id: &str) -> Result<Vec<JamPhoto>> {
    let mut stmt = conn.prepare(
        "SELECT id, jam_id, filename, file_path, thumbnail_path, source, created_at
         FROM jam_photos WHERE jam_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![jam_id], |row| {
        Ok(JamPhoto {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            filename: row.get(2)?,
            file_path: row.get(3)?,
            thumbnail_path: row.get(4)?,
            source: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    let mut photos = Vec::new();
    for row in rows {
        photos.push(row?);
    }
    Ok(photos)
}

/// Delete a photo record by ID.
pub fn delete_photo(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM jam_photos WHERE id = ?1", params![id])?;
    Ok(())
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
    fn test_v2_migration_creates_tables() {
        let db = Database::open_in_memory().unwrap();

        for table in &["jam_tags", "jam_collaborators", "jam_instruments", "jam_photos", "schema_version"] {
            let count: i64 = db
                .conn
                .query_row(
                    &format!(
                        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='{}'",
                        table
                    ),
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "Table {} should exist", table);
        }
    }

    #[test]
    fn test_v2_migration_adds_jams_columns() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        // New columns should have defaults
        assert_eq!(record.location, None);
        assert_eq!(record.notes, None);
        assert_eq!(record.patch_notes, None);
        assert!(!record.peaks_generated);
    }

    #[test]
    fn test_schema_version_tracked() {
        let db = Database::open_in_memory().unwrap();
        let version: i32 = db
            .conn
            .query_row(
                "SELECT MAX(version) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 2);
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
        let mode: String = db
            .conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        // In-memory databases report "memory" for journal_mode.
        assert!(mode == "wal" || mode == "memory");
    }

    // ── Tag tests ──────────────────────────────────────────

    #[test]
    fn test_insert_tag() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let tag = insert_tag(&db.conn, &record.id, "ambient").unwrap();
        assert_eq!(tag.jam_id, record.id);
        assert_eq!(tag.tag, "ambient");
        assert!(!tag.id.is_empty());
        assert!(!tag.created_at.is_empty());
    }

    #[test]
    fn test_list_tags_for_jam() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        insert_tag(&db.conn, &record.id, "ambient").unwrap();
        insert_tag(&db.conn, &record.id, "drone").unwrap();

        let tags = list_tags_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(tags.len(), 2);
    }

    #[test]
    fn test_delete_tag() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let tag = insert_tag(&db.conn, &record.id, "ambient").unwrap();
        delete_tag(&db.conn, &tag.id).unwrap();

        let tags = list_tags_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(tags.len(), 0);
    }

    // ── Collaborator tests ─────────────────────────────────

    #[test]
    fn test_insert_collaborator() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let collab = insert_collaborator(&db.conn, &record.id, "Alice").unwrap();
        assert_eq!(collab.jam_id, record.id);
        assert_eq!(collab.name, "Alice");
    }

    #[test]
    fn test_list_and_delete_collaborator() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let c1 = insert_collaborator(&db.conn, &record.id, "Alice").unwrap();
        insert_collaborator(&db.conn, &record.id, "Bob").unwrap();

        let collabs = list_collaborators_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(collabs.len(), 2);

        delete_collaborator(&db.conn, &c1.id).unwrap();
        let collabs = list_collaborators_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(collabs.len(), 1);
        assert_eq!(collabs[0].name, "Bob");
    }

    // ── Instrument tests ───────────────────────────────────

    #[test]
    fn test_insert_instrument() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let inst = insert_instrument(&db.conn, &record.id, "Modular Synth").unwrap();
        assert_eq!(inst.jam_id, record.id);
        assert_eq!(inst.name, "Modular Synth");
    }

    #[test]
    fn test_list_and_delete_instrument() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let i1 = insert_instrument(&db.conn, &record.id, "Guitar").unwrap();
        insert_instrument(&db.conn, &record.id, "Bass").unwrap();

        let insts = list_instruments_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(insts.len(), 2);

        delete_instrument(&db.conn, &i1.id).unwrap();
        let insts = list_instruments_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(insts.len(), 1);
        assert_eq!(insts[0].name, "Bass");
    }

    // ── Metadata tests ─────────────────────────────────────

    #[test]
    fn test_update_jam_metadata() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let meta = JamMetadata {
            location: Some("Brooklyn Studio".into()),
            notes: Some("Great session".into()),
            patch_notes: Some("Moog Sub37 -> Strymon BigSky".into()),
        };
        update_jam_metadata(&db.conn, &record.id, &meta).unwrap();

        let updated = get_jam(&db.conn, &record.id).unwrap().unwrap();
        assert_eq!(updated.location, Some("Brooklyn Studio".into()));
        assert_eq!(updated.notes, Some("Great session".into()));
        assert_eq!(
            updated.patch_notes,
            Some("Moog Sub37 -> Strymon BigSky".into())
        );
    }

    #[test]
    fn test_set_peaks_generated() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        assert!(!record.peaks_generated);

        set_peaks_generated(&db.conn, &record.id, true).unwrap();
        let updated = get_jam(&db.conn, &record.id).unwrap().unwrap();
        assert!(updated.peaks_generated);
    }

    // ── Photo tests ────────────────────────────────────────

    #[test]
    fn test_insert_photo() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let photo = insert_photo(
            &db.conn,
            &record.id,
            "patch.jpg",
            "/photos/patch.jpg",
            Some("/thumbnails/patch_thumb.jpg"),
            "drop",
        )
        .unwrap();

        assert_eq!(photo.jam_id, record.id);
        assert_eq!(photo.filename, "patch.jpg");
        assert_eq!(photo.source, "drop");
    }

    #[test]
    fn test_list_photos_for_jam() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        insert_photo(&db.conn, &record.id, "a.jpg", "/a.jpg", None, "drop").unwrap();
        insert_photo(
            &db.conn,
            &record.id,
            "b.jpg",
            "/b.jpg",
            None,
            "patches_folder",
        )
        .unwrap();

        let photos = list_photos_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(photos.len(), 2);
    }

    #[test]
    fn test_delete_photo() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let photo =
            insert_photo(&db.conn, &record.id, "a.jpg", "/a.jpg", None, "drop").unwrap();
        delete_photo(&db.conn, &photo.id).unwrap();

        let photos = list_photos_for_jam(&db.conn, &record.id).unwrap();
        assert_eq!(photos.len(), 0);
    }
}
