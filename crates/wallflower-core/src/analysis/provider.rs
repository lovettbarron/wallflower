use crate::db::schema::{KeyResult, LoopRecord, SectionRecord, TempoResult};
use async_trait::async_trait;

/// Analysis profile controlling which steps run and at what quality.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnalysisProfile {
    Full,
    Standard,
    Lightweight,
}

/// Abstraction for analysis backends. Per AI-08: swapping a model requires
/// only a configuration change, not code changes.
#[async_trait]
pub trait AnalysisProvider: Send + Sync {
    async fn analyze_tempo(&self, audio_path: &str) -> anyhow::Result<TempoResult>;
    async fn analyze_key(&self, audio_path: &str) -> anyhow::Result<KeyResult>;
    async fn analyze_sections(&self, audio_path: &str) -> anyhow::Result<Vec<SectionRecord>>;
    async fn analyze_loops(&self, audio_path: &str) -> anyhow::Result<Vec<LoopRecord>>;
    async fn is_healthy(&self) -> bool;
}
