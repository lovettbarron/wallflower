pub mod sanitize;
pub mod sidecar;
pub mod writer;

/// Calculate segment duration in seconds based on memory limit and model.
/// Used by Tauri separate_stems command to pass segment_seconds to gRPC SeparateRequest.
/// memory_limit_bytes: user-configured memory limit (e.g., 4 * 1024^3 for 4GB)
/// Returns clamped value between 5.0 and 30.0 seconds.
pub fn calculate_segment_seconds(
    memory_limit_bytes: u64,
    model_name: &str,
    _sample_rate: u32,
    _channels: u16,
) -> f64 {
    let bytes_per_second: f64 = match model_name {
        "htdemucs_6s" => 350_000_000.0,
        _ => 250_000_000.0, // htdemucs default
    };
    // Reserve 30% headroom for intermediate buffers
    let usable = memory_limit_bytes as f64 * 0.7;
    let segment = usable / bytes_per_second;
    segment.clamp(5.0, 30.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_segment_seconds_4gb_htdemucs() {
        let limit = 4 * 1024 * 1024 * 1024_u64; // 4GB
        let segment = calculate_segment_seconds(limit, "htdemucs", 44100, 2);
        assert!(segment >= 5.0, "segment {} should be >= 5.0", segment);
        assert!(segment <= 30.0, "segment {} should be <= 30.0", segment);
    }

    #[test]
    fn test_calculate_segment_seconds_2gb_shorter() {
        let limit_2gb = 2 * 1024 * 1024 * 1024_u64;
        let limit_4gb = 4 * 1024 * 1024 * 1024_u64;
        let seg_2gb = calculate_segment_seconds(limit_2gb, "htdemucs", 44100, 2);
        let seg_4gb = calculate_segment_seconds(limit_4gb, "htdemucs", 44100, 2);
        assert!(seg_2gb < seg_4gb, "2GB segment {} should be shorter than 4GB segment {}", seg_2gb, seg_4gb);
    }

    #[test]
    fn test_calculate_segment_seconds_clamps_minimum() {
        // Very small memory limit should clamp to 5.0
        let segment = calculate_segment_seconds(100_000_000, "htdemucs", 44100, 2);
        assert_eq!(segment, 5.0);
    }
}
