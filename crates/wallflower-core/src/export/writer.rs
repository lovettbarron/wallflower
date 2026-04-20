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
