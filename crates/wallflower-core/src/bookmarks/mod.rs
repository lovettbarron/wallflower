pub mod schema;

use crate::error::Result;
use rusqlite::{params, Connection};
use schema::{
    BookmarkRecord, CreateBookmark, ExportRecord, StemCacheRecord, UpdateBookmark,
};
use uuid::Uuid;

/// Create a new bookmark on a jam.
pub fn create_bookmark(conn: &Connection, input: CreateBookmark) -> Result<BookmarkRecord> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO bookmarks (id, jam_id, name, start_seconds, end_seconds, color, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.jam_id,
            input.name,
            input.start_seconds,
            input.end_seconds,
            input.color,
            input.notes,
        ],
    )?;
    get_bookmark(conn, &id)
}

/// Get all bookmarks for a jam, sorted by sort_order then start_seconds.
pub fn get_bookmarks_for_jam(conn: &Connection, jam_id: &str) -> Result<Vec<BookmarkRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, jam_id, name, start_seconds, end_seconds, color, notes, sort_order, created_at, updated_at
         FROM bookmarks WHERE jam_id = ?1 ORDER BY sort_order, start_seconds",
    )?;
    let rows = stmt.query_map(params![jam_id], |row| {
        Ok(BookmarkRecord {
            id: row.get(0)?,
            jam_id: row.get(1)?,
            name: row.get(2)?,
            start_seconds: row.get(3)?,
            end_seconds: row.get(4)?,
            color: row.get(5)?,
            notes: row.get(6)?,
            sort_order: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;
    let mut bookmarks = Vec::new();
    for row in rows {
        bookmarks.push(row?);
    }
    Ok(bookmarks)
}

/// Get a single bookmark by id.
pub fn get_bookmark(conn: &Connection, id: &str) -> Result<BookmarkRecord> {
    let bookmark = conn.query_row(
        "SELECT id, jam_id, name, start_seconds, end_seconds, color, notes, sort_order, created_at, updated_at
         FROM bookmarks WHERE id = ?1",
        params![id],
        |row| {
            Ok(BookmarkRecord {
                id: row.get(0)?,
                jam_id: row.get(1)?,
                name: row.get(2)?,
                start_seconds: row.get(3)?,
                end_seconds: row.get(4)?,
                color: row.get(5)?,
                notes: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )?;
    Ok(bookmark)
}

/// Update a bookmark. Only non-None fields are updated.
pub fn update_bookmark(
    conn: &Connection,
    id: &str,
    input: UpdateBookmark,
) -> Result<BookmarkRecord> {
    // Build dynamic update
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref name) = input.name {
        sets.push("name = ?");
        values.push(Box::new(name.clone()));
    }
    if let Some(start) = input.start_seconds {
        sets.push("start_seconds = ?");
        values.push(Box::new(start));
    }
    if let Some(end) = input.end_seconds {
        sets.push("end_seconds = ?");
        values.push(Box::new(end));
    }
    if let Some(ref color) = input.color {
        sets.push("color = ?");
        values.push(Box::new(color.clone()));
    }
    if let Some(ref notes) = input.notes {
        sets.push("notes = ?");
        values.push(Box::new(notes.clone()));
    }
    if let Some(sort_order) = input.sort_order {
        sets.push("sort_order = ?");
        values.push(Box::new(sort_order));
    }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now')");
        let sql = format!("UPDATE bookmarks SET {} WHERE id = ?", sets.join(", "));
        values.push(Box::new(id.to_string()));
        let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params.as_slice())?;
    }

    get_bookmark(conn, id)
}

/// Delete a bookmark by id. Cascade deletes associated exports and stem_cache.
pub fn delete_bookmark(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![id])?;
    Ok(())
}

/// Create an export record for a bookmark.
pub fn create_export_record(
    conn: &Connection,
    bookmark_id: &str,
    export_type: &str,
    export_path: &str,
    format: &str,
    bit_depth: i32,
    model_name: Option<&str>,
    metadata_path: Option<&str>,
) -> Result<ExportRecord> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO exports (id, bookmark_id, export_type, export_path, format, bit_depth, model_name, metadata_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, bookmark_id, export_type, export_path, format, bit_depth, model_name, metadata_path],
    )?;
    let record = conn.query_row(
        "SELECT id, bookmark_id, export_type, export_path, format, bit_depth, model_name, metadata_path, created_at
         FROM exports WHERE id = ?1",
        params![id],
        |row| {
            Ok(ExportRecord {
                id: row.get(0)?,
                bookmark_id: row.get(1)?,
                export_type: row.get(2)?,
                export_path: row.get(3)?,
                format: row.get(4)?,
                bit_depth: row.get(5)?,
                model_name: row.get(6)?,
                metadata_path: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )?;
    Ok(record)
}

/// Get all exports for a bookmark, sorted by created_at descending.
pub fn get_exports_for_bookmark(
    conn: &Connection,
    bookmark_id: &str,
) -> Result<Vec<ExportRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, bookmark_id, export_type, export_path, format, bit_depth, model_name, metadata_path, created_at
         FROM exports WHERE bookmark_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![bookmark_id], |row| {
        Ok(ExportRecord {
            id: row.get(0)?,
            bookmark_id: row.get(1)?,
            export_type: row.get(2)?,
            export_path: row.get(3)?,
            format: row.get(4)?,
            bit_depth: row.get(5)?,
            model_name: row.get(6)?,
            metadata_path: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;
    let mut exports = Vec::new();
    for row in rows {
        exports.push(row?);
    }
    Ok(exports)
}

/// Get cached stems for a bookmark and model.
pub fn get_stem_cache(
    conn: &Connection,
    bookmark_id: &str,
    model_name: &str,
) -> Result<Vec<StemCacheRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, bookmark_id, model_name, stem_name, file_path, file_size_bytes, audio_hash, created_at
         FROM stem_cache WHERE bookmark_id = ?1 AND model_name = ?2",
    )?;
    let rows = stmt.query_map(params![bookmark_id, model_name], |row| {
        Ok(StemCacheRecord {
            id: row.get(0)?,
            bookmark_id: row.get(1)?,
            model_name: row.get(2)?,
            stem_name: row.get(3)?,
            file_path: row.get(4)?,
            file_size_bytes: row.get(5)?,
            audio_hash: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut stems = Vec::new();
    for row in rows {
        stems.push(row?);
    }
    Ok(stems)
}

/// Save or update a stem cache entry (upsert on unique constraint).
pub fn save_stem_cache(
    conn: &Connection,
    bookmark_id: &str,
    model_name: &str,
    stem_name: &str,
    file_path: &str,
    file_size_bytes: i64,
    audio_hash: Option<&str>,
) -> Result<StemCacheRecord> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR REPLACE INTO stem_cache (id, bookmark_id, model_name, stem_name, file_path, file_size_bytes, audio_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, bookmark_id, model_name, stem_name, file_path, file_size_bytes, audio_hash],
    )?;
    let record = conn.query_row(
        "SELECT id, bookmark_id, model_name, stem_name, file_path, file_size_bytes, audio_hash, created_at
         FROM stem_cache WHERE bookmark_id = ?1 AND model_name = ?2 AND stem_name = ?3",
        params![bookmark_id, model_name, stem_name],
        |row| {
            Ok(StemCacheRecord {
                id: row.get(0)?,
                bookmark_id: row.get(1)?,
                model_name: row.get(2)?,
                stem_name: row.get(3)?,
                file_path: row.get(4)?,
                file_size_bytes: row.get(5)?,
                audio_hash: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )?;
    Ok(record)
}

/// Invalidate all cached stems for a bookmark (e.g., when bookmark time range changes).
pub fn invalidate_stem_cache(conn: &Connection, bookmark_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM stem_cache WHERE bookmark_id = ?1",
        params![bookmark_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn setup_db() -> Database {
        let db = Database::open_in_memory().unwrap();
        // Insert a test jam for foreign key constraints
        db.conn
            .execute(
                "INSERT INTO jams (id, filename, original_filename, content_hash, file_path, format, file_size_bytes, imported_at)
                 VALUES ('jam-1', 'test.wav', 'test.wav', 'hash123', '/path/test.wav', 'wav', 1024, datetime('now'))",
                [],
            )
            .unwrap();
        db
    }

    #[test]
    fn test_create_bookmark() {
        let db = setup_db();
        let input = CreateBookmark {
            jam_id: "jam-1".to_string(),
            name: "Cool riff".to_string(),
            start_seconds: 10.0,
            end_seconds: 20.0,
            color: "coral".to_string(),
            notes: Some("Nice bass line".to_string()),
        };
        let bookmark = create_bookmark(&db.conn, input).unwrap();
        assert_eq!(bookmark.jam_id, "jam-1");
        assert_eq!(bookmark.name, "Cool riff");
        assert_eq!(bookmark.start_seconds, 10.0);
        assert_eq!(bookmark.end_seconds, 20.0);
        assert_eq!(bookmark.color, "coral");
        assert_eq!(bookmark.notes, Some("Nice bass line".to_string()));
        assert_eq!(bookmark.sort_order, 0);
        assert!(!bookmark.id.is_empty());
    }

    #[test]
    fn test_get_bookmarks_for_jam_sorted() {
        let db = setup_db();
        // Create bookmarks with different sort_orders and start times
        create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "Second".to_string(),
                start_seconds: 30.0,
                end_seconds: 40.0,
                color: "blue".to_string(),
                notes: None,
            },
        )
        .unwrap();
        create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "First".to_string(),
                start_seconds: 10.0,
                end_seconds: 20.0,
                color: "coral".to_string(),
                notes: None,
            },
        )
        .unwrap();

        let bookmarks = get_bookmarks_for_jam(&db.conn, "jam-1").unwrap();
        assert_eq!(bookmarks.len(), 2);
        // Both have sort_order 0, so sorted by start_seconds
        assert_eq!(bookmarks[0].name, "First");
        assert_eq!(bookmarks[1].name, "Second");
    }

    #[test]
    fn test_get_bookmark() {
        let db = setup_db();
        let created = create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "Test".to_string(),
                start_seconds: 5.0,
                end_seconds: 15.0,
                color: "green".to_string(),
                notes: None,
            },
        )
        .unwrap();

        let fetched = get_bookmark(&db.conn, &created.id).unwrap();
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "Test");
    }

    #[test]
    fn test_update_bookmark() {
        let db = setup_db();
        let created = create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "Original".to_string(),
                start_seconds: 5.0,
                end_seconds: 15.0,
                color: "coral".to_string(),
                notes: None,
            },
        )
        .unwrap();

        let updated = update_bookmark(
            &db.conn,
            &created.id,
            UpdateBookmark {
                name: Some("Updated".to_string()),
                start_seconds: Some(7.0),
                end_seconds: Some(17.0),
                color: Some("blue".to_string()),
                notes: Some("New notes".to_string()),
                sort_order: Some(1),
            },
        )
        .unwrap();

        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.start_seconds, 7.0);
        assert_eq!(updated.end_seconds, 17.0);
        assert_eq!(updated.color, "blue");
        assert_eq!(updated.notes, Some("New notes".to_string()));
        assert_eq!(updated.sort_order, 1);
        // updated_at should be set (may equal created_at if same second)
        assert!(!updated.updated_at.is_empty());
    }

    #[test]
    fn test_delete_bookmark_cascades() {
        let db = setup_db();
        let bookmark = create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "To delete".to_string(),
                start_seconds: 0.0,
                end_seconds: 10.0,
                color: "coral".to_string(),
                notes: None,
            },
        )
        .unwrap();

        // Create an export and stem cache entry
        create_export_record(
            &db.conn,
            &bookmark.id,
            "audio",
            "/path/export.wav",
            "wav",
            24,
            None,
            None,
        )
        .unwrap();
        save_stem_cache(
            &db.conn,
            &bookmark.id,
            "htdemucs",
            "drums",
            "/path/drums.wav",
            1024,
            None,
        )
        .unwrap();

        // Delete the bookmark
        delete_bookmark(&db.conn, &bookmark.id).unwrap();

        // Exports and stem_cache should be cascaded
        let exports = get_exports_for_bookmark(&db.conn, &bookmark.id).unwrap();
        assert!(exports.is_empty());
        let stems = get_stem_cache(&db.conn, &bookmark.id, "htdemucs").unwrap();
        assert!(stems.is_empty());
    }

    #[test]
    fn test_create_export_record() {
        let db = setup_db();
        let bookmark = create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "Export test".to_string(),
                start_seconds: 0.0,
                end_seconds: 10.0,
                color: "coral".to_string(),
                notes: None,
            },
        )
        .unwrap();

        let export = create_export_record(
            &db.conn,
            &bookmark.id,
            "audio",
            "/path/export.wav",
            "wav",
            24,
            None,
            Some("/path/export.json"),
        )
        .unwrap();

        assert_eq!(export.bookmark_id, bookmark.id);
        assert_eq!(export.export_type, "audio");
        assert_eq!(export.bit_depth, 24);
        assert_eq!(export.metadata_path, Some("/path/export.json".to_string()));
    }

    #[test]
    fn test_get_exports_for_bookmark() {
        let db = setup_db();
        let bookmark = create_bookmark(
            &db.conn,
            CreateBookmark {
                jam_id: "jam-1".to_string(),
                name: "Exports test".to_string(),
                start_seconds: 0.0,
                end_seconds: 10.0,
                color: "coral".to_string(),
                notes: None,
            },
        )
        .unwrap();

        create_export_record(
            &db.conn,
            &bookmark.id,
            "audio",
            "/path/export1.wav",
            "wav",
            24,
            None,
            None,
        )
        .unwrap();
        create_export_record(
            &db.conn,
            &bookmark.id,
            "stems",
            "/path/export2.wav",
            "wav",
            24,
            Some("htdemucs"),
            None,
        )
        .unwrap();

        let exports = get_exports_for_bookmark(&db.conn, &bookmark.id).unwrap();
        assert_eq!(exports.len(), 2);
        // Sorted by created_at DESC -- most recent first
    }
}
