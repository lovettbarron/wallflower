use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub path: String,
    pub format: String,
    pub bit_depth: u32,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_seconds: f64,
}

/// Export a time slice from a source WAV file to a destination WAV file.
///
/// Reads samples from `start_seconds` to `end_seconds` of the source file,
/// converts bit depth if needed (32f->24i, 32f->16i), and writes using hound.
/// Uses atomic write pattern: writes to .tmp file then renames.
pub fn export_time_slice(
    source_path: &Path,
    dest_path: &Path,
    start_seconds: f64,
    end_seconds: f64,
    target_bit_depth: u32,
) -> Result<ExportResult, Box<dyn std::error::Error>> {
    // Open source with hound (WAV only for now)
    let reader = hound::WavReader::open(source_path)?;
    let spec = reader.spec();
    let sample_rate = spec.sample_rate;
    let channels = spec.channels;

    let start_sample = (start_seconds * sample_rate as f64) as usize * channels as usize;
    let end_sample = (end_seconds * sample_rate as f64) as usize * channels as usize;

    // Create parent directories
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let tmp_path = dest_path.with_extension("wav.tmp");

    let duration_seconds = end_seconds - start_seconds;

    match (spec.sample_format, spec.bits_per_sample, target_bit_depth) {
        // 32-bit float source -> 24-bit int output
        (hound::SampleFormat::Float, 32, 24) => {
            let out_spec = hound::WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 24,
                sample_format: hound::SampleFormat::Int,
            };
            let mut writer = hound::WavWriter::create(&tmp_path, out_spec)?;
            for (i, sample) in reader.into_samples::<f32>().enumerate() {
                if i < start_sample {
                    continue;
                }
                if i >= end_sample {
                    break;
                }
                let s = sample?;
                let clamped = s.clamp(-1.0, 1.0);
                let scaled = if clamped >= 0.0 {
                    (clamped * 8_388_607.0) as i32
                } else {
                    (clamped * 8_388_608.0) as i32
                };
                writer.write_sample(scaled)?;
            }
            writer.finalize()?;
        }
        // 32-bit float source -> 16-bit int output
        (hound::SampleFormat::Float, 32, 16) => {
            let out_spec = hound::WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };
            let mut writer = hound::WavWriter::create(&tmp_path, out_spec)?;
            for (i, sample) in reader.into_samples::<f32>().enumerate() {
                if i < start_sample {
                    continue;
                }
                if i >= end_sample {
                    break;
                }
                let s = sample?;
                let clamped = s.clamp(-1.0, 1.0);
                let scaled = if clamped >= 0.0 {
                    (clamped * 32767.0) as i16
                } else {
                    (clamped * 32768.0) as i16
                };
                writer.write_sample(scaled)?;
            }
            writer.finalize()?;
        }
        // 32-bit float source -> 32-bit float output (passthrough)
        (hound::SampleFormat::Float, 32, 32) => {
            let out_spec = hound::WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 32,
                sample_format: hound::SampleFormat::Float,
            };
            let mut writer = hound::WavWriter::create(&tmp_path, out_spec)?;
            for (i, sample) in reader.into_samples::<f32>().enumerate() {
                if i < start_sample {
                    continue;
                }
                if i >= end_sample {
                    break;
                }
                let s = sample?;
                writer.write_sample(s)?;
            }
            writer.finalize()?;
        }
        // 16-bit int source -> 16-bit int output (passthrough)
        (hound::SampleFormat::Int, 16, 16) => {
            let out_spec = hound::WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };
            let mut writer = hound::WavWriter::create(&tmp_path, out_spec)?;
            for (i, sample) in reader.into_samples::<i16>().enumerate() {
                if i < start_sample {
                    continue;
                }
                if i >= end_sample {
                    break;
                }
                let s = sample?;
                writer.write_sample(s)?;
            }
            writer.finalize()?;
        }
        // 24-bit int source -> 24-bit int output (passthrough)
        (hound::SampleFormat::Int, 24, 24) => {
            let out_spec = hound::WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 24,
                sample_format: hound::SampleFormat::Int,
            };
            let mut writer = hound::WavWriter::create(&tmp_path, out_spec)?;
            for (i, sample) in reader.into_samples::<i32>().enumerate() {
                if i < start_sample {
                    continue;
                }
                if i >= end_sample {
                    break;
                }
                let s = sample?;
                writer.write_sample(s)?;
            }
            writer.finalize()?;
        }
        _ => {
            return Err(format!(
                "Unsupported conversion: {:?} {}bit -> {}bit",
                spec.sample_format, spec.bits_per_sample, target_bit_depth
            )
            .into());
        }
    }

    // Atomic rename
    std::fs::rename(&tmp_path, dest_path)?;

    Ok(ExportResult {
        path: dest_path.to_string_lossy().to_string(),
        format: "wav".to_string(),
        bit_depth: target_bit_depth,
        sample_rate,
        channels,
        duration_seconds,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use hound::{SampleFormat, WavSpec, WavWriter};
    use tempfile::TempDir;

    fn create_float32_wav(
        dir: &Path,
        name: &str,
        samples: &[f32],
        channels: u16,
        sample_rate: u32,
    ) -> std::path::PathBuf {
        let path = dir.join(name);
        let spec = WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 32,
            sample_format: SampleFormat::Float,
        };
        let mut writer = WavWriter::create(&path, spec).unwrap();
        for &s in samples {
            writer.write_sample(s).unwrap();
        }
        writer.finalize().unwrap();
        path
    }

    #[test]
    fn test_export_time_slice_extracts_correct_range() {
        let tmp = TempDir::new().unwrap();
        // Create a 2-second mono file at 4 samples/sec for simplicity
        // Actually use 44100 sample rate for realism
        let sample_rate = 100_u32; // 100 Hz for easy math
        let channels = 1_u16;
        // 3 seconds of audio: samples 0..300
        let samples: Vec<f32> = (0..300).map(|i| i as f32 / 300.0).collect();
        let source = create_float32_wav(tmp.path(), "source.wav", &samples, channels, sample_rate);
        let dest = tmp.path().join("output.wav");

        // Export seconds 1.0 to 2.0 (samples 100..200)
        let result = export_time_slice(&source, &dest, 1.0, 2.0, 24).unwrap();

        assert_eq!(result.bit_depth, 24);
        assert_eq!(result.sample_rate, sample_rate);
        assert_eq!(result.channels, channels);
        assert!((result.duration_seconds - 1.0).abs() < 0.01);

        // Verify output has correct number of samples
        let reader = hound::WavReader::open(&dest).unwrap();
        assert_eq!(reader.spec().bits_per_sample, 24);
        assert_eq!(reader.spec().sample_format, SampleFormat::Int);
        let output_samples: Vec<i32> = reader.into_samples::<i32>().map(|s| s.unwrap()).collect();
        assert_eq!(output_samples.len(), 100); // 1 second at 100Hz, mono
    }

    #[test]
    fn test_export_time_slice_32f_to_32f() {
        let tmp = TempDir::new().unwrap();
        let sample_rate = 100_u32;
        let samples: Vec<f32> = (0..200).map(|i| i as f32 / 200.0).collect();
        let source = create_float32_wav(tmp.path(), "source.wav", &samples, 1, sample_rate);
        let dest = tmp.path().join("output_32.wav");

        let result = export_time_slice(&source, &dest, 0.0, 1.0, 32).unwrap();
        assert_eq!(result.bit_depth, 32);

        let reader = hound::WavReader::open(&dest).unwrap();
        assert_eq!(reader.spec().bits_per_sample, 32);
        assert_eq!(reader.spec().sample_format, SampleFormat::Float);
    }
}
