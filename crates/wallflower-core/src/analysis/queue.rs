use std::collections::VecDeque;

/// Priority level for analysis jobs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum JobPriority {
    /// Standard FIFO ordering.
    Normal,
    /// Currently viewed jam jumps to front (D-16).
    ViewPriority,
    /// Re-queued after recording stops (D-17).
    RecordingResume,
}

/// An analysis job in the queue.
#[derive(Debug, Clone)]
pub struct AnalysisJob {
    pub jam_id: String,
    pub audio_path: String,
    pub profile: super::provider::AnalysisProfile,
    pub priority: JobPriority,
}

/// A queue for analysis jobs with priority support.
pub struct AnalysisQueue {
    jobs: VecDeque<AnalysisJob>,
}

impl AnalysisQueue {
    pub fn new() -> Self {
        Self {
            jobs: VecDeque::new(),
        }
    }

    /// Add a job to the queue. High-priority jobs go to the front.
    pub fn enqueue(&mut self, job: AnalysisJob) {
        match job.priority {
            JobPriority::Normal => self.jobs.push_back(job),
            _ => self.jobs.push_front(job),
        }
    }

    /// Remove and return the next job from the front of the queue.
    pub fn dequeue(&mut self) -> Option<AnalysisJob> {
        self.jobs.pop_front()
    }

    /// Move a jam to the front of the queue (D-16: currently-viewed jam priority).
    pub fn prioritize(&mut self, jam_id: &str) {
        if let Some(pos) = self.jobs.iter().position(|j| j.jam_id == jam_id) {
            if let Some(mut job) = self.jobs.remove(pos) {
                job.priority = JobPriority::ViewPriority;
                self.jobs.push_front(job);
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        self.jobs.is_empty()
    }

    pub fn len(&self) -> usize {
        self.jobs.len()
    }

    pub fn clear(&mut self) {
        self.jobs.clear();
    }

    /// Drain all jobs from the queue (e.g., for re-queuing after recording).
    pub fn drain_all(&mut self) -> Vec<AnalysisJob> {
        self.jobs.drain(..).collect()
    }
}

impl Default for AnalysisQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::provider::AnalysisProfile;

    fn make_job(id: &str, priority: JobPriority) -> AnalysisJob {
        AnalysisJob {
            jam_id: id.to_string(),
            audio_path: format!("/audio/{}.wav", id),
            profile: AnalysisProfile::Full,
            priority,
        }
    }

    #[test]
    fn test_fifo_ordering() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.enqueue(make_job("b", JobPriority::Normal));
        q.enqueue(make_job("c", JobPriority::Normal));

        assert_eq!(q.dequeue().unwrap().jam_id, "a");
        assert_eq!(q.dequeue().unwrap().jam_id, "b");
        assert_eq!(q.dequeue().unwrap().jam_id, "c");
    }

    #[test]
    fn test_priority_jobs_go_to_front() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.enqueue(make_job("b", JobPriority::Normal));
        q.enqueue(make_job("c", JobPriority::ViewPriority));

        assert_eq!(q.dequeue().unwrap().jam_id, "c");
        assert_eq!(q.dequeue().unwrap().jam_id, "a");
    }

    #[test]
    fn test_prioritize_moves_to_front() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.enqueue(make_job("b", JobPriority::Normal));
        q.enqueue(make_job("c", JobPriority::Normal));

        q.prioritize("c");
        assert_eq!(q.dequeue().unwrap().jam_id, "c");
        assert_eq!(q.dequeue().unwrap().jam_id, "a");
    }

    #[test]
    fn test_drain_all() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.enqueue(make_job("b", JobPriority::Normal));

        let drained = q.drain_all();
        assert_eq!(drained.len(), 2);
        assert!(q.is_empty());
    }

    #[test]
    fn test_empty_queue() {
        let mut q = AnalysisQueue::new();
        assert!(q.is_empty());
        assert_eq!(q.len(), 0);
        assert!(q.dequeue().is_none());
    }
}
