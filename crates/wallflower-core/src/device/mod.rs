use std::ffi::CString;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::import;

const NETWORK_FS_TYPES: &[&str] = &["smbfs", "nfs", "afpfs", "webdavfs", "cifs"];

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
/// Only considers locally-attached volumes (USB drives, SD cards). Network
/// filesystems (SMB, NFS, AFP, WebDAV) are excluded via statfs.
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

        if mount_point == Path::new("/Volumes/Macintosh HD") {
            continue;
        }

        if !mount_point.is_dir() {
            continue;
        }

        if !is_local_volume(&mount_point) {
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

        let is_zoom = is_zoom_recorder(&mount_point, &name);
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

/// Returns true if the volume is locally attached (not a network filesystem).
fn is_local_volume(path: &Path) -> bool {
    let c_path = match CString::new(path.to_string_lossy().as_bytes()) {
        Ok(p) => p,
        Err(_) => return false,
    };

    unsafe {
        let mut stat: libc::statfs = std::mem::zeroed();
        if libc::statfs(c_path.as_ptr(), &mut stat) != 0 {
            return false;
        }
        let fs_type = std::ffi::CStr::from_ptr(stat.f_fstypename.as_ptr())
            .to_string_lossy();
        !NETWORK_FS_TYPES.iter().any(|nfs| fs_type.eq_ignore_ascii_case(nfs))
    }
}

/// Check if a mounted volume is a Zoom recorder by volume name or directory structure.
///
/// Detection signals (any match → true):
/// - Volume name contains a known Zoom model identifier (F3, F6, F8, H1, H2, H4, H5, H6, H8)
/// - Numbered directories like `ZOOM0001/`, `ZOOM0002/`
/// - A `STEREO/` subdirectory containing audio files
/// - Files matching the Zoom `YYMMDD_NNN` naming pattern
pub fn is_zoom_recorder(mount_point: &Path, volume_name: &str) -> bool {
    let name_upper = volume_name.to_uppercase();

    // Volume name patterns: "F3_SD", "ZOOM_F3", "H6", "ZOOM H6", etc.
    const ZOOM_MODELS: &[&str] = &[
        "F3", "F6", "F8",
        "H1", "H2", "H4", "H5", "H6", "H8",
        "ZOOM",
    ];
    if ZOOM_MODELS.iter().any(|m| name_upper.contains(m)) {
        return true;
    }

    if let Ok(entries) = std::fs::read_dir(mount_point) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            // ZOOM0001-style directories
            if fname.starts_with("ZOOM") && fname.len() == 8 && fname[4..].chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
    }

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

    // Zoom YYMMDD_NNN.WAV naming pattern in root
    if let Ok(entries) = std::fs::read_dir(mount_point) {
        let zoom_file_count = entries
            .flatten()
            .filter(|e| {
                let n = e.file_name().to_string_lossy().to_string();
                n.len() >= 14 && n[..6].chars().all(|c| c.is_ascii_digit())
                    && n.as_bytes().get(6) == Some(&b'_')
                    && n[7..10].chars().all(|c| c.is_ascii_digit())
                    && n.to_uppercase().ends_with(".WAV")
            })
            .take(3)
            .count();
        if zoom_file_count >= 3 {
            return true;
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
    fn test_is_zoom_recorder_by_volume_name() {
        let tmp = TempDir::new().unwrap();
        assert!(is_zoom_recorder(tmp.path(), "F3_SD"));
        assert!(is_zoom_recorder(tmp.path(), "ZOOM_H6"));
        assert!(is_zoom_recorder(tmp.path(), "H5"));
        assert!(!is_zoom_recorder(tmp.path(), "GENERIC_USB"));
    }

    #[test]
    fn test_is_zoom_recorder_with_structure() {
        let tmp = TempDir::new().unwrap();

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

        assert!(is_zoom_recorder(tmp.path(), "UNKNOWN_VOL"));
    }

    #[test]
    fn test_is_zoom_recorder_with_stereo_dir() {
        let tmp = TempDir::new().unwrap();

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

        assert!(is_zoom_recorder(tmp.path(), "SOME_VOL"));
    }

    #[test]
    fn test_is_zoom_recorder_with_file_pattern() {
        let tmp = TempDir::new().unwrap();
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        // Create 3 files matching YYMMDD_NNN.WAV pattern
        for name in &["230828_001.WAV", "230828_002.WAV", "230828_003.WAV"] {
            let mut w = hound::WavWriter::create(tmp.path().join(name), spec).unwrap();
            w.write_sample(0i16).unwrap();
            w.finalize().unwrap();
        }
        assert!(is_zoom_recorder(tmp.path(), "UNKNOWN_DRIVE"));
    }

    #[test]
    fn test_is_zoom_recorder_negative() {
        let tmp = TempDir::new().unwrap();
        assert!(!is_zoom_recorder(tmp.path(), "MY_USB_DRIVE"));
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
