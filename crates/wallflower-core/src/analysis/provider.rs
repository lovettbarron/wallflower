use crate::db::schema::{KeyResult, LoopRecord, SectionRecord, TempoResult};
use crate::error::Result;

/// Analysis profile controlling which steps run and at what quality.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnalysisProfile {
    Full,
    Standard,
    Lightweight,
}

impl AnalysisProfile {
    pub fn as_str(&self) -> &'static str {
        match self {
            AnalysisProfile::Full => "full",
            AnalysisProfile::Standard => "standard",
            AnalysisProfile::Lightweight => "lightweight",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "standard" => AnalysisProfile::Standard,
            "lightweight" => AnalysisProfile::Lightweight,
            _ => AnalysisProfile::Full,
        }
    }
}

/// Abstraction for analysis backends. Per AI-08: swapping a model requires
/// only a configuration change, not code changes.
pub trait AnalysisProvider: Send + Sync {
    fn analyze_tempo(&self, audio_path: &str) -> Result<TempoResult>;
    fn analyze_key(&self, audio_path: &str) -> Result<KeyResult>;
    fn analyze_sections(&self, audio_path: &str) -> Result<Vec<SectionRecord>>;
    fn analyze_loops(&self, audio_path: &str) -> Result<Vec<LoopRecord>>;
    fn is_healthy(&self) -> bool;
}
