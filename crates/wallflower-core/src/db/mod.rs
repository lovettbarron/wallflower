pub mod schema;

use crate::error::{Result, WallflowerError};
use rusqlite::{params, Connection};
use schema::{
    AnalysisResults, AnalysisStatus, JamCollaborator, JamInstrument, JamMetadata, JamPhoto,
    JamRecord, JamTag, KeyResult, LoopRecord, NewJam, SectionRecord, TempoResult,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;
use tracing::info;

/// Filter criteria for searching jams. All fields are optional;
/// when multiple are provided they combine with AND logic (D-12).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilter {
    /// Free-text search query matched against FTS5 index (D-15).
    pub query: Option<String>,
    /// Multi-select key filter, e.g. ["Bb minor", "C major"] (D-14).
    pub keys: Option<Vec<String>>,
    /// BPM range lower bound (D-13).
    pub tempo_min: Option<f64>,
    /// BPM range upper bound (D-13).
    pub tempo_max: Option<f64>,
    /// Tag filter.
    pub tags: Option<Vec<String>>,
    /// Collaborator name filter.
    pub collaborators: Option<Vec<String>>,
    /// Instrument name filter.
    pub instruments: Option<Vec<String>>,
    /// Date range lower bound (ISO date string).
    pub date_from: Option<String>,
    /// Date range upper bound (ISO date string).
    pub date_to: Option<String>,
    /// Location filter (substring match).
    pub location: Option<String>,
}

/// The initial schema SQL, embedded at compile time.
const MIGRATION_V1: &str = include_str!("../../../../migrations/V1__initial_schema.sql");

/// The V2 schema migration: metadata tables, additional jams columns.
const MIGRATION_V2: &str = include_str!("../../../../migrations/V2__metadata_tables.sql");

/// V3: Recording support tables (gap tracking for device disconnects).
const MIGRATION_V3: &str = include_str!("../../../../migrations/V3__recording_tables.sql");

/// V4: Analysis result tables for ML pipeline.
const V4_MIGRATION: &str = include_str!("../../../../migrations/V4__analysis_tables.sql");

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

        // Re-read after potential V3 migration
        let current_version: i32 = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;

        // V4: Analysis tables for ML pipeline
        if current_version < 4 {
            info!("Running V4 migration: analysis tables");
            self.conn.execute_batch(V4_MIGRATION)?;
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
    if let Some(ref original_filename) = metadata.original_filename {
        conn.execute(
            "UPDATE jams SET original_filename = ?1 WHERE id = ?2",
            params![original_filename, jam_id],
        )?;
    }
    if let Some(ref location) = metadata.location {
        conn.execute(
            "UPDATE jams SET location = ?1 WHERE id = ?2",
            params![location, jam_id],
        )?;
    }
    if let Some(ref notes) = metadata.notes {
        conn.execute(
            "UPDATE jams SET notes = ?1 WHERE id = ?2",
            params![notes, jam_id],
        )?;
    }
    if let Some(ref patch_notes) = metadata.patch_notes {
        conn.execute(
            "UPDATE jams SET patch_notes = ?1 WHERE id = ?2",
            params![patch_notes, jam_id],
        )?;
    }
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

// ── Analysis CRUD ────────────────────────────────────────────

/// Get the analysis status for a jam.
pub fn get_analysis_status(conn: &Connection, jam_id: &str) -> Result<Option<AnalysisStatus>> {
    let mut stmt = conn.prepare(
        "SELECT jam_id, status, current_step, analysis_profile, error_message,
                retry_count, started_at, completed_at, updated_at
         FROM jam_analysis WHERE jam_id = ?1",
    )?;
    let mut rows = stmt.query_map(params![jam_id], |row| {
        Ok(AnalysisStatus {
            jam_id: row.get(0)?,
            status: row.get(1)?,
            current_step: row.get(2)?,
            analysis_profile: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "full".into()),
            error_message: row.get(4)?,
            retry_count: row.get(5)?,
            started_at: row.get(6)?,
            completed_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Insert or update analysis status for a jam.
pub fn set_analysis_status(
    conn: &Connection,
    jam_id: &str,
    status: &str,
    step: Option<&str>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO jam_analysis (jam_id, status, current_step, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(jam_id) DO UPDATE SET
            status = excluded.status,
            current_step = excluded.current_step,
            updated_at = datetime('now')",
        params![jam_id, status, step],
    )?;
    Ok(())
}

/// Save tempo result for a jam. Respects manual_override (D-18).
pub fn save_tempo_result(conn: &Connection, jam_id: &str, bpm: f64, confidence: f64) -> Result<()> {
    // Check for manual override -- never overwrite user-set values
    let has_override: bool = conn
        .query_row(
            "SELECT COALESCE(manual_override, 0) FROM jam_tempo WHERE jam_id = ?1",
            params![jam_id],
            |row| row.get::<_, i32>(0).map(|v| v != 0),
        )
        .unwrap_or(false);

    if has_override {
        return Ok(());
    }

    conn.execute(
        "INSERT OR REPLACE INTO jam_tempo (jam_id, bpm, confidence, created_at)
         VALUES (?1, ?2, ?3, datetime('now'))",
        params![jam_id, bpm, confidence],
    )?;
    Ok(())
}

/// Save key result for a jam. Respects manual_override (D-18).
pub fn save_key_result(
    conn: &Connection,
    jam_id: &str,
    key_name: &str,
    scale: &str,
    strength: f64,
) -> Result<()> {
    // Check for manual override -- never overwrite user-set values
    let has_override: bool = conn
        .query_row(
            "SELECT COALESCE(manual_override, 0) FROM jam_key WHERE jam_id = ?1",
            params![jam_id],
            |row| row.get::<_, i32>(0).map(|v| v != 0),
        )
        .unwrap_or(false);

    if has_override {
        return Ok(());
    }

    conn.execute(
        "INSERT OR REPLACE INTO jam_key (jam_id, key_name, scale, strength, created_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        params![jam_id, key_name, scale, strength],
    )?;
    Ok(())
}

/// Save section boundaries for a jam. Replaces existing sections.
pub fn save_sections(conn: &Connection, jam_id: &str, sections: &[SectionRecord]) -> Result<()> {
    conn.execute("DELETE FROM jam_sections WHERE jam_id = ?1", params![jam_id])?;
    for s in sections {
        conn.execute(
            "INSERT INTO jam_sections (id, jam_id, start_seconds, end_seconds, label, cluster_id, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
            params![s.id, jam_id, s.start_seconds, s.end_seconds, s.label, s.cluster_id, s.sort_order],
        )?;
    }
    Ok(())
}

/// Save detected loops for a jam. Replaces existing loops.
pub fn save_loops(conn: &Connection, jam_id: &str, loops: &[LoopRecord]) -> Result<()> {
    conn.execute("DELETE FROM jam_loops WHERE jam_id = ?1", params![jam_id])?;
    for l in loops {
        conn.execute(
            "INSERT INTO jam_loops (id, jam_id, start_seconds, end_seconds, repeat_count, evolving, label, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
            params![l.id, jam_id, l.start_seconds, l.end_seconds, l.repeat_count, l.evolving as i32, l.label, l.sort_order],
        )?;
    }
    Ok(())
}

/// Save beat positions for a jam. Replaces existing beats.
pub fn save_beats(conn: &Connection, jam_id: &str, beat_times: &[f64]) -> Result<()> {
    conn.execute("DELETE FROM jam_beats WHERE jam_id = ?1", params![jam_id])?;
    let mut stmt = conn.prepare(
        "INSERT INTO jam_beats (jam_id, beat_time) VALUES (?1, ?2)",
    )?;
    for &t in beat_times {
        stmt.execute(params![jam_id, t])?;
    }
    Ok(())
}

/// Get composite analysis results for a jam.
pub fn get_jam_analysis_results(conn: &Connection, jam_id: &str) -> Result<AnalysisResults> {
    let status = get_analysis_status(conn, jam_id)?;

    let tempo = {
        let mut stmt = conn.prepare(
            "SELECT jam_id, bpm, confidence, manual_override FROM jam_tempo WHERE jam_id = ?1",
        )?;
        let mut rows = stmt.query_map(params![jam_id], |row| {
            Ok(TempoResult {
                jam_id: row.get(0)?,
                bpm: row.get(1)?,
                confidence: row.get(2)?,
                manual_override: row.get::<_, i32>(3).map(|v| v != 0)?,
            })
        })?;
        match rows.next() {
            Some(r) => Some(r?),
            None => None,
        }
    };

    let key = {
        let mut stmt = conn.prepare(
            "SELECT jam_id, key_name, scale, strength, manual_override FROM jam_key WHERE jam_id = ?1",
        )?;
        let mut rows = stmt.query_map(params![jam_id], |row| {
            Ok(KeyResult {
                jam_id: row.get(0)?,
                key_name: row.get(1)?,
                scale: row.get(2)?,
                strength: row.get(3)?,
                manual_override: row.get::<_, i32>(4).map(|v| v != 0)?,
            })
        })?;
        match rows.next() {
            Some(r) => Some(r?),
            None => None,
        }
    };

    let sections = {
        let mut stmt = conn.prepare(
            "SELECT id, jam_id, start_seconds, end_seconds, label, cluster_id, sort_order
             FROM jam_sections WHERE jam_id = ?1 ORDER BY sort_order",
        )?;
        let rows = stmt.query_map(params![jam_id], |row| {
            Ok(SectionRecord {
                id: row.get(0)?,
                jam_id: row.get(1)?,
                start_seconds: row.get(2)?,
                end_seconds: row.get(3)?,
                label: row.get(4)?,
                cluster_id: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        v
    };

    let loops = {
        let mut stmt = conn.prepare(
            "SELECT id, jam_id, start_seconds, end_seconds, repeat_count, evolving, label, sort_order
             FROM jam_loops WHERE jam_id = ?1 ORDER BY sort_order",
        )?;
        let rows = stmt.query_map(params![jam_id], |row| {
            Ok(LoopRecord {
                id: row.get(0)?,
                jam_id: row.get(1)?,
                start_seconds: row.get(2)?,
                end_seconds: row.get(3)?,
                repeat_count: row.get(4)?,
                evolving: row.get::<_, i32>(5).map(|v| v != 0)?,
                label: row.get(6)?,
                sort_order: row.get(7)?,
            })
        })?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        v
    };

    Ok(AnalysisResults {
        status,
        tempo,
        key,
        sections,
        loops,
    })
}

/// Get jam IDs that need analysis (no status or status = 'pending').
pub fn get_pending_analysis_jams(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT j.id FROM jams j
         LEFT JOIN jam_analysis a ON j.id = a.jam_id
         WHERE a.jam_id IS NULL OR a.status = 'pending'
         ORDER BY j.imported_at DESC",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut ids = Vec::new();
    for r in rows {
        ids.push(r?);
    }
    Ok(ids)
}

/// Update the FTS5 search index entry for a jam.
pub fn update_fts_index(conn: &Connection, jam_id: &str) -> Result<()> {
    // First remove any existing entry
    conn.execute(
        "DELETE FROM jam_search WHERE jam_id = ?1",
        params![jam_id],
    )?;

    // Gather data from various tables
    let filename: String = conn
        .query_row("SELECT filename FROM jams WHERE id = ?1", params![jam_id], |row| {
            row.get(0)
        })
        .unwrap_or_default();

    let notes: String = conn
        .query_row(
            "SELECT COALESCE(notes, '') FROM jams WHERE id = ?1",
            params![jam_id],
            |row| row.get(0),
        )
        .unwrap_or_default();

    let location: String = conn
        .query_row(
            "SELECT COALESCE(location, '') FROM jams WHERE id = ?1",
            params![jam_id],
            |row| row.get(0),
        )
        .unwrap_or_default();

    // Aggregate tags
    let tags: String = {
        let mut stmt = conn.prepare("SELECT tag FROM jam_tags WHERE jam_id = ?1")?;
        let rows = stmt.query_map(params![jam_id], |row| row.get::<_, String>(0))?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        v.join(" ")
    };

    // Aggregate collaborators
    let collaborators: String = {
        let mut stmt = conn.prepare("SELECT name FROM jam_collaborators WHERE jam_id = ?1")?;
        let rows = stmt.query_map(params![jam_id], |row| row.get::<_, String>(0))?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        v.join(" ")
    };

    // Aggregate instruments
    let instruments: String = {
        let mut stmt = conn.prepare("SELECT name FROM jam_instruments WHERE jam_id = ?1")?;
        let rows = stmt.query_map(params![jam_id], |row| row.get::<_, String>(0))?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        v.join(" ")
    };

    conn.execute(
        "INSERT INTO jam_search (jam_id, filename, notes, tags, collaborators, instruments, location)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![jam_id, filename, notes, tags, collaborators, instruments, location],
    )?;

    Ok(())
}

/// Manually set tempo for a jam, marking it as a manual override (D-18).
pub fn set_manual_tempo(conn: &Connection, jam_id: &str, bpm: f64) -> Result<()> {
    conn.execute(
        "INSERT INTO jam_tempo (jam_id, bpm, confidence, manual_override, created_at)
         VALUES (?1, ?2, 1.0, 1, datetime('now'))
         ON CONFLICT(jam_id) DO UPDATE SET
            bpm = excluded.bpm,
            manual_override = 1,
            created_at = datetime('now')",
        params![jam_id, bpm],
    )?;
    Ok(())
}

/// Manually set key for a jam, marking it as a manual override (D-18).
pub fn set_manual_key(
    conn: &Connection,
    jam_id: &str,
    key_name: &str,
    scale: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO jam_key (jam_id, key_name, scale, strength, manual_override, created_at)
         VALUES (?1, ?2, ?3, 1.0, 1, datetime('now'))
         ON CONFLICT(jam_id) DO UPDATE SET
            key_name = excluded.key_name,
            scale = excluded.scale,
            manual_override = 1,
            created_at = datetime('now')",
        params![jam_id, key_name, scale],
    )?;
    Ok(())
}

/// Clear manual tempo override for a jam (D-18).
pub fn clear_manual_tempo(conn: &Connection, jam_id: &str) -> Result<()> {
    conn.execute("DELETE FROM jam_tempo WHERE jam_id = ?1", params![jam_id])?;
    Ok(())
}

/// Clear manual key override for a jam (D-18).
pub fn clear_manual_key(conn: &Connection, jam_id: &str) -> Result<()> {
    conn.execute("DELETE FROM jam_key WHERE jam_id = ?1", params![jam_id])?;
    Ok(())
}

// ── Search & Filter ─────────────────────────────────────────

/// Search and filter jams using the provided filter criteria.
/// All filters combine with AND logic (D-12). Free-text search
/// uses the FTS5 jam_search index (D-15).
pub fn search_jams(conn: &Connection, filter: &SearchFilter) -> Result<Vec<JamRecord>> {
    let mut joins = Vec::new();
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1usize;

    // Free-text search (D-15). Uses LIKE across searchable columns
    // since the FTS5 table is contentless (content='') and doesn't
    // support column value retrieval for JOIN correlation.
    if let Some(ref q) = filter.query {
        let trimmed = q.trim();
        if !trimmed.is_empty() {
            let like_pattern = format!("%{}%", trimmed);
            let p = param_idx;
            conditions.push(format!(
                "(j.filename LIKE ?{p} OR j.original_filename LIKE ?{p} OR j.notes LIKE ?{p} OR j.location LIKE ?{p} \
                 OR EXISTS (SELECT 1 FROM jam_tags WHERE jam_tags.jam_id = j.id AND jam_tags.tag LIKE ?{p}) \
                 OR EXISTS (SELECT 1 FROM jam_collaborators WHERE jam_collaborators.jam_id = j.id AND jam_collaborators.name LIKE ?{p}) \
                 OR EXISTS (SELECT 1 FROM jam_instruments WHERE jam_instruments.jam_id = j.id AND jam_instruments.name LIKE ?{p}))"
            ));
            param_values.push(Box::new(like_pattern));
            param_idx += 1;
        }
    }

    // Key filter (D-14) -- multi-select
    if let Some(ref keys) = filter.keys {
        if !keys.is_empty() {
            let placeholders: Vec<String> = keys
                .iter()
                .map(|_| {
                    let p = format!("?{}", param_idx);
                    param_idx += 1;
                    p
                })
                .collect();
            joins.push("INNER JOIN jam_key ON jam_key.jam_id = j.id".to_string());
            conditions.push(format!(
                "(jam_key.key_name || ' ' || jam_key.scale) IN ({})",
                placeholders.join(", ")
            ));
            for k in keys {
                param_values.push(Box::new(k.clone()));
            }
        }
    }

    // Tempo range filter (D-13)
    if filter.tempo_min.is_some() || filter.tempo_max.is_some() {
        // Only join if not already joined via key filter
        let already_has_tempo = joins.iter().any(|j| j.contains("jam_tempo"));
        if !already_has_tempo {
            joins.push("INNER JOIN jam_tempo ON jam_tempo.jam_id = j.id".to_string());
        }
        if let Some(min) = filter.tempo_min {
            conditions.push(format!("jam_tempo.bpm >= ?{}", param_idx));
            param_values.push(Box::new(min));
            param_idx += 1;
        }
        if let Some(max) = filter.tempo_max {
            conditions.push(format!("jam_tempo.bpm <= ?{}", param_idx));
            param_values.push(Box::new(max));
            param_idx += 1;
        }
    }

    // Tags filter
    if let Some(ref tags) = filter.tags {
        if !tags.is_empty() {
            let placeholders: Vec<String> = tags
                .iter()
                .map(|_| {
                    let p = format!("?{}", param_idx);
                    param_idx += 1;
                    p
                })
                .collect();
            joins.push("INNER JOIN jam_tags ON jam_tags.jam_id = j.id".to_string());
            conditions.push(format!(
                "jam_tags.tag IN ({})",
                placeholders.join(", ")
            ));
            for t in tags {
                param_values.push(Box::new(t.clone()));
            }
        }
    }

    // Collaborators filter
    if let Some(ref collabs) = filter.collaborators {
        if !collabs.is_empty() {
            let placeholders: Vec<String> = collabs
                .iter()
                .map(|_| {
                    let p = format!("?{}", param_idx);
                    param_idx += 1;
                    p
                })
                .collect();
            joins.push(
                "INNER JOIN jam_collaborators ON jam_collaborators.jam_id = j.id".to_string(),
            );
            conditions.push(format!(
                "jam_collaborators.name IN ({})",
                placeholders.join(", ")
            ));
            for c in collabs {
                param_values.push(Box::new(c.clone()));
            }
        }
    }

    // Instruments filter
    if let Some(ref instruments) = filter.instruments {
        if !instruments.is_empty() {
            let placeholders: Vec<String> = instruments
                .iter()
                .map(|_| {
                    let p = format!("?{}", param_idx);
                    param_idx += 1;
                    p
                })
                .collect();
            joins.push(
                "INNER JOIN jam_instruments ON jam_instruments.jam_id = j.id".to_string(),
            );
            conditions.push(format!(
                "jam_instruments.name IN ({})",
                placeholders.join(", ")
            ));
            for i in instruments {
                param_values.push(Box::new(i.clone()));
            }
        }
    }

    // Date range filter
    if let Some(ref date_from) = filter.date_from {
        conditions.push(format!("j.imported_at >= ?{}", param_idx));
        param_values.push(Box::new(date_from.clone()));
        param_idx += 1;
    }
    if let Some(ref date_to) = filter.date_to {
        conditions.push(format!("j.imported_at <= ?{}", param_idx));
        param_values.push(Box::new(date_to.clone()));
        param_idx += 1;
    }

    // Location filter (substring match)
    if let Some(ref loc) = filter.location {
        if !loc.trim().is_empty() {
            conditions.push(format!("j.location LIKE ?{}", param_idx));
            param_values.push(Box::new(format!("%{}%", loc)));
            let _ = param_idx; // suppress unused warning
        }
    }

    // Build the final query
    let join_clause = joins.join("\n");
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT DISTINCT j.id, j.filename, j.original_filename, j.content_hash, j.file_path,
                j.format, j.duration_seconds, j.sample_rate, j.bit_depth, j.channels,
                j.file_size_bytes, j.imported_at, j.created_at, j.location, j.notes,
                j.patch_notes, j.peaks_generated
         FROM jams j
         {}
         {}
         ORDER BY j.imported_at DESC",
        join_clause, where_clause
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_refs.as_slice(), |row| map_jam_row(row))?;

    let mut jams = Vec::new();
    for row in rows {
        jams.push(row?);
    }
    Ok(jams)
}

/// Get all distinct detected keys (as "KeyName Scale" strings) for filter options.
pub fn get_distinct_keys(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT DISTINCT key_name || ' ' || scale FROM jam_key ORDER BY key_name")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut keys = Vec::new();
    for r in rows {
        keys.push(r?);
    }
    Ok(keys)
}

/// Get the global BPM range across all analyzed jams.
pub fn get_tempo_range(conn: &Connection) -> Result<(f64, f64)> {
    let result = conn.query_row(
        "SELECT MIN(bpm), MAX(bpm) FROM jam_tempo",
        [],
        |row| {
            let min: Option<f64> = row.get(0)?;
            let max: Option<f64> = row.get(1)?;
            Ok((min.unwrap_or(60.0), max.unwrap_or(200.0)))
        },
    )?;
    Ok(result)
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
            original_filename: None,
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

    // ── V4 Analysis tests ─────────────────────────────────────

    #[test]
    fn test_v4_migration_creates_analysis_tables() {
        let db = Database::open_in_memory().unwrap();
        for table in &[
            "jam_analysis",
            "jam_tempo",
            "jam_key",
            "jam_sections",
            "jam_loops",
            "jam_beats",
            "jam_search",
        ] {
            let count: i64 = db
                .conn
                .query_row(
                    &format!(
                        "SELECT count(*) FROM sqlite_master WHERE (type='table' OR type='virtual table') AND name='{}'",
                        table
                    ),
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(count >= 1, "Table {} should exist", table);
        }
    }

    #[test]
    fn test_analysis_status_crud() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        // Initially no status
        let status = get_analysis_status(&db.conn, &record.id).unwrap();
        assert!(status.is_none());

        // Set status
        set_analysis_status(&db.conn, &record.id, "analyzing", Some("tempo")).unwrap();
        let status = get_analysis_status(&db.conn, &record.id).unwrap().unwrap();
        assert_eq!(status.status, "analyzing");
        assert_eq!(status.current_step, Some("tempo".into()));

        // Update status
        set_analysis_status(&db.conn, &record.id, "complete", None).unwrap();
        let status = get_analysis_status(&db.conn, &record.id).unwrap().unwrap();
        assert_eq!(status.status, "complete");
        assert_eq!(status.current_step, None);
    }

    #[test]
    fn test_save_tempo_result() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        save_tempo_result(&db.conn, &record.id, 120.0, 0.95).unwrap();
        let results = get_jam_analysis_results(&db.conn, &record.id).unwrap();
        let tempo = results.tempo.unwrap();
        assert_eq!(tempo.bpm, 120.0);
        assert_eq!(tempo.confidence, 0.95);
        assert!(!tempo.manual_override);
    }

    #[test]
    fn test_save_tempo_respects_manual_override() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        // Insert with manual override
        db.conn
            .execute(
                "INSERT INTO jam_tempo (jam_id, bpm, confidence, manual_override) VALUES (?1, 100.0, 1.0, 1)",
                params![record.id],
            )
            .unwrap();

        // Try to overwrite -- should be skipped
        save_tempo_result(&db.conn, &record.id, 120.0, 0.95).unwrap();
        let results = get_jam_analysis_results(&db.conn, &record.id).unwrap();
        assert_eq!(results.tempo.unwrap().bpm, 100.0); // unchanged
    }

    #[test]
    fn test_save_key_result() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        save_key_result(&db.conn, &record.id, "Bb", "minor", 0.87).unwrap();
        let results = get_jam_analysis_results(&db.conn, &record.id).unwrap();
        let key = results.key.unwrap();
        assert_eq!(key.key_name, "Bb");
        assert_eq!(key.scale, "minor");
    }

    #[test]
    fn test_save_sections() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let sections = vec![
            schema::SectionRecord {
                id: "s1".into(),
                jam_id: record.id.clone(),
                start_seconds: 0.0,
                end_seconds: 30.0,
                label: "intro".into(),
                cluster_id: 0,
                sort_order: 0,
            },
            schema::SectionRecord {
                id: "s2".into(),
                jam_id: record.id.clone(),
                start_seconds: 30.0,
                end_seconds: 90.0,
                label: "verse".into(),
                cluster_id: 1,
                sort_order: 1,
            },
        ];

        save_sections(&db.conn, &record.id, &sections).unwrap();
        let results = get_jam_analysis_results(&db.conn, &record.id).unwrap();
        assert_eq!(results.sections.len(), 2);
        assert_eq!(results.sections[0].label, "intro");
        assert_eq!(results.sections[1].label, "verse");
    }

    #[test]
    fn test_save_loops() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let loops = vec![schema::LoopRecord {
            id: "l1".into(),
            jam_id: record.id.clone(),
            start_seconds: 10.0,
            end_seconds: 18.0,
            repeat_count: 4,
            evolving: false,
            label: "synth loop A".into(),
            sort_order: 0,
        }];

        save_loops(&db.conn, &record.id, &loops).unwrap();
        let results = get_jam_analysis_results(&db.conn, &record.id).unwrap();
        assert_eq!(results.loops.len(), 1);
        assert_eq!(results.loops[0].repeat_count, 4);
    }

    #[test]
    fn test_save_beats() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();

        let beats = vec![0.0, 0.5, 1.0, 1.5, 2.0];
        save_beats(&db.conn, &record.id, &beats).unwrap();

        let count: i64 = db
            .conn
            .query_row(
                "SELECT count(*) FROM jam_beats WHERE jam_id = ?1",
                params![record.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 5);
    }

    #[test]
    fn test_get_pending_analysis_jams() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let r1 = insert_jam(&db.conn, &jam).unwrap();

        let jam2 = NewJam {
            content_hash: "different_hash".into(),
            filename: "jam2.wav".into(),
            ..test_jam()
        };
        let r2 = insert_jam(&db.conn, &jam2).unwrap();

        // Both should be pending (no analysis record)
        let pending = get_pending_analysis_jams(&db.conn).unwrap();
        assert_eq!(pending.len(), 2);

        // Mark one as complete
        set_analysis_status(&db.conn, &r1.id, "complete", None).unwrap();
        let pending = get_pending_analysis_jams(&db.conn).unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0], r2.id);
    }

    #[test]
    fn test_search_jams_no_filter() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        insert_jam(&db.conn, &jam).unwrap();

        let filter = SearchFilter::default();
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_jams_by_tempo_range() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        save_tempo_result(&db.conn, &record.id, 120.0, 0.9).unwrap();

        // Should match
        let filter = SearchFilter {
            tempo_min: Some(100.0),
            tempo_max: Some(140.0),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 1);

        // Should not match
        let filter = SearchFilter {
            tempo_min: Some(130.0),
            tempo_max: Some(200.0),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_jams_by_key() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        save_key_result(&db.conn, &record.id, "Bb", "minor", 0.87).unwrap();

        let filter = SearchFilter {
            keys: Some(vec!["Bb minor".into()]),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 1);

        let filter = SearchFilter {
            keys: Some(vec!["C major".into()]),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_jams_by_text_query() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        insert_tag(&db.conn, &record.id, "ambient").unwrap();

        // Search by tag
        let filter = SearchFilter {
            query: Some("ambient".into()),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 1);

        // Search by filename
        let filter = SearchFilter {
            query: Some("test-jam".into()),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 1);

        // No match
        let filter = SearchFilter {
            query: Some("nonexistent".into()),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_jams_combined_filters() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        save_tempo_result(&db.conn, &record.id, 120.0, 0.9).unwrap();
        save_key_result(&db.conn, &record.id, "Bb", "minor", 0.87).unwrap();
        insert_tag(&db.conn, &record.id, "ambient").unwrap();

        // Both match -> should find
        let filter = SearchFilter {
            keys: Some(vec!["Bb minor".into()]),
            tempo_min: Some(100.0),
            tempo_max: Some(140.0),
            tags: Some(vec!["ambient".into()]),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 1);

        // Key matches, tempo doesn't -> empty
        let filter = SearchFilter {
            keys: Some(vec!["Bb minor".into()]),
            tempo_min: Some(200.0),
            ..Default::default()
        };
        let results = search_jams(&db.conn, &filter).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_get_distinct_keys() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        save_key_result(&db.conn, &record.id, "Bb", "minor", 0.87).unwrap();

        let keys = get_distinct_keys(&db.conn).unwrap();
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0], "Bb minor");
    }

    #[test]
    fn test_get_tempo_range() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        save_tempo_result(&db.conn, &record.id, 120.0, 0.9).unwrap();

        let (min, max) = get_tempo_range(&db.conn).unwrap();
        assert_eq!(min, 120.0);
        assert_eq!(max, 120.0);
    }

    #[test]
    fn test_update_fts_index() {
        let db = Database::open_in_memory().unwrap();
        let jam = test_jam();
        let record = insert_jam(&db.conn, &jam).unwrap();
        insert_tag(&db.conn, &record.id, "ambient").unwrap();

        update_fts_index(&db.conn, &record.id).unwrap();

        // Search should find it
        let count: i64 = db
            .conn
            .query_row(
                "SELECT count(*) FROM jam_search WHERE jam_search MATCH 'ambient'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
