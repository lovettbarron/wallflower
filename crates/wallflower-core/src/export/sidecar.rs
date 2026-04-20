use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportSidecar {
    pub wallflower_version: String,
    pub source_jam: SourceJamInfo,
    pub bookmark: BookmarkInfo,
    pub analysis: AnalysisInfo,
    pub export: ExportInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceJamInfo {
    pub name: String,
    pub id: String,
    pub duration_seconds: f64,
    pub recorded_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BookmarkInfo {
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisInfo {
    pub key: Option<String>,
    pub bpm: Option<f64>,
    pub tags: Vec<String>,
    pub collaborators: Vec<String>,
    pub instruments: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportInfo {
    pub format: String,
    pub bit_depth: i32,
    pub sample_rate: u32,
    pub channels: u16,
    pub stems: Option<Vec<String>>,
    pub model: Option<String>,
    pub exported_at: String,
}

/// Generate a JSON sidecar file alongside an export.
/// Uses atomic write: temp file + rename.
pub fn generate_sidecar(
    sidecar: &ExportSidecar,
    path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let json = serde_json::to_string_pretty(sidecar)?;
    // Atomic write: temp file + rename
    let temp = path.with_extension("json.tmp");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&temp, &json)?;
    std::fs::rename(&temp, path)?;
    Ok(())
}
