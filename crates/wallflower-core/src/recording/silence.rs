use serde::{Deserialize, Serialize};

/// Events emitted by the silence detector.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SilenceEvent {
    /// Silence started at the given sample offset.
    Start { offset_samples: u64 },
    /// Silence ended at the given sample offset.
    End { offset_samples: u64 },
}

/// RMS-based silence detection with configurable threshold.
///
/// Processes interleaved audio buffers and emits events when the signal
/// transitions between silence and non-silence states.
#[derive(Debug)]
pub struct SilenceDetector {
    /// RMS threshold in linear scale (converted from dB at construction).
    threshold_rms: f32,
    /// Whether we are currently in a silence region.
    in_silence: bool,
    /// Sample offset where the current silence region started.
    silence_start_sample: u64,
    /// Minimum number of samples below threshold to count as silence (1 second).
    min_silence_samples: u64,
    /// Accumulator for pending silence detection (samples below threshold so far).
    pending_silence_samples: u64,
}

impl SilenceDetector {
    /// Create a new silence detector.
    ///
    /// - `threshold_db`: Silence threshold in decibels (e.g., -40.0).
    /// - `sample_rate`: Audio sample rate for computing minimum silence duration.
    pub fn new(threshold_db: f32, sample_rate: u32) -> Self {
        // Convert dB to linear RMS: 10^(dB/20)
        let threshold_rms = 10f32.powf(threshold_db / 20.0);
        let min_silence_samples = sample_rate as u64; // 1 second

        Self {
            threshold_rms,
            in_silence: false,
            silence_start_sample: 0,
            min_silence_samples,
            pending_silence_samples: 0,
        }
    }

    /// Process a buffer of interleaved audio samples.
    ///
    /// Computes RMS across all channels in the buffer and emits silence
    /// transition events.
    ///
    /// - `samples`: Interleaved audio samples (f32).
    /// - `channel_count`: Number of interleaved channels.
    /// - `current_sample_offset`: The sample offset (in frames) at the start of this buffer.
    ///
    /// Returns a vector of silence events (may be empty).
    pub fn process_samples(
        &mut self,
        samples: &[f32],
        channel_count: u16,
        current_sample_offset: u64,
    ) -> Vec<SilenceEvent> {
        let mut events = Vec::new();

        if samples.is_empty() || channel_count == 0 {
            return events;
        }

        // Compute RMS across all samples in the buffer
        let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / samples.len() as f32).sqrt();

        let frame_count = samples.len() as u64 / channel_count as u64;

        if rms < self.threshold_rms {
            // Below threshold
            if !self.in_silence {
                self.pending_silence_samples += frame_count;
                if self.pending_silence_samples >= self.min_silence_samples {
                    // Transition to silence
                    self.in_silence = true;
                    let start_offset =
                        current_sample_offset + frame_count - self.pending_silence_samples;
                    self.silence_start_sample = start_offset;
                    events.push(SilenceEvent::Start {
                        offset_samples: start_offset,
                    });
                }
            }
        } else {
            // Above threshold
            if self.in_silence {
                // Transition out of silence
                self.in_silence = false;
                events.push(SilenceEvent::End {
                    offset_samples: current_sample_offset,
                });
            }
            self.pending_silence_samples = 0;
        }

        events
    }

    /// Check if currently in a silence region.
    pub fn is_silent(&self) -> bool {
        self.in_silence
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_zeros_detected_as_silence() {
        let mut detector = SilenceDetector::new(-40.0, 1000);
        // Feed 1000 frames of silence (meeting min_silence_samples of 1 second at 1000 Hz)
        let silence = vec![0.0f32; 2000]; // 1000 frames * 2 channels
        let events = detector.process_samples(&silence, 2, 0);
        assert!(
            events.iter().any(|e| matches!(e, SilenceEvent::Start { .. })),
            "Expected SilenceStart event for all-zero buffer"
        );
        assert!(detector.is_silent());
    }

    #[test]
    fn test_loud_signal_no_silence() {
        let mut detector = SilenceDetector::new(-40.0, 48000);
        let loud = vec![0.5f32; 1024];
        let events = detector.process_samples(&loud, 2, 0);
        assert!(events.is_empty(), "Loud signal should not trigger silence events");
        assert!(!detector.is_silent());
    }

    #[test]
    fn test_silence_start_event_on_transition() {
        let mut detector = SilenceDetector::new(-40.0, 1000);
        // First: loud signal
        let loud = vec![0.5f32; 2000];
        let events = detector.process_samples(&loud, 2, 0);
        assert!(events.is_empty());

        // Then: silence (enough to trigger)
        let silence = vec![0.0f32; 2000]; // 1000 frames at 1000 Hz sample rate = 1 sec
        let events = detector.process_samples(&silence, 2, 1000);
        assert!(
            events.iter().any(|e| matches!(e, SilenceEvent::Start { .. })),
            "Expected SilenceStart on transition from loud to silent"
        );
    }

    #[test]
    fn test_silence_end_event_on_transition() {
        let mut detector = SilenceDetector::new(-40.0, 1000);
        // Enter silence first
        let silence = vec![0.0f32; 2000];
        detector.process_samples(&silence, 2, 0);

        // Then loud signal
        let loud = vec![0.5f32; 2000];
        let events = detector.process_samples(&loud, 2, 1000);
        assert!(
            events.iter().any(|e| matches!(e, SilenceEvent::End { .. })),
            "Expected SilenceEnd on transition from silent to loud"
        );
        assert!(!detector.is_silent());
    }

    #[test]
    fn test_empty_buffer_no_events() {
        let mut detector = SilenceDetector::new(-40.0, 48000);
        let events = detector.process_samples(&[], 2, 0);
        assert!(events.is_empty());
    }
}
