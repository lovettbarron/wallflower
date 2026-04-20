use crate::error::{Result, WallflowerError};
use serde::{Deserialize, Serialize};
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Pre-computed waveform peak data for visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeakData {
    /// Sample rate of the source audio.
    pub sample_rate: u32,
    /// Number of channels in the source audio.
    pub channels: u16,
    /// Duration of the audio in seconds.
    pub duration: f64,
    /// Each entry is [min, max] for one pixel/chunk of samples (mono-mixed).
    pub peaks: Vec<[f32; 2]>,
    /// Per-channel peaks. Each inner Vec is one channel's [min, max] pairs.
    /// Only populated for multichannel audio.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_peaks: Option<Vec<Vec<[f32; 2]>>>,
}

/// Generate waveform peaks from an audio file.
///
/// Decodes the audio using symphonia, then computes min/max pairs per chunk
/// of `samples_per_pixel` samples. Channels are mixed to mono (averaged).
/// Output values are normalized to [-1.0, 1.0].
pub fn generate_peaks(audio_path: &Path, samples_per_pixel: usize) -> Result<PeakData> {
    if samples_per_pixel == 0 {
        return Err(WallflowerError::Config(
            "samples_per_pixel must be > 0".into(),
        ));
    }

    let file = std::fs::File::open(audio_path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = audio_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe().format(
        &hint,
        mss,
        &FormatOptions::default(),
        &MetadataOptions::default(),
    ).map_err(|e| WallflowerError::Config(format!("Failed to probe audio: {}", e)))?;

    let mut format = probed.format;

    let track = format
        .default_track()
        .ok_or_else(|| WallflowerError::Config("No audio track found".into()))?;

    let codec_params = track.codec_params.clone();
    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| WallflowerError::Config("No sample rate in track".into()))?;
    let channels = codec_params
        .channels
        .map(|c| c.count() as u16)
        .unwrap_or(1);
    let n_frames = codec_params.n_frames.unwrap_or(0);

    let duration = if sample_rate > 0 && n_frames > 0 {
        n_frames as f64 / sample_rate as f64
    } else {
        0.0
    };

    let track_id = track.id;

    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| WallflowerError::Config(format!("Failed to create decoder: {}", e)))?;

    // Collect per-channel samples.
    let num_channels_usize = channels as usize;
    let mut channel_samples: Vec<Vec<f32>> = vec![Vec::with_capacity(n_frames as usize); num_channels_usize];

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(_) => break,
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let spec = *decoded.spec();
        let actual_channels = spec.channels.count();
        let num_frames = decoded.frames();

        let mut sample_buf = SampleBuffer::<f32>::new(num_frames as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);

        let samples = sample_buf.samples();
        for frame in 0..num_frames {
            for ch in 0..num_channels_usize.min(actual_channels) {
                channel_samples[ch].push(samples[frame * actual_channels + ch]);
            }
        }
    }

    // Build mono mix from channel samples
    let frame_count = channel_samples[0].len();
    let mut mono_samples: Vec<f32> = Vec::with_capacity(frame_count);
    for i in 0..frame_count {
        let mut sum: f32 = 0.0;
        for ch in &channel_samples {
            sum += ch[i];
        }
        mono_samples.push(sum / num_channels_usize as f32);
    }

    // Compute min/max peaks per chunk.
    let mut peaks: Vec<[f32; 2]> = Vec::new();
    let total = mono_samples.len();
    let mut offset = 0;

    while offset < total {
        let end = (offset + samples_per_pixel).min(total);
        let chunk = &mono_samples[offset..end];

        let mut min = f32::MAX;
        let mut max = f32::MIN;
        for &s in chunk {
            if s < min {
                min = s;
            }
            if s > max {
                max = s;
            }
        }

        // Clamp to [-1.0, 1.0]
        min = min.clamp(-1.0, 1.0);
        max = max.clamp(-1.0, 1.0);

        peaks.push([min, max]);
        offset = end;
    }

    // Recalculate duration from actual sample count if we got frames.
    let actual_duration = if sample_rate > 0 && !mono_samples.is_empty() {
        mono_samples.len() as f64 / sample_rate as f64
    } else {
        duration
    };

    // Compute per-channel peaks for multichannel audio
    let channel_peaks = if num_channels_usize > 1 {
        let mut all_channel_peaks = Vec::with_capacity(num_channels_usize);
        for ch_samples in &channel_samples {
            let mut ch_peaks: Vec<[f32; 2]> = Vec::new();
            let mut off = 0;
            while off < ch_samples.len() {
                let end = (off + samples_per_pixel).min(ch_samples.len());
                let chunk = &ch_samples[off..end];
                let mut min = f32::MAX;
                let mut max = f32::MIN;
                for &s in chunk {
                    if s < min { min = s; }
                    if s > max { max = s; }
                }
                ch_peaks.push([min.clamp(-1.0, 1.0), max.clamp(-1.0, 1.0)]);
                off = end;
            }
            all_channel_peaks.push(ch_peaks);
        }
        Some(all_channel_peaks)
    } else {
        None
    };

    Ok(PeakData {
        sample_rate,
        channels,
        duration: actual_duration,
        peaks,
        channel_peaks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn create_test_wav(dir: &Path, sample_rate: u32, duration_secs: f32) -> PathBuf {
        let path = dir.join("test.wav");
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        let num_samples = (sample_rate as f32 * duration_secs) as usize;
        for i in 0..num_samples {
            // Generate a sine wave at 440 Hz
            let t = i as f32 / sample_rate as f32;
            let sample = (t * 440.0 * 2.0 * std::f32::consts::PI).sin();
            writer
                .write_sample((sample * i16::MAX as f32) as i16)
                .unwrap();
        }
        writer.finalize().unwrap();
        path
    }

    #[test]
    fn test_generate_peaks_produces_valid_data() {
        let dir = tempfile::tempdir().unwrap();
        let wav_path = create_test_wav(dir.path(), 44100, 1.0);

        let peaks = generate_peaks(&wav_path, 4410).unwrap();

        assert_eq!(peaks.sample_rate, 44100);
        assert_eq!(peaks.channels, 1);
        assert!(peaks.duration > 0.9 && peaks.duration < 1.1);
        // 44100 samples / 4410 spp = 10 peaks (approximately)
        assert!(!peaks.peaks.is_empty());
    }

    #[test]
    fn test_generate_peaks_correct_count() {
        let dir = tempfile::tempdir().unwrap();
        let wav_path = create_test_wav(dir.path(), 44100, 1.0);

        let spp = 4410;
        let peaks = generate_peaks(&wav_path, spp).unwrap();

        // ceil(44100 / 4410) = 10
        let expected = (44100_f64 / spp as f64).ceil() as usize;
        assert_eq!(peaks.peaks.len(), expected);
    }

    #[test]
    fn test_generate_peaks_normalized() {
        let dir = tempfile::tempdir().unwrap();
        let wav_path = create_test_wav(dir.path(), 44100, 1.0);

        let peaks = generate_peaks(&wav_path, 441).unwrap();

        for pair in &peaks.peaks {
            assert!(pair[0] >= -1.0 && pair[0] <= 1.0);
            assert!(pair[1] >= -1.0 && pair[1] <= 1.0);
            assert!(pair[0] <= pair[1]); // min <= max
        }
    }

    #[test]
    fn test_generate_peaks_stereo() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("stereo.wav");
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        // Write 1 second of stereo audio
        for i in 0..44100 {
            let t = i as f32 / 44100.0;
            let left = (t * 440.0 * 2.0 * std::f32::consts::PI).sin();
            let right = (t * 880.0 * 2.0 * std::f32::consts::PI).sin();
            writer
                .write_sample((left * i16::MAX as f32) as i16)
                .unwrap();
            writer
                .write_sample((right * i16::MAX as f32) as i16)
                .unwrap();
        }
        writer.finalize().unwrap();

        let peaks = generate_peaks(&path, 4410).unwrap();
        assert_eq!(peaks.channels, 2);
        assert!(!peaks.peaks.is_empty());
    }
}
