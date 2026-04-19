use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::import;

/// Information about a detected audio recording device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    /// Device/volume name (e.g., "ZOOM F3", "H6")
    pub name: String,
    /// Filesystem mount point (e.g., "/Volumes/ZOOM F3")
    pub mount_point: String,
    /// Audio files found on the device
    pub files: Vec<String>,
}

/// Detect connected audio recording devices by scanning mounted volumes.
///
/// Looks in `/Volumes/` for mounted USB volumes that contain audio files,
/// with special detection for Zoom recorders (F3, H6, etc.).
pub fn detect_devices() -> Vec<DeviceInfo> {
    let volumes_path = Path::new("/Volumes");
    if !volumes_path.exists() {
        return vec![];
    }

    let entries = match std::fs::read_dir(volumes_path) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut devices = Vec::new();

    for entry in entries.flatten() {
        let mount_point = entry.path();

        // Skip the main macOS volume
        if mount_point == Path::new("/Volumes/Macintosh HD") {
            continue;
        }

        // Skip non-directories
        if !mount_point.is_dir() {
            continue;
        }

        let audio_files = find_audio_files_on_device(&mount_point);

        if audio_files.is_empty() {
            continue;
        }

        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        let is_zoom = is_zoom_recorder(&mount_point);
        let device_name = if is_zoom {
            format!("{name} (Zoom recorder)")
        } else {
            name
        };

        devices.push(DeviceInfo {
            name: device_name,
            mount_point: mount_point.to_string_lossy().to_string(),
            files: audio_files
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect(),
        });
    }

    devices
}

/// Check if a mounted volume has the directory structure of a Zoom recorder.
///
/// Zoom recorders (F3, H6, H5, etc.) typically create numbered folders like
/// `ZOOM0001/`, `ZOOM0002/`, or have a `STEREO/` subdirectory containing WAV files.
pub fn is_zoom_recorder(mount_point: &Path) -> bool {
    // Check for ZOOM-numbered directories
    if let Ok(entries) = std::fs::read_dir(mount_point) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            // Zoom creates folders like ZOOM0001, ZOOM0002, etc.
            if name.starts_with("ZOOM") && name.len() == 8 && name[4..].chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
    }

    // Check for STEREO subdirectory (common in Zoom recorders)
    let stereo_dir = mount_point.join("STEREO");
    if stereo_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&stereo_dir) {
            for entry in entries.flatten() {
                if import::is_audio_file(&entry.path()) {
                    return true;
                }
            }
        }
    }

    false
}

/// Find audio files on a device, scanning up to 2 directory levels deep.
///
/// Limits depth to avoid scanning entire large USB drives.
pub fn find_audio_files_on_device(mount_point: &Path) -> Vec<PathBuf> {
    WalkDir::new(mount_point)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| import::is_audio_file(e.path()))
        .map(|e| e.path().to_path_buf())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_detect_devices_returns_empty_on_no_devices() {
        // On a typical dev machine without USB recorders, this should return
        // an empty vec or only non-recorder volumes.
        let devices = detect_devices();
        // We can't assert it's empty (user might have devices), but it shouldn't panic.
        assert!(devices.len() < 100, "Unreasonable number of devices detected");
    }

    #[test]
    fn test_is_zoom_recorder_with_structure() {
        let tmp = TempDir::new().unwrap();

        // Create Zoom-like directory structure
        std::fs::create_dir_all(tmp.path().join("ZOOM0001")).unwrap();
        let wav_path = tmp.path().join("ZOOM0001").join("ZOOM0001.WAV");
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&wav_path, spec).unwrap();
        for i in 0..100 {
            writer.write_sample(i as i16).unwrap();
        }
        writer.finalize().unwrap();

        assert!(is_zoom_recorder(tmp.path()));
    }

    #[test]
    fn test_is_zoom_recorder_with_stereo_dir() {
        let tmp = TempDir::new().unwrap();

        // Create STEREO directory with a WAV file
        std::fs::create_dir_all(tmp.path().join("STEREO")).unwrap();
        let wav_path = tmp.path().join("STEREO").join("recording.wav");
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 48000,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };
        let mut writer = hound::WavWriter::create(&wav_path, spec).unwrap();
        for i in 0..100 {
            writer.write_sample(i as f32 * 0.001).unwrap();
        }
        writer.finalize().unwrap();

        assert!(is_zoom_recorder(tmp.path()));
    }

    #[test]
    fn test_is_zoom_recorder_negative() {
        let tmp = TempDir::new().unwrap();
        // Empty directory is not a Zoom recorder
        assert!(!is_zoom_recorder(tmp.path()));
    }

    #[test]
    fn test_find_audio_files_on_device() {
        let tmp = TempDir::new().unwrap();

        // Create audio files at different depths
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        // Root level WAV
        let mut w = hound::WavWriter::create(tmp.path().join("root.wav"), spec).unwrap();
        w.write_sample(0i16).unwrap();
        w.finalize().unwrap();

        // Level 1 WAV
        std::fs::create_dir_all(tmp.path().join("sub")).unwrap();
        let mut w = hound::WavWriter::create(tmp.path().join("sub").join("level1.wav"), spec).unwrap();
        w.write_sample(0i16).unwrap();
        w.finalize().unwrap();

        // Level 2 WAV (at max_depth boundary)
        std::fs::create_dir_all(tmp.path().join("sub").join("deep")).unwrap();
        let mut w = hound::WavWriter::create(tmp.path().join("sub").join("deep").join("level2.wav"), spec).unwrap();
        w.write_sample(0i16).unwrap();
        w.finalize().unwrap();

        // Non-audio file
        std::fs::write(tmp.path().join("readme.txt"), "not audio").unwrap();

        let files = find_audio_files_on_device(tmp.path());
        assert_eq!(files.len(), 3);
    }
}
