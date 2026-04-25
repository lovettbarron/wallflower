use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

/// Information about an available audio input device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceInfo {
    pub name: String,
    pub channel_count: u16,
    pub sample_rate: u32,
    pub is_default: bool,
}

/// Extended information about an audio input device, including supported configurations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceDetail {
    pub name: String,
    pub channel_count: u16,
    pub sample_rate: u32,
    pub is_default: bool,
    pub supported_channel_counts: Vec<u16>,
    pub supported_sample_rates: Vec<u32>,
}

/// List all available audio input devices.
///
/// Returns an empty vector if no devices are available or if enumeration fails
/// (e.g., in CI environments without audio hardware).
pub fn list_input_devices() -> Vec<InputDeviceInfo> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = match host.input_devices() {
        Ok(devices) => devices,
        Err(e) => {
            tracing::warn!("Failed to enumerate input devices: {}", e);
            return Vec::new();
        }
    };

    devices
        .filter_map(|device| {
            let name = device.name().ok()?;
            let config = device.default_input_config().ok()?;
            Some(InputDeviceInfo {
                is_default: default_name.as_deref() == Some(&name),
                name,
                channel_count: config.channels(),
                sample_rate: config.sample_rate().0,
            })
        })
        .collect()
}

/// Get information about the default input device.
///
/// Returns None if no default input device is configured.
pub fn get_default_input_device() -> Option<InputDeviceInfo> {
    let host = cpal::default_host();
    let device = host.default_input_device()?;
    let name = device.name().ok()?;
    let config = device.default_input_config().ok()?;
    Some(InputDeviceInfo {
        name,
        channel_count: config.channels(),
        sample_rate: config.sample_rate().0,
        is_default: true,
    })
}

/// Get the default cpal input device directly.
///
/// Used by the recording engine to build audio streams.
pub fn get_default_cpal_device() -> Option<cpal::Device> {
    cpal::default_host().default_input_device()
}

/// Common sample rates to check for device support.
const COMMON_SAMPLE_RATES: [u32; 6] = [44100, 48000, 88200, 96000, 176400, 192000];

/// Get a cpal input device by its name.
///
/// Falls back to the default input device if the named device is not found.
pub fn get_cpal_device_by_name(name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();
    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(dev_name) = device.name() {
                if dev_name == name {
                    return Some(device);
                }
            }
        }
    }
    tracing::warn!(
        "Device '{}' not found, falling back to default input device",
        name
    );
    host.default_input_device()
}

/// Get detailed information about a specific input device by name.
///
/// Returns None if the device is not found.
pub fn get_device_detail(name: &str) -> Option<InputDeviceDetail> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = host.input_devices().ok()?;
    for device in devices {
        let dev_name = match device.name() {
            Ok(n) => n,
            Err(_) => continue,
        };
        if dev_name != name {
            continue;
        }

        let default_config = device.default_input_config().ok()?;
        let channel_count = default_config.channels();
        let sample_rate = default_config.sample_rate().0;

        let mut supported_channels: Vec<u16> = Vec::new();
        let mut supported_rates: Vec<u32> = Vec::new();

        if let Ok(configs) = device.supported_input_configs() {
            for config in configs {
                let ch = config.channels();
                if !supported_channels.contains(&ch) {
                    supported_channels.push(ch);
                }
                let min_rate = config.min_sample_rate().0;
                let max_rate = config.max_sample_rate().0;
                for &rate in &COMMON_SAMPLE_RATES {
                    if rate >= min_rate && rate <= max_rate && !supported_rates.contains(&rate) {
                        supported_rates.push(rate);
                    }
                }
            }
        }

        supported_channels.sort();
        supported_rates.sort();

        // Ensure default values are present
        if !supported_channels.contains(&channel_count) {
            supported_channels.push(channel_count);
            supported_channels.sort();
        }
        if !supported_rates.contains(&sample_rate) {
            supported_rates.push(sample_rate);
            supported_rates.sort();
        }

        return Some(InputDeviceDetail {
            is_default: default_name.as_deref() == Some(&dev_name),
            name: dev_name,
            channel_count,
            sample_rate,
            supported_channel_counts: supported_channels,
            supported_sample_rates: supported_rates,
        });
    }

    None
}

/// List all available input devices with detailed supported configuration info.
pub fn list_input_devices_detailed() -> Vec<InputDeviceDetail> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = match host.input_devices() {
        Ok(devices) => devices,
        Err(e) => {
            tracing::warn!("Failed to enumerate input devices: {}", e);
            return Vec::new();
        }
    };

    devices
        .filter_map(|device| {
            let name = device.name().ok()?;
            let default_config = device.default_input_config().ok()?;
            let channel_count = default_config.channels();
            let sample_rate = default_config.sample_rate().0;

            let mut supported_channels: Vec<u16> = Vec::new();
            let mut supported_rates: Vec<u32> = Vec::new();

            if let Ok(configs) = device.supported_input_configs() {
                for config in configs {
                    let ch = config.channels();
                    if !supported_channels.contains(&ch) {
                        supported_channels.push(ch);
                    }
                    let min_rate = config.min_sample_rate().0;
                    let max_rate = config.max_sample_rate().0;
                    for &rate in &COMMON_SAMPLE_RATES {
                        if rate >= min_rate && rate <= max_rate && !supported_rates.contains(&rate) {
                            supported_rates.push(rate);
                        }
                    }
                }
            }

            supported_channels.sort();
            supported_rates.sort();

            if !supported_channels.contains(&channel_count) {
                supported_channels.push(channel_count);
                supported_channels.sort();
            }
            if !supported_rates.contains(&sample_rate) {
                supported_rates.push(sample_rate);
                supported_rates.sort();
            }

            Some(InputDeviceDetail {
                is_default: default_name.as_deref() == Some(&name),
                name,
                channel_count,
                sample_rate,
                supported_channel_counts: supported_channels,
                supported_sample_rates: supported_rates,
            })
        })
        .collect()
}

/// Capture a brief snapshot of per-channel RMS levels from a device.
///
/// Opens a temporary cpal input stream, captures ~100ms of audio, then
/// returns one RMS-in-dB value per physical channel. Blocking — call
/// from a background thread (e.g., `spawn_blocking`).
pub fn monitor_device_levels(device_name: Option<&str>) -> anyhow::Result<Vec<f32>> {
    let device = if let Some(name) = device_name {
        get_cpal_device_by_name(name)
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", name))?
    } else {
        get_default_cpal_device()
            .ok_or_else(|| anyhow::anyhow!("No default input device"))?
    };

    let config = device
        .default_input_config()
        .map_err(|e| anyhow::anyhow!("Failed to get input config: {}", e))?;

    let channels = config.channels() as usize;
    let sample_rate = config.sample_rate().0 as usize;
    let capture_samples = sample_rate / 10; // ~100ms worth of frames

    let buffer = Arc::new(std::sync::Mutex::new(Vec::<f32>::with_capacity(
        capture_samples * channels,
    )));
    let done = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let buf_ref = Arc::clone(&buffer);
    let done_ref = Arc::clone(&done);
    let ch = channels;

    let stream_config: cpal::StreamConfig = config.into();
    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if done_ref.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                let mut buf = buf_ref.lock().unwrap();
                let remaining = capture_samples * ch - buf.len();
                if remaining > 0 {
                    let take = remaining.min(data.len());
                    buf.extend_from_slice(&data[..take]);
                }
                if buf.len() >= capture_samples * ch {
                    done_ref.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            },
            |err| {
                tracing::warn!("Level monitor stream error: {}", err);
            },
            None,
        )
        .map_err(|e| anyhow::anyhow!("Failed to build input stream: {}", e))?;

    use cpal::traits::StreamTrait;
    stream
        .play()
        .map_err(|e| anyhow::anyhow!("Failed to start stream: {}", e))?;

    // Wait up to 500ms for capture to complete
    let start = std::time::Instant::now();
    while !done.load(std::sync::atomic::Ordering::Relaxed) {
        if start.elapsed() > std::time::Duration::from_millis(500) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(5));
    }

    drop(stream);

    let buf = buffer.lock().unwrap();
    let frame_count = buf.len() / channels;
    if frame_count == 0 {
        return Ok(vec![-100.0; channels]);
    }

    let mut levels = Vec::with_capacity(channels);
    for ch_idx in 0..channels {
        let sum_sq: f64 = (0..frame_count)
            .map(|f| {
                let s = buf[f * channels + ch_idx] as f64;
                s * s
            })
            .sum();
        let rms = (sum_sq / frame_count as f64).sqrt();
        let db = if rms > 0.0 {
            (20.0 * rms.log10()) as f32
        } else {
            -100.0
        };
        levels.push(db);
    }

    Ok(levels)
}

/// Poll for a device to reconnect after a disconnect.
///
/// Checks every 2 seconds for a device with the given name.
/// Returns the device if found within the timeout, or None.
///
/// This is a blocking function -- call from a background thread
/// (e.g., via `spawn_blocking` in async context).
pub fn poll_for_device_reconnect(
    device_name: &str,
    timeout: std::time::Duration,
) -> Option<cpal::Device> {
    let start = std::time::Instant::now();
    let poll_interval = std::time::Duration::from_secs(2);

    while start.elapsed() < timeout {
        let host = cpal::default_host();
        if let Ok(devices) = host.input_devices() {
            for device in devices {
                if let Ok(name) = device.name() {
                    if name == device_name {
                        tracing::info!("Device reconnected: {}", device_name);
                        return Some(device);
                    }
                }
            }
        }
        std::thread::sleep(poll_interval);
    }

    tracing::warn!(
        "Device reconnection timeout after {:?}: {}",
        timeout,
        device_name
    );
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_input_devices_returns_vec() {
        // In CI without audio hardware, this will return an empty vec.
        // The test verifies the function compiles and returns the correct type.
        let devices: Vec<InputDeviceInfo> = list_input_devices();
        // We can't assert a specific count since it depends on hardware.
        // Just verify it's a valid Vec.
        let _ = devices.len();
    }

    #[test]
    fn test_get_default_input_device_type() {
        // May return None in CI -- that's fine.
        let _device: Option<InputDeviceInfo> = get_default_input_device();
    }

    #[test]
    fn test_input_device_info_serialization() {
        let info = InputDeviceInfo {
            name: "Test Mic".into(),
            channel_count: 2,
            sample_rate: 48000,
            is_default: true,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("Test Mic"));
        assert!(json.contains("channelCount"));
        assert!(json.contains("sampleRate"));
    }

    #[test]
    fn test_input_device_detail_serialization() {
        let detail = InputDeviceDetail {
            name: "Scarlett 2i2".into(),
            channel_count: 2,
            sample_rate: 48000,
            is_default: false,
            supported_channel_counts: vec![1, 2],
            supported_sample_rates: vec![44100, 48000, 96000],
        };
        let json = serde_json::to_string(&detail).unwrap();
        assert!(json.contains("Scarlett 2i2"));
        assert!(json.contains("supportedChannelCounts"));
        assert!(json.contains("supportedSampleRates"));
    }

    #[test]
    fn test_list_input_devices_detailed_returns_vec() {
        // In CI without audio hardware, this returns an empty vec.
        let devices: Vec<InputDeviceDetail> = list_input_devices_detailed();
        let _ = devices.len();
    }

    #[test]
    fn test_get_cpal_device_by_name_nonexistent() {
        // A nonexistent device name should fall back to default (or None in CI).
        let _device = get_cpal_device_by_name("NonexistentDevice12345");
        // Just verify it doesn't panic.
    }
}
