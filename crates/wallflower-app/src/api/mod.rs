mod analysis;

use std::path::PathBuf;

use axum::http::StatusCode;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

/// Handler that returns 501 Not Implemented for all stub endpoints.
async fn not_implemented() -> (StatusCode, Json<Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "error": "Not implemented",
            "message": "This endpoint is planned but not yet implemented"
        })),
    )
}

/// Build the API router with all planned endpoints stubbed out.
/// Endpoints are organized by domain and annotated with the phase
/// in which they will be connected to real handlers.
pub fn api_router(audio_dir: PathBuf) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Audio file serving — streams files from the storage directory
        .nest_service("/api/audio", ServeDir::new(audio_dir))
        // Jams (Phase 1 - will be connected to real handlers)
        .route("/api/jams", get(not_implemented))
        .route("/api/jams/{id}", get(not_implemented))
        .route("/api/jams/import", post(not_implemented))
        // Playback (Phase 2)
        .route("/api/playback/play", post(not_implemented))
        .route("/api/playback/pause", post(not_implemented))
        .route("/api/playback/stop", post(not_implemented))
        .route("/api/playback/seek", post(not_implemented))
        .route("/api/playback/status", get(not_implemented))
        // Recording (Phase 3+)
        .route("/api/recording/start", post(not_implemented))
        .route("/api/recording/stop", post(not_implemented))
        .route("/api/recording/status", get(not_implemented))
        // Analysis (Phase 4)
        .route("/api/jams/{id}/analysis", get(analysis::get_analysis))
        .route("/api/jams/{id}/analyze", post(analysis::trigger_analysis))
        .route("/api/jams/{id}/reanalyze", post(analysis::trigger_reanalysis))
        .route("/api/jams/{id}/tempo", put(analysis::set_manual_tempo))
        .route("/api/jams/{id}/key", put(analysis::set_manual_key))
        // Export (Phase 5+)
        .route("/api/export", post(not_implemented))
        .route("/api/export/status/{id}", get(not_implemented))
        // Settings
        .route("/api/settings", get(not_implemented).put(not_implemented))
        // Devices
        .route("/api/devices", get(not_implemented))
        // Status / health
        .route("/api/status", get(not_implemented))
        .layer(cors)
}

/// Start the API server on the given port (bound to localhost only).
pub async fn start_api_server(port: u16, audio_dir: PathBuf) {
    let app = api_router(audio_dir);
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .expect("failed to bind API server");
    tracing::info!("API server listening on http://127.0.0.1:{}", port);
    axum::serve(listener, app)
        .await
        .expect("API server error");
}
