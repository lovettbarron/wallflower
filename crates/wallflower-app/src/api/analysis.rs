use axum::{
    extract::{Path, Query},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use wallflower_core::db::{self, Database, SearchFilter};

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

/// Query parameters for the search API endpoint.
#[derive(Deserialize)]
pub struct SearchQuery {
    pub query: Option<String>,
    pub keys: Option<String>,       // comma-separated
    pub tempo_min: Option<f64>,
    pub tempo_max: Option<f64>,
    pub tags: Option<String>,       // comma-separated
    pub collaborators: Option<String>,
    pub instruments: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub location: Option<String>,
}

/// GET /api/jams/search -- search/filter jams
pub async fn search_jams_api(
    Query(q): Query<SearchQuery>,
) -> (StatusCode, Json<Value>) {
    let filter = SearchFilter {
        query: q.query,
        keys: q.keys.map(|s| s.split(',').map(|v| v.trim().to_string()).collect()),
        tempo_min: q.tempo_min,
        tempo_max: q.tempo_max,
        tags: q.tags.map(|s| s.split(',').map(|v| v.trim().to_string()).collect()),
        collaborators: q.collaborators.map(|s| s.split(',').map(|v| v.trim().to_string()).collect()),
        instruments: q.instruments.map(|s| s.split(',').map(|v| v.trim().to_string()).collect()),
        date_from: q.date_from,
        date_to: q.date_to,
        location: q.location,
    };

    let db_path = Database::default_path();
    match Database::open(&db_path) {
        Ok(db_inst) => match db::search_jams(&db_inst.conn, &filter) {
            Ok(jams) => match serde_json::to_value(jams) {
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

/// GET /api/jams/filter-options -- get available filter option values
pub async fn get_filter_options_api() -> (StatusCode, Json<Value>) {
    let db_path = Database::default_path();
    match Database::open(&db_path) {
        Ok(db_inst) => {
            let keys = db::get_distinct_keys(&db_inst.conn).unwrap_or_default();
            let tags = db::list_all_tags(&db_inst.conn).unwrap_or_default();
            let collaborators = db::list_all_collaborators(&db_inst.conn).unwrap_or_default();
            let instruments = db::list_all_instruments(&db_inst.conn).unwrap_or_default();
            let (tempo_min, tempo_max) = db::get_tempo_range(&db_inst.conn).unwrap_or((60.0, 200.0));
            (
                StatusCode::OK,
                Json(json!({
                    "keys": keys,
                    "tags": tags,
                    "collaborators": collaborators,
                    "instruments": instruments,
                    "tempoMin": tempo_min,
                    "tempoMax": tempo_max,
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        ),
    }
}
