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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_sidecar() -> ExportSidecar {
        ExportSidecar {
            wallflower_version: "0.1.0".to_string(),
            source_jam: SourceJamInfo {
                name: "Sunday Jam".to_string(),
                id: "jam-123".to_string(),
                duration_seconds: 3600.0,
                recorded_at: Some("2026-04-20T10:00:00Z".to_string()),
            },
            bookmark: BookmarkInfo {
                name: "Cool Riff".to_string(),
                start_seconds: 120.0,
                end_seconds: 150.0,
                notes: Some("Nice bass line".to_string()),
            },
            analysis: AnalysisInfo {
                key: Some("Bb minor".to_string()),
                bpm: Some(120.0),
                tags: vec!["ambient".to_string()],
                collaborators: vec!["Alice".to_string()],
                instruments: vec!["synth".to_string(), "drums".to_string()],
            },
            export: ExportInfo {
                format: "wav".to_string(),
                bit_depth: 24,
                sample_rate: 44100,
                channels: 2,
                stems: None,
                model: None,
                exported_at: "2026-04-20T11:00:00Z".to_string(),
            },
        }
    }

    #[test]
    fn test_generate_sidecar_produces_valid_json() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("export.json");
        let sidecar = sample_sidecar();

        generate_sidecar(&sidecar, &path).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(parsed["wallflower_version"], "0.1.0");
        assert_eq!(parsed["source_jam"]["name"], "Sunday Jam");
        assert_eq!(parsed["source_jam"]["id"], "jam-123");
        assert_eq!(parsed["bookmark"]["name"], "Cool Riff");
        assert_eq!(parsed["bookmark"]["start_seconds"], 120.0);
        assert_eq!(parsed["bookmark"]["end_seconds"], 150.0);
        assert_eq!(parsed["analysis"]["key"], "Bb minor");
        assert_eq!(parsed["analysis"]["bpm"], 120.0);
        assert_eq!(parsed["analysis"]["tags"][0], "ambient");
        assert_eq!(parsed["analysis"]["collaborators"][0], "Alice");
        assert_eq!(parsed["analysis"]["instruments"][0], "synth");
        assert_eq!(parsed["export"]["format"], "wav");
        assert_eq!(parsed["export"]["bit_depth"], 24);
        assert_eq!(parsed["export"]["sample_rate"], 44100);
        assert_eq!(parsed["export"]["channels"], 2);
    }
}
