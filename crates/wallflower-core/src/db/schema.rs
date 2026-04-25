use serde::{Deserialize, Serialize};

/// A jam record as stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamRecord {
    pub id: String,
    pub filename: String,
    pub original_filename: String,
    pub content_hash: String,
    pub file_path: String,
    pub format: String,
    pub duration_seconds: Option<f64>,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub channels: Option<i32>,
    pub file_size_bytes: i64,
    pub imported_at: String,
    pub created_at: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub patch_notes: Option<String>,
    pub peaks_generated: bool,
}

/// A recording gap caused by device disconnect or other interruption.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingGap {
    pub id: String,
    pub jam_id: String,
    pub gap_start_seconds: f64,
    pub gap_end_seconds: f64,
    pub reason: String,
    pub created_at: String,
}

/// Data required to create a new jam record.
#[derive(Debug, Clone)]
pub struct NewJam {
    pub filename: String,
    pub original_filename: String,
    pub content_hash: String,
    pub file_path: String,
    pub format: String,
    pub duration_seconds: Option<f64>,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub channels: Option<i32>,
    pub file_size_bytes: i64,
    pub created_at: Option<String>,
}

/// A tag associated with a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamTag {
    pub id: String,
    pub jam_id: String,
    pub tag: String,
    pub created_at: String,
}

/// A collaborator associated with a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamCollaborator {
    pub id: String,
    pub jam_id: String,
    pub name: String,
    pub created_at: String,
}

/// An instrument associated with a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamInstrument {
    pub id: String,
    pub jam_id: String,
    pub name: String,
    pub created_at: String,
}

/// A photo associated with a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamPhoto {
    pub id: String,
    pub jam_id: String,
    pub filename: String,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub source: String,
    pub created_at: String,
}

/// Metadata fields that can be updated on a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JamMetadata {
    pub original_filename: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub patch_notes: Option<String>,
}

// ── Analysis types ───────────────────────────────────────────

/// Analysis status tracking for a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisStatus {
    pub jam_id: String,
    pub status: String, // "pending", "analyzing", "complete", "failed"
    pub current_step: Option<String>,
    pub analysis_profile: String,
    pub error_message: Option<String>,
    pub retry_count: i32,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub updated_at: String,
}

/// Tempo detection result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempoResult {
    pub jam_id: String,
    pub bpm: f64,
    pub confidence: f64,
    pub manual_override: bool,
}

/// Key detection result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyResult {
    pub jam_id: String,
    pub key_name: String,
    pub scale: String,
    pub strength: f64,
    pub manual_override: bool,
}

/// A detected section within a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionRecord {
    pub id: String,
    pub jam_id: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub label: String,
    pub cluster_id: i32,
    pub sort_order: i32,
}

/// A detected loop within a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopRecord {
    pub id: String,
    pub jam_id: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub repeat_count: i32,
    pub evolving: bool,
    pub label: String,
    pub sort_order: i32,
}

/// Composite analysis results for a jam.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResults {
    pub status: Option<AnalysisStatus>,
    pub tempo: Option<TempoResult>,
    pub key: Option<KeyResult>,
    pub sections: Vec<SectionRecord>,
    pub loops: Vec<LoopRecord>,
}

/// A jam with analysis and metadata combined for the spatial explorer.
/// Returned by the single-query spatial data endpoint to avoid N+1 queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpatialJam {
    pub id: String,
    pub filename: String,
    pub duration_seconds: Option<f64>,
    pub imported_at: String,
    pub created_at: Option<String>,
    // Analysis
    pub tempo_bpm: Option<f64>,
    pub key_name: Option<String>,
    pub key_scale: Option<String>,
    // Metadata
    pub tags: Vec<String>,
    pub collaborators: Vec<String>,
    pub instruments: Vec<String>,
}

/// A unified sample record representing a bookmark, section, or loop.
/// Used by the cross-jam sample browser to display all sample types
/// in a single sortable/filterable list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleRecord {
    pub id: String,
    pub sample_type: String, // "bookmark", "section", or "loop"
    pub jam_id: String,
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub color: Option<String>,     // bookmark color, null for sections/loops
    pub repeat_count: Option<i32>, // loop repeat count
    pub evolving: bool,            // loop evolving flag
    pub source_jam_name: String,
    pub jam_imported_at: String,
    pub key_display: Option<String>, // "C minor" or null
    pub tempo_bpm: Option<f64>,
    pub duration_seconds: f64,
    pub notes: Option<String>, // bookmark notes, jam notes for others
}

/// Filter criteria for the sample browser.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleFilter {
    pub query: Option<String>,
    pub types: Option<Vec<String>>, // ["bookmark", "section", "loop"]
    pub keys: Option<Vec<String>>,
    pub tempo_min: Option<f64>,
    pub tempo_max: Option<f64>,
    pub duration_min: Option<f64>,
    pub duration_max: Option<f64>,
    pub source_jam_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Available filter option values for the sample browser sidebar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleFilterOptions {
    pub keys: Vec<String>,
    pub tags: Vec<String>,
    pub jams: Vec<(String, String)>, // (id, original_filename)
    pub tempo_min: f64,
    pub tempo_max: f64,
    pub duration_min: f64,
    pub duration_max: f64,
}
