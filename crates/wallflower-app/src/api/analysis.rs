use axum::{
    extract::Path,
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use wallflower_core::db::Database;

/// GET /api/jams/:id/analysis -- returns analysis results
pub async fn get_analysis(Path(id): Path<String>) -> (StatusCode, Json<Value>) {
    let db_path = Database::default_path();
    match Database::open(&db_path) {
        Ok(db) => match wallflower_core::db::get_jam_analysis_results(&db.conn, &id) {
            Ok(results) => match serde_json::to_value(results) {
                Ok(v) => (StatusCode::OK, Json(v)),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": e.to_string() })),
                ),
            },
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            ),
        },
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        ),
    }
}

/// POST /api/jams/:id/analyze -- triggers analysis (stub for now; real impl uses Tauri command)
pub async fn trigger_analysis(Path(_id): Path<String>) -> (StatusCode, Json<Value>) {
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "message": "Analysis queued. Use Tauri commands for full streaming support.",
            "note": "This endpoint is provided for CLI/API access. For streaming progress, use the Tauri IPC analyze_jam command."
        })),
    )
}

/// POST /api/jams/:id/reanalyze -- re-triggers analysis (stub)
pub async fn trigger_reanalysis(Path(_id): Path<String>) -> (StatusCode, Json<Value>) {
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "message": "Re-analysis queued. Use Tauri commands for full streaming support."
        })),
    )
}

#[derive(Deserialize)]
pub struct ManualTempoPayload {
    pub bpm: f64,
}

/// PUT /api/jams/:id/tempo -- manual tempo override
pub async fn set_manual_tempo(
    Path(id): Path<String>,
    Json(payload): Json<ManualTempoPayload>,
) -> (StatusCode, Json<Value>) {
    let db_path = Database::default_path();
    match Database::open(&db_path) {
        Ok(db) => match wallflower_core::db::set_manual_tempo(&db.conn, &id, payload.bpm) {
            Ok(()) => (StatusCode::OK, Json(json!({ "ok": true }))),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            ),
        },
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        ),
    }
}

#[derive(Deserialize)]
pub struct ManualKeyPayload {
    pub key_name: String,
    pub scale: String,
}

/// PUT /api/jams/:id/key -- manual key override
pub async fn set_manual_key(
    Path(id): Path<String>,
    Json(payload): Json<ManualKeyPayload>,
) -> (StatusCode, Json<Value>) {
    let db_path = Database::default_path();
    match Database::open(&db_path) {
        Ok(db) => {
            match wallflower_core::db::set_manual_key(&db.conn, &id, &payload.key_name, &payload.scale) {
                Ok(()) => (StatusCode::OK, Json(json!({ "ok": true }))),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": e.to_string() })),
                ),
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        ),
    }
}
