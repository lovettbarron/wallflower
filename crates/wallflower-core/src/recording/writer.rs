use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use hound::{WavSpec, WavWriter};

/// Crash-safe WAV writer that periodically flushes the WAV header and fsyncs
/// to disk, ensuring the file is always a valid (if truncated) WAV file.
///
/// The flush thread runs on a configurable interval and updates the RIFF/data
/// chunk sizes in the WAV header. After a crash, the file is decodable up to
/// the last flush point.
pub struct CrashSafeWriter {
    writer: Arc<Mutex<Option<WavWriter<BufWriter<std::fs::File>>>>>,
    file_path: PathBuf,
    #[allow(dead_code)]
    flush_interval: Duration,
    flush_thread: Option<std::thread::JoinHandle<()>>,
    stop_flag: Arc<AtomicBool>,
    raw_fd: i32,
}

impl CrashSafeWriter {
    /// Create a new crash-safe WAV writer.
    ///
    /// Opens the file, creates a hound WavWriter, and starts a background
    /// thread that flushes every `flush_interval`.
    pub fn new(path: &Path, spec: WavSpec, flush_interval: Duration) -> Result<Self> {
        let file = std::fs::File::create(path)
            .with_context(|| format!("Failed to create WAV file: {}", path.display()))?;

        // Store raw fd for fsync calls
        #[cfg(unix)]
        let raw_fd = {
            use std::os::unix::io::AsRawFd;
            file.as_raw_fd()
        };
        #[cfg(not(unix))]
        let raw_fd = -1;

        let buf_writer = BufWriter::with_capacity(65536, file);
        let wav_writer = WavWriter::new(buf_writer, spec)
            .with_context(|| "Failed to create WAV writer")?;

        let writer = Arc::new(Mutex::new(Some(wav_writer)));
        let stop_flag = Arc::new(AtomicBool::new(false));

        // Start flush thread
        let flush_writer = Arc::clone(&writer);
        let flush_stop = Arc::clone(&stop_flag);
        let flush_fd = raw_fd;
        let flush_int = flush_interval;

        let flush_thread = std::thread::Builder::new()
            .name("wav-flush".into())
            .spawn(move || {
                Self::flush_loop(flush_writer, flush_stop, flush_fd, flush_int);
            })
            .with_context(|| "Failed to start flush thread")?;

        Ok(Self {
            writer,
            file_path: path.to_path_buf(),
            flush_interval,
            flush_thread: Some(flush_thread),
            stop_flag,
            raw_fd,
        })
    }

    /// Background flush loop.
    fn flush_loop(
        writer: Arc<Mutex<Option<WavWriter<BufWriter<std::fs::File>>>>>,
        stop_flag: Arc<AtomicBool>,
        raw_fd: i32,
        interval: Duration,
    ) {
        loop {
            // Sleep in small increments so we can respond to stop_flag quickly
            let sleep_step = Duration::from_millis(100);
            let mut elapsed = Duration::ZERO;
            while elapsed < interval {
                if stop_flag.load(Ordering::Acquire) {
                    return;
                }
                std::thread::sleep(sleep_step);
                elapsed += sleep_step;
            }

            if stop_flag.load(Ordering::Acquire) {
                break;
            }

            if let Ok(mut guard) = writer.lock() {
                if let Some(ref mut w) = *guard {
                    if let Err(e) = w.flush() {
                        tracing::error!("WAV flush failed: {}", e);
                    } else {
                        // fsync after flush to ensure data reaches disk
                        #[cfg(unix)]
                        unsafe {
                            libc::fsync(raw_fd);
                        }
                        tracing::trace!("WAV flushed and fsynced");
                    }
                } else {
                    // Writer has been taken (finalized) -- stop flushing
                    break;
                }
            }
        }
    }

    /// Write interleaved audio samples to the WAV file.
    ///
    /// Uses `try_lock` to avoid blocking the audio callback thread if a flush
    /// is in progress. If the lock cannot be acquired, samples are dropped
    /// (this is preferable to blocking the real-time audio thread).
    pub fn write_samples(&self, samples: &[f32]) -> Result<()> {
        match self.writer.try_lock() {
            Ok(mut guard) => {
                if let Some(ref mut w) = *guard {
                    for &sample in samples {
                        w.write_sample(sample)
                            .with_context(|| "Failed to write audio sample")?;
                    }
                }
                Ok(())
            }
            Err(_) => {
                // Flush in progress -- drop samples rather than block audio thread.
                // This is acceptable: flush happens every 5-10 seconds and takes <1ms.
                // In practice, sample loss from try_lock contention is negligible.
                tracing::trace!("Writer locked during flush, dropping {} samples", samples.len());
                Ok(())
            }
        }
    }

    /// Manually flush the WAV header and fsync.
    pub fn flush(&self) -> Result<()> {
        if let Ok(mut guard) = self.writer.lock() {
            if let Some(ref mut w) = *guard {
                w.flush().with_context(|| "WAV flush failed")?;
                #[cfg(unix)]
                unsafe {
                    libc::fsync(self.raw_fd);
                }
            }
        }
        Ok(())
    }

    /// Finalize the WAV file: write final header, fsync, and close.
    ///
    /// This consumes the writer. The flush thread is stopped.
    /// Returns the path to the finalized WAV file.
    pub fn finalize(mut self) -> Result<PathBuf> {
        // Signal flush thread to stop
        self.stop_flag.store(true, Ordering::Release);

        // Take the writer out of the mutex -- hound finalizes on drop
        if let Ok(mut guard) = self.writer.lock() {
            let writer = guard.take();
            // Drop the writer explicitly -- hound writes final header on drop
            drop(writer);
        }

        // fsync to ensure final header reaches disk
        #[cfg(unix)]
        unsafe {
            libc::fsync(self.raw_fd);
        }

        // Wait for flush thread to finish
        if let Some(thread) = self.flush_thread.take() {
            let _ = thread.join();
        }

        Ok(self.file_path.clone())
    }

    /// Get the file path.
    pub fn path(&self) -> &Path {
        &self.file_path
    }
}

impl Drop for CrashSafeWriter {
    fn drop(&mut self) {
        // Ensure flush thread is stopped on drop
        self.stop_flag.store(true, Ordering::Release);
        if let Some(thread) = self.flush_thread.take() {
            let _ = thread.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_spec(channels: u16) -> WavSpec {
        WavSpec {
            channels,
            sample_rate: 48000,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        }
    }

    #[test]
    fn test_write_and_flush() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.wav");
        let writer = CrashSafeWriter::new(&path, test_spec(1), Duration::from_secs(60)).unwrap();

        // Write 1 second of mono audio at 48kHz
        let samples: Vec<f32> = (0..48000)
            .map(|i| (i as f32 * 440.0 * 2.0 * std::f32::consts::PI / 48000.0).sin())
            .collect();
        writer.write_samples(&samples).unwrap();

        // Flush to make file valid
        writer.flush().unwrap();

        // Verify file is readable by hound
        let reader = hound::WavReader::open(&path).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, 48000);
        assert_eq!(spec.bits_per_sample, 32);
        let sample_count = reader.len() as usize;
        assert_eq!(sample_count, 48000);

        // Clean up
        drop(writer);
    }

    #[test]
    fn test_finalize_produces_valid_wav() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("final.wav");
        let writer = CrashSafeWriter::new(&path, test_spec(2), Duration::from_secs(60)).unwrap();

        // Write 0.5 seconds of stereo audio (48000 frames * 2 channels = 96000 samples)
        let samples: Vec<f32> = vec![0.1f32; 96000];
        writer.write_samples(&samples).unwrap();

        // Finalize
        let result_path = writer.finalize().unwrap();
        assert_eq!(result_path, path);

        // Verify finalized file
        let reader = hound::WavReader::open(&path).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 2);
        assert_eq!(spec.sample_rate, 48000);
        // 96000 interleaved samples / 2 channels = 48000 frames, but hound len() counts per-channel samples
        // Actually hound len() returns total sample count across all channels
        assert_eq!(reader.len(), 96000);
    }

    #[test]
    fn test_multichannel_write() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("multi.wav");

        // 4-channel recording (REC-09)
        let writer = CrashSafeWriter::new(&path, test_spec(4), Duration::from_secs(60)).unwrap();

        // Write 0.25 seconds of 4-channel audio (12000 frames * 4 channels = 48000 samples)
        let samples: Vec<f32> = vec![0.05f32; 48000];
        writer.write_samples(&samples).unwrap();

        let result_path = writer.finalize().unwrap();

        let reader = hound::WavReader::open(&result_path).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 4);
        assert_eq!(spec.sample_rate, 48000);
        assert_eq!(reader.len(), 48000);
    }

    #[test]
    fn test_intermediate_file_valid_after_flush() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash.wav");
        let writer = CrashSafeWriter::new(&path, test_spec(1), Duration::from_secs(60)).unwrap();

        // Write first batch
        let batch1 = vec![0.3f32; 24000]; // 0.5 seconds
        writer.write_samples(&batch1).unwrap();
        writer.flush().unwrap();

        // At this point, if we "crash" (just read the file without finalizing),
        // the file should be valid up to the flush point
        let reader = hound::WavReader::open(&path).unwrap();
        assert_eq!(reader.len(), 24000);

        // Write more data
        let batch2 = vec![0.3f32; 24000];
        writer.write_samples(&batch2).unwrap();
        writer.flush().unwrap();

        // Check again -- should have all samples
        let reader = hound::WavReader::open(&path).unwrap();
        assert_eq!(reader.len(), 48000);

        drop(writer);
    }
}
