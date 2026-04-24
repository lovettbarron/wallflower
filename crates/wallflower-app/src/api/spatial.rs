use axum::{http::StatusCode, Json};
use serde_json::{json, Value};

use wallflower_core::db::{self, Database};

/// GET /api/jams/spatial -- returns all jams with analysis + metadata for spatial explorer
pub async fn get_spatial_data() -> (StatusCode, Json<Value>) {
    let db_path = Database::default_path();
    match Database::open(&db_path) {
        Ok(db) => match db::list_jams_spatial(&db.conn) {
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
