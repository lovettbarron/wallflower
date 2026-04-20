use tonic::transport::Channel;

// Include generated protobuf code
pub mod wallflower_analysis {
    tonic::include_proto!("wallflower.analysis");
}

use wallflower_analysis::{
    analysis_service_client::AnalysisServiceClient, AnalyzeRequest, HardwareInfoRequest,
    HealthRequest,
};
pub use wallflower_analysis::AnalysisProfile as ProtoProfile;
pub use wallflower_analysis::AnalysisProgress;

/// Check sidecar health via gRPC.
pub async fn check_health(port: u16) -> anyhow::Result<bool> {
    let addr = format!("http://127.0.0.1:{}", port);
    let channel = Channel::from_shared(addr)?.connect().await?;
    let mut client = AnalysisServiceClient::new(channel);
    let response = client.get_health(HealthRequest {}).await?;
    Ok(response.into_inner().healthy)
}

/// Get hardware info and recommended profile from sidecar.
#[allow(dead_code)]
pub async fn get_hardware_info(
    port: u16,
) -> anyhow::Result<wallflower_analysis::HardwareInfoResponse> {
    let addr = format!("http://127.0.0.1:{}", port);
    let channel = Channel::from_shared(addr)?.connect().await?;
    let mut client = AnalysisServiceClient::new(channel);
    let response = client.get_hardware_info(HardwareInfoRequest {}).await?;
    Ok(response.into_inner())
}

/// Run analysis on a jam, yielding progress updates as a stream.
/// The caller should iterate the stream and forward each AnalysisProgress
/// to the frontend via Tauri events.
pub async fn analyze_jam(
    port: u16,
    jam_id: &str,
    audio_path: &str,
    profile: ProtoProfile,
    skip_steps: Vec<String>,
) -> anyhow::Result<tonic::Streaming<AnalysisProgress>> {
    let addr = format!("http://127.0.0.1:{}", port);
    let channel = Channel::from_shared(addr)?.connect().await?;
    let mut client = AnalysisServiceClient::new(channel);
    let request = AnalyzeRequest {
        jam_id: jam_id.to_string(),
        audio_path: audio_path.to_string(),
        profile: profile.into(),
        skip_steps,
    };
    let response = client.analyze_jam(request).await?;
    Ok(response.into_inner())
}
