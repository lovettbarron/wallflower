use std::ffi::OsStr;
use std::fs::File;
use std::path::Path;

use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Audio metadata extracted from a file via symphonia.
#[derive(Debug, Clone)]
pub struct AudioMetadata {
    pub duration_seconds: Option<f64>,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub channels: Option<i32>,
    pub format: String,
}

/// Extract audio metadata from a file using symphonia.
/// Falls back gracefully: if symphonia cannot probe the file, returns
/// metadata with the format inferred from the file extension and None
/// for all numeric fields.
pub fn extract(path: &Path) -> AudioMetadata {
    let format = path
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or("unknown")
        .to_lowercase();

    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => {
            return AudioMetadata {
                duration_seconds: None,
                sample_rate: None,
                bit_depth: None,
                channels: None,
                format,
            };
        }
    };

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    hint.with_extension(&format);

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = match symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
        Ok(p) => p,
        Err(_) => {
            return AudioMetadata {
                duration_seconds: None,
                sample_rate: None,
                bit_depth: None,
                channels: None,
                format,
            };
        }
    };

    let track = probed.format.default_track();

    let (sample_rate, bit_depth, channels, duration_seconds) = match track {
        Some(t) => {
            let params = &t.codec_params;
            let sr = params.sample_rate.map(|v| v as i32);
            let bd = params.bits_per_sample.map(|v| v as i32);
            let ch = params.channels.map(|c| c.count() as i32);
            let dur = match (params.n_frames, params.sample_rate) {
                (Some(frames), Some(rate)) if rate > 0 => {
                    Some(frames as f64 / rate as f64)
                }
                _ => params.time_base.and_then(|tb| {
                    t.codec_params.n_frames.map(|f| {
                        tb.calc_time(f).seconds as f64 + tb.calc_time(f).frac
                    })
                }),
            };
            (sr, bd, ch, dur)
        }
        None => (None, None, None, None),
    };

    AudioMetadata {
        duration_seconds,
        sample_rate,
        bit_depth,
        channels,
        format,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_nonexistent_file() {
        let meta = extract(Path::new("/nonexistent/file.wav"));
        assert_eq!(meta.format, "wav");
        assert!(meta.duration_seconds.is_none());
    }

    #[test]
    fn test_extract_wav_file() {
        // Create a minimal valid WAV file using hound
        let tmp = tempfile::NamedTempFile::with_suffix(".wav").unwrap();
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        {
            let mut writer = hound::WavWriter::create(tmp.path(), spec).unwrap();
            // Write 1 second of silence (44100 samples * 2 channels)
            for _ in 0..(44100 * 2) {
                writer.write_sample(0i16).unwrap();
            }
            writer.finalize().unwrap();
        }

        let meta = extract(tmp.path());
        assert_eq!(meta.format, "wav");
        assert_eq!(meta.sample_rate, Some(44100));
        assert_eq!(meta.channels, Some(2));
        assert_eq!(meta.bit_depth, Some(16));
        // Duration should be approximately 1 second
        assert!(meta.duration_seconds.is_some());
        let dur = meta.duration_seconds.unwrap();
        assert!((dur - 1.0).abs() < 0.1, "duration was {dur}");
    }
}
