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
    pub location: Option<String>,
    pub notes: Option<String>,
    pub patch_notes: Option<String>,
}

// ── Analysis types (V4) ──────────────────────────────────────

/// Analysis status for a jam.
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

/// Tempo analysis result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempoResult {
    pub jam_id: String,
    pub bpm: f64,
    pub confidence: f64,
    pub manual_override: bool,
}

/// Key analysis result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyResult {
    pub jam_id: String,
    pub key_name: String,
    pub scale: String,
    pub strength: f64,
    pub manual_override: bool,
}

/// A section boundary within a jam.
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
