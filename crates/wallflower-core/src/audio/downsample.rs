use std::path::Path;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum DownsampleError {
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("file is not a WAV file")]
    NotWav,
    #[error("WAV file is not 32-bit float format")]
    NotFloat32,
    #[error("hound error: {0}")]
    HoundError(#[from] hound::Error),
}

/// Convert a 32-bit float WAV file to a 24-bit integer WAV file.
///
/// The source file must be a WAV with SampleFormat::Float and bits_per_sample=32.
/// The output preserves sample_rate and channels, changing only the bit depth.
pub fn downsample_32f_to_24i(_source: &Path, _dest: &Path) -> Result<(), DownsampleError> {
    todo!("not yet implemented")
}

#[cfg(test)]
mod tests {
    use super::*;
    use hound::{SampleFormat, WavSpec, WavWriter};
    use tempfile::NamedTempFile;

    fn create_float32_wav(samples: &[f32], channels: u16, sample_rate: u32) -> NamedTempFile {
        let tmp = NamedTempFile::with_suffix(".wav").unwrap();
        let spec = WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 32,
            sample_format: SampleFormat::Float,
        };
        let mut writer = WavWriter::create(tmp.path(), spec).unwrap();
        for &s in samples {
            writer.write_sample(s).unwrap();
        }
        writer.finalize().unwrap();
        tmp
    }

    #[test]
    fn test_converts_32f_to_24i_format() {
        let input = create_float32_wav(&[0.0f32; 44100 * 2], 2, 44100);
        let output = NamedTempFile::with_suffix(".wav").unwrap();

        downsample_32f_to_24i(input.path(), output.path()).unwrap();

        let reader = hound::WavReader::open(output.path()).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.bits_per_sample, 24);
        assert_eq!(spec.sample_format, SampleFormat::Int);
        assert_eq!(spec.sample_rate, 44100);
        assert_eq!(spec.channels, 2);
    }

    #[test]
    fn test_sample_values_correctly_scaled() {
        // Create a WAV with known float values: 1.0, -1.0, 0.0, 0.5
        let input = create_float32_wav(&[1.0f32, -1.0, 0.0, 0.5], 1, 44100);
        let output = NamedTempFile::with_suffix(".wav").unwrap();

        downsample_32f_to_24i(input.path(), output.path()).unwrap();

        let mut reader = hound::WavReader::open(output.path()).unwrap();
        let samples: Vec<i32> = reader.samples::<i32>().map(|s| s.unwrap()).collect();
        assert_eq!(samples.len(), 4);
        assert_eq!(samples[0], 8388607);   // 1.0 -> 2^23 - 1
        assert_eq!(samples[1], -8388608);  // -1.0 -> -2^23
        assert_eq!(samples[2], 0);         // 0.0 -> 0
        // 0.5 -> 0.5 * 8388607 = 4194303 (rounded)
        assert_eq!(samples[3], 4194303);
    }

    #[test]
    fn test_error_for_non_wav_extension() {
        let input = NamedTempFile::with_suffix(".mp3").unwrap();
        let output = NamedTempFile::with_suffix(".wav").unwrap();

        let result = downsample_32f_to_24i(input.path(), output.path());
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DownsampleError::NotWav));
    }

    #[test]
    fn test_error_for_non_float32_wav() {
        // Create a 16-bit int WAV
        let input = NamedTempFile::with_suffix(".wav").unwrap();
        let spec = WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: SampleFormat::Int,
        };
        let mut writer = WavWriter::create(input.path(), spec).unwrap();
        for _ in 0..100 {
            writer.write_sample(0i16).unwrap();
        }
        writer.finalize().unwrap();

        let output = NamedTempFile::with_suffix(".wav").unwrap();
        let result = downsample_32f_to_24i(input.path(), output.path());
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DownsampleError::NotFloat32));
    }
}
