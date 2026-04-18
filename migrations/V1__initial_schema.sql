CREATE TABLE jams (
    id TEXT PRIMARY KEY NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('wav', 'flac', 'mp3')),
    duration_seconds REAL,
    sample_rate INTEGER,
    bit_depth INTEGER,
    channels INTEGER,
    file_size_bytes INTEGER NOT NULL,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT
);

CREATE INDEX idx_jams_content_hash ON jams(content_hash);
CREATE INDEX idx_jams_imported_at ON jams(imported_at);

CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
    ('watch_folder', '~/wallflower'),
    ('storage_dir', ''),
    ('duplicate_handling', 'skip');
