-- V4: Analysis result tables for ML pipeline

-- Analysis status per jam
CREATE TABLE IF NOT EXISTS jam_analysis (
    jam_id TEXT PRIMARY KEY REFERENCES jams(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    current_step TEXT,
    analysis_profile TEXT DEFAULT 'full',
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tempo results
CREATE TABLE IF NOT EXISTS jam_tempo (
    jam_id TEXT PRIMARY KEY REFERENCES jams(id) ON DELETE CASCADE,
    bpm REAL NOT NULL,
    confidence REAL NOT NULL,
    manual_override INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key results
CREATE TABLE IF NOT EXISTS jam_key (
    jam_id TEXT PRIMARY KEY REFERENCES jams(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    scale TEXT NOT NULL,
    strength REAL NOT NULL,
    manual_override INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Section boundaries
CREATE TABLE IF NOT EXISTS jam_sections (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    label TEXT NOT NULL,
    cluster_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jam_sections_jam_id ON jam_sections(jam_id);

-- Detected loops
CREATE TABLE IF NOT EXISTS jam_loops (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    repeat_count INTEGER NOT NULL DEFAULT 1,
    evolving INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jam_loops_jam_id ON jam_loops(jam_id);

-- Beat positions
CREATE TABLE IF NOT EXISTS jam_beats (
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    beat_time REAL NOT NULL,
    PRIMARY KEY (jam_id, beat_time)
);

-- Full-text search index for META-08
CREATE VIRTUAL TABLE IF NOT EXISTS jam_search USING fts5(
    jam_id UNINDEXED,
    filename,
    notes,
    tags,
    collaborators,
    instruments,
    location,
    content='',
    tokenize='porter'
);

PRAGMA user_version = 4;
