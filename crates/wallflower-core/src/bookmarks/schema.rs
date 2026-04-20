use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkRecord {
    pub id: String,
    pub jam_id: String,
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub color: String,
    pub notes: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBookmark {
    pub jam_id: String,
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub color: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBookmark {
    pub name: Option<String>,
    pub start_seconds: Option<f64>,
    pub end_seconds: Option<f64>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRecord {
    pub id: String,
    pub bookmark_id: String,
    pub export_type: String,
    pub export_path: String,
    pub format: String,
    pub bit_depth: i32,
    pub model_name: Option<String>,
    pub metadata_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemCacheRecord {
    pub id: String,
    pub bookmark_id: String,
    pub model_name: String,
    pub stem_name: String,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub audio_hash: Option<String>,
    pub created_at: String,
}
