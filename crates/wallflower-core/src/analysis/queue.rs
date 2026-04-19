use std::collections::VecDeque;

#[derive(Debug, Clone)]
pub struct AnalysisJob {
    pub jam_id: String,
    pub audio_path: String,
    pub profile: super::provider::AnalysisProfile,
    pub priority: JobPriority,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum JobPriority {
    Normal,           // FIFO
    ViewPriority,     // Currently viewed jam (D-16)
    RecordingResume,  // Re-queued after recording stops (D-17)
}

pub struct AnalysisQueue {
    jobs: VecDeque<AnalysisJob>,
}

impl AnalysisQueue {
    pub fn new() -> Self {
        Self {
            jobs: VecDeque::new(),
        }
    }

    pub fn enqueue(&mut self, job: AnalysisJob) {
        match job.priority {
            JobPriority::Normal => self.jobs.push_back(job),
            _ => self.jobs.push_front(job),
        }
    }

    pub fn dequeue(&mut self) -> Option<AnalysisJob> {
        self.jobs.pop_front()
    }

    pub fn prioritize(&mut self, jam_id: &str) {
        if let Some(pos) = self.jobs.iter().position(|j| j.jam_id == jam_id) {
            let job = self.jobs.remove(pos).unwrap();
            let mut prioritized = job;
            prioritized.priority = JobPriority::ViewPriority;
            self.jobs.push_front(prioritized);
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

    fn make_job(jam_id: &str, priority: JobPriority) -> AnalysisJob {
        AnalysisJob {
            jam_id: jam_id.to_string(),
            audio_path: format!("/audio/{}.wav", jam_id),
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

        assert_eq!(q.len(), 3);
        assert_eq!(q.dequeue().unwrap().jam_id, "a");
        assert_eq!(q.dequeue().unwrap().jam_id, "b");
        assert_eq!(q.dequeue().unwrap().jam_id, "c");
        assert!(q.is_empty());
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
    fn test_prioritize_existing_job() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.enqueue(make_job("b", JobPriority::Normal));
        q.enqueue(make_job("c", JobPriority::Normal));

        q.prioritize("c");

        assert_eq!(q.dequeue().unwrap().jam_id, "c");
        assert_eq!(q.dequeue().unwrap().jam_id, "a");
        assert_eq!(q.dequeue().unwrap().jam_id, "b");
    }

    #[test]
    fn test_prioritize_nonexistent_is_noop() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.prioritize("nonexistent");
        assert_eq!(q.len(), 1);
    }

    #[test]
    fn test_drain_all() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.enqueue(make_job("b", JobPriority::Normal));

        let all = q.drain_all();
        assert_eq!(all.len(), 2);
        assert!(q.is_empty());
    }

    #[test]
    fn test_clear() {
        let mut q = AnalysisQueue::new();
        q.enqueue(make_job("a", JobPriority::Normal));
        q.clear();
        assert!(q.is_empty());
    }
}
