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
