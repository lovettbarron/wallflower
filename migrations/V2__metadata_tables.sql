-- V2: Metadata tables for tags, collaborators, instruments, photos
-- Plus additional columns on jams table

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO schema_version (version) VALUES (2);

-- Add metadata columns to jams
ALTER TABLE jams ADD COLUMN location TEXT;
ALTER TABLE jams ADD COLUMN notes TEXT;
ALTER TABLE jams ADD COLUMN patch_notes TEXT;
ALTER TABLE jams ADD COLUMN peaks_generated INTEGER NOT NULL DEFAULT 0;

-- Tags (free-form, many-to-many)
CREATE TABLE jam_tags (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_jam_tags_jam_id ON jam_tags(jam_id);
CREATE INDEX idx_jam_tags_tag ON jam_tags(tag);

-- Collaborators
CREATE TABLE jam_collaborators (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_jam_collaborators_jam_id ON jam_collaborators(jam_id);

-- Instruments
CREATE TABLE jam_instruments (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_jam_instruments_jam_id ON jam_instruments(jam_id);

-- Photos
CREATE TABLE jam_photos (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    source TEXT NOT NULL CHECK(source IN ('drop', 'patches_folder')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_jam_photos_jam_id ON jam_photos(jam_id);
