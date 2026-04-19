-- V3: Recording support tables
CREATE TABLE IF NOT EXISTS recording_gaps (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    gap_start_seconds REAL NOT NULL,
    gap_end_seconds REAL NOT NULL,
    reason TEXT NOT NULL DEFAULT 'device_disconnect',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recording_gaps_jam_id ON recording_gaps(jam_id);
