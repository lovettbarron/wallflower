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
}
