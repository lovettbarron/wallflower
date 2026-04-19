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
