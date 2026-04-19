use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Priority scheduler that gates background processing during active recording.
///
/// When recording is active, `may_proceed()` returns false, signaling
/// background tasks (ML analysis, source separation) to pause.
#[derive(Debug, Clone)]
pub struct PriorityScheduler {
    recording_active: Arc<AtomicBool>,
}

impl PriorityScheduler {
    /// Create a new scheduler with recording inactive.
    pub fn new() -> Self {
        Self {
            recording_active: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Set the recording state. When true, background tasks should pause.
    pub fn set_recording(&self, active: bool) {
        self.recording_active.store(active, Ordering::Release);
    }

    /// Check if recording is currently active.
    pub fn is_recording(&self) -> bool {
        self.recording_active.load(Ordering::Acquire)
    }

    /// Returns true if background tasks may proceed (recording is NOT active).
    pub fn may_proceed(&self) -> bool {
        !self.is_recording()
    }
}

impl Default for PriorityScheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_scheduler_not_recording() {
        let scheduler = PriorityScheduler::new();
        assert!(!scheduler.is_recording());
        assert!(scheduler.may_proceed());
    }

    #[test]
    fn test_set_recording_true_blocks_background() {
        let scheduler = PriorityScheduler::new();
        scheduler.set_recording(true);
        assert!(scheduler.is_recording());
        assert!(!scheduler.may_proceed());
    }

    #[test]
    fn test_set_recording_false_allows_background() {
        let scheduler = PriorityScheduler::new();
        scheduler.set_recording(true);
        scheduler.set_recording(false);
        assert!(!scheduler.is_recording());
        assert!(scheduler.may_proceed());
    }

    #[test]
    fn test_clone_shares_state() {
        let scheduler = PriorityScheduler::new();
        let clone = scheduler.clone();
        scheduler.set_recording(true);
        assert!(clone.is_recording());
        assert!(!clone.may_proceed());
    }
}
