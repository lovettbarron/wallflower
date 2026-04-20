-- V5: Bookmarks, exports, and stem cache tables

-- Bookmarks: user-created time markers on jams
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    color TEXT NOT NULL DEFAULT 'coral',
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_jam_id ON bookmarks(jam_id);

-- Exports: records of exported audio files
CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL,
    export_path TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'wav',
    bit_depth INTEGER NOT NULL DEFAULT 24,
    model_name TEXT,
    metadata_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exports_bookmark_id ON exports(bookmark_id);

-- Stem cache: cached separation results for re-export
CREATE TABLE IF NOT EXISTS stem_cache (
    id TEXT PRIMARY KEY,
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    stem_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    audio_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(bookmark_id, model_name, stem_name)
);
CREATE INDEX IF NOT EXISTS idx_stem_cache_bookmark_model ON stem_cache(bookmark_id, model_name);

PRAGMA user_version = 5;
