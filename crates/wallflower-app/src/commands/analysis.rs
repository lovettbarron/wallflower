use std::sync::atomic::Ordering;

use tauri::{command, AppHandle, Emitter, Manager};
use tokio_stream::StreamExt;

use crate::sidecar::grpc_client;
use crate::AppState;

/// Trigger analysis for a specific jam. Streams progress via Tauri events (AI-06).
#[command]
pub async fn analyze_jam(app: AppHandle, jam_id: String) -> Result<(), String> {
    // Get jam info from DB
    let (audio_path, profile) = {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let jam = wallflower_core::db::get_jam(&db.conn, &jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", jam_id))?;
        // Get analysis profile from settings, default to "full"
        let profile_str = wallflower_core::db::get_setting(&db.conn, "analysis_profile")
            .ok()
            .flatten()
            .unwrap_or_else(|| "full".to_string());
        (jam.file_path.clone(), profile_str)
    };

    // Check if analysis engine is provisioned
    {
        let state = app.state::<AppState>();
        if !state.sidecar_ready.load(Ordering::Acquire) {
            return Err("Analysis engine is being set up (first launch only). Please try again in a few minutes.".into());
        }
    }

    // Ensure sidecar is running (D-06: lazy start)
    let port = {
        let state = app.state::<AppState>();
        let mut sidecar = state.sidecar.lock().await;
        sidecar.ensure_running().await.map_err(|e| e.to_string())?
    };

    // Check recording priority (D-17)
    {
        let state = app.state::<AppState>();
        if !state.scheduler.may_proceed() {
            return Err("Recording in progress -- analysis deferred".to_string());
        }
    }

    // Update analysis status in DB
    {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        wallflower_core::db::set_analysis_status(&db.conn, &jam_id, "analyzing", None)
            .map_err(|e| e.to_string())?;
    }

    // Map profile string to proto enum
    let proto_profile = match profile.as_str() {
        "standard" => grpc_client::ProtoProfile::Standard,
        "lightweight" => grpc_client::ProtoProfile::Lightweight,
        _ => grpc_client::ProtoProfile::Full,
    };

    // Determine skip_steps based on profile
    let skip_steps = match profile.as_str() {
        "lightweight" => vec!["SECTIONS".to_string(), "LOOPS".to_string()],
        _ => vec![],
    };

    // Call gRPC and stream results
    let stream_result =
        grpc_client::analyze_jam(port, &jam_id, &audio_path, proto_profile, skip_steps).await;

    match stream_result {
        Ok(mut stream) => {
            let mut stream_error = false;
            while let Some(progress) = stream.next().await {
                match progress {
                    Ok(p) => {
                        // Emit Tauri event for frontend (AI-06 progressive results)
                        let step_name = match p.step {
                            0 => "tempo",
                            1 => "key",
                            2 => "sections",
                            3 => "loops",
                            _ => "unknown",
                        };
                        let status_name = match p.status {
                            0 => "started",
                            1 => "completed",
                            2 => "failed",
                            3 => "skipped",
                            _ => "unknown",
                        };

                        // Save completed results to DB
                        if p.status == 1 {
                            // COMPLETED
                            let state = app.state::<AppState>();
                            let db = state.db.lock().map_err(|e| e.to_string())?;

                            // Save result based on step type using the oneof result field
                            if let Some(ref result) = p.result {
                                match result {
                                    grpc_client::wallflower_analysis::analysis_progress::Result::Tempo(t) => {
                                        let _ = wallflower_core::db::save_tempo_result(
                                            &db.conn,
                                            &jam_id,
                                            t.bpm as f64,
                                            t.confidence as f64,
                                        );
                                        // Save beat positions if present
                                        if !t.beats.is_empty() {
                                            let beat_times: Vec<f64> = t.beats.iter().map(|b| b.time_seconds as f64).collect();
                                            let _ = wallflower_core::db::save_beats(&db.conn, &jam_id, &beat_times);
                                        }
                                    }
                                    grpc_client::wallflower_analysis::analysis_progress::Result::Key(k) => {
                                        let _ = wallflower_core::db::save_key_result(
                                            &db.conn,
                                            &jam_id,
                                            &k.key,
                                            &k.scale,
                                            k.strength as f64,
                                        );
                                    }
                                    grpc_client::wallflower_analysis::analysis_progress::Result::Sections(s) => {
                                        let sections: Vec<wallflower_core::db::schema::SectionRecord> = s
                                            .sections
                                            .iter()
                                            .enumerate()
                                            .map(|(i, sec)| wallflower_core::db::schema::SectionRecord {
                                                id: uuid::Uuid::new_v4().to_string(),
                                                jam_id: jam_id.clone(),
                                                start_seconds: sec.start_seconds as f64,
                                                end_seconds: sec.end_seconds as f64,
                                                label: sec.label.clone(),
                                                cluster_id: sec.cluster_id,
                                                sort_order: i as i32,
                                            })
                                            .collect();
                                        let _ = wallflower_core::db::save_sections(&db.conn, &jam_id, &sections);
                                    }
                                    grpc_client::wallflower_analysis::analysis_progress::Result::Loops(l) => {
                                        let loops: Vec<wallflower_core::db::schema::LoopRecord> = l
                                            .loops
                                            .iter()
                                            .enumerate()
                                            .map(|(i, lp)| wallflower_core::db::schema::LoopRecord {
                                                id: uuid::Uuid::new_v4().to_string(),
                                                jam_id: jam_id.clone(),
                                                start_seconds: lp.start_seconds as f64,
                                                end_seconds: lp.end_seconds as f64,
                                                repeat_count: lp.repeat_count,
                                                evolving: lp.evolving,
                                                label: lp.label.clone(),
                                                sort_order: i as i32,
                                            })
                                            .collect();
                                        let _ = wallflower_core::db::save_loops(&db.conn, &jam_id, &loops);
                                    }
                                }
                            }

                            wallflower_core::db::set_analysis_status(
                                &db.conn,
                                &jam_id,
                                "analyzing",
                                Some(step_name),
                            )
                            .map_err(|e| e.to_string())?;
                        }

                        // Build event payload with result data if available
                        let mut payload = serde_json::json!({
                            "jamId": p.jam_id,
                            "step": step_name,
                            "status": status_name,
                        });

                        // Add result data for completed steps
                        if let Some(ref result) = p.result {
                            match result {
                                grpc_client::wallflower_analysis::analysis_progress::Result::Tempo(t) => {
                                    payload["result"] = serde_json::json!({
                                        "bpm": t.bpm,
                                        "confidence": t.confidence,
                                    });
                                }
                                grpc_client::wallflower_analysis::analysis_progress::Result::Key(k) => {
                                    payload["result"] = serde_json::json!({
                                        "key": k.key,
                                        "scale": k.scale,
                                        "strength": k.strength,
                                    });
                                }
                                grpc_client::wallflower_analysis::analysis_progress::Result::Sections(s) => {
                                    payload["result"] = serde_json::json!({
                                        "sections": s.sections.iter().map(|sec| serde_json::json!({
                                            "startSeconds": sec.start_seconds,
                                            "endSeconds": sec.end_seconds,
                                            "label": sec.label,
                                            "clusterId": sec.cluster_id,
                                        })).collect::<Vec<_>>()
                                    });
                                }
                                grpc_client::wallflower_analysis::analysis_progress::Result::Loops(l) => {
                                    payload["result"] = serde_json::json!({
                                        "loops": l.loops.iter().map(|lp| serde_json::json!({
                                            "startSeconds": lp.start_seconds,
                                            "endSeconds": lp.end_seconds,
                                            "repeatCount": lp.repeat_count,
                                            "evolving": lp.evolving,
                                            "label": lp.label,
                                        })).collect::<Vec<_>>()
                                    });
                                }
                            }
                        }

                        let _ = app.emit("analysis-progress", payload);

                        // Check recording priority between steps (D-17)
                        let state = app.state::<AppState>();
                        if !state.scheduler.may_proceed() {
                            // Recording started -- abort analysis, re-queue
                            let _ = app.emit(
                                "analysis-progress",
                                serde_json::json!({
                                    "jamId": jam_id,
                                    "step": step_name,
                                    "status": "interrupted",
                                }),
                            );
                            return Ok(());
                        }
                    }
                    Err(e) => {
                        tracing::error!("gRPC stream error: {}", e);
                        stream_error = true;
                        break;
                    }
                }
            }

            if stream_error {
                let state = app.state::<AppState>();
                let db = state.db.lock().map_err(|e| e.to_string())?;
                wallflower_core::db::set_analysis_status(&db.conn, &jam_id, "failed", None)
                    .map_err(|e| e.to_string())?;
                return Err("Analysis failed: gRPC stream error".to_string());
            }

            // Mark analysis complete
            let state = app.state::<AppState>();
            {
                let db = state.db.lock().map_err(|e| e.to_string())?;
                wallflower_core::db::set_analysis_status(&db.conn, &jam_id, "complete", None)
                    .map_err(|e| e.to_string())?;

                // Update FTS index with latest data
                let _ = wallflower_core::db::update_fts_index(&db.conn, &jam_id);
            }

            // Reset sidecar restart count on success
            let mut sidecar = state.sidecar.lock().await;
            sidecar.reset_restart_count();
        }
        Err(e) => {
            // Sidecar may have crashed -- attempt restart (D-08)
            let state = app.state::<AppState>();
            let db = state.db.lock().map_err(|e| e.to_string())?;
            wallflower_core::db::set_analysis_status(&db.conn, &jam_id, "failed", None)
                .map_err(|e| e.to_string())?;
            return Err(format!("Analysis failed: {}", e));
        }
    }

    Ok(())
}

/// Queue analysis for all unanalyzed jams. Called after import or on app launch.
#[command]
pub async fn queue_pending_analysis(app: AppHandle) -> Result<usize, String> {
    let pending = {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        wallflower_core::db::get_pending_analysis_jams(&db.conn).map_err(|e| e.to_string())?
    };
    let count = pending.len();

    // Spawn background task to process queue
    let app_clone = app.clone();
    tokio::spawn(async move {
        for jam_id in pending {
            // Check priority before each analysis
            let state = app_clone.state::<AppState>();
            if !state.scheduler.may_proceed() {
                tracing::info!("Recording active, pausing analysis queue");
                break;
            }
            if let Err(e) = analyze_jam(app_clone.clone(), jam_id.clone()).await {
                tracing::warn!("Analysis failed for {}: {}", jam_id, e);
            }
        }
    });
    Ok(count)
}

/// Prioritize analysis for the currently-viewed jam (D-16).
#[command]
pub async fn prioritize_analysis(app: AppHandle, jam_id: String) -> Result<(), String> {
    // If jam is already analyzed, no-op
    {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let status =
            wallflower_core::db::get_analysis_status(&db.conn, &jam_id).map_err(|e| e.to_string())?;
        if let Some(s) = &status {
            if s.status == "complete" {
                return Ok(());
            }
        }
    }

    // Spawn analysis immediately for this jam
    let app_clone = app.clone();
    tokio::spawn(async move {
        if let Err(e) = analyze_jam(app_clone, jam_id.clone()).await {
            tracing::warn!("Prioritized analysis failed for {}: {}", jam_id, e);
        }
    });
    Ok(())
}

/// Re-analyze a jam (D-19). Clears previous results (except manual overrides).
#[command]
pub async fn reanalyze_jam(app: AppHandle, jam_id: String) -> Result<(), String> {
    {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        wallflower_core::db::set_analysis_status(&db.conn, &jam_id, "pending", None)
            .map_err(|e| e.to_string())?;
        // Note: save_tempo_result and save_key_result check manual_override,
        // so re-analysis won't overwrite manual values (D-18, D-19)
    }
    // User-initiated retry gets fresh restart attempts
    {
        let state = app.state::<AppState>();
        let mut sidecar = state.sidecar.lock().await;
        sidecar.reset_restart_count();
    }
    analyze_jam(app, jam_id).await
}

/// Manually override tempo for a jam (D-18).
#[command]
pub fn set_manual_tempo(
    state: tauri::State<'_, AppState>,
    jam_id: String,
    bpm: f64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    wallflower_core::db::set_manual_tempo(&db.conn, &jam_id, bpm).map_err(|e| e.to_string())?;
    Ok(())
}

/// Manually override key for a jam (D-18).
#[command]
pub fn set_manual_key(
    state: tauri::State<'_, AppState>,
    jam_id: String,
    key_name: String,
    scale: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    wallflower_core::db::set_manual_key(&db.conn, &jam_id, &key_name, &scale)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Clear manual override for tempo (D-18).
#[command]
pub fn clear_manual_tempo(
    state: tauri::State<'_, AppState>,
    jam_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    wallflower_core::db::clear_manual_tempo(&db.conn, &jam_id).map_err(|e| e.to_string())?;
    Ok(())
}

/// Clear manual override for key (D-18).
#[command]
pub fn clear_manual_key(
    state: tauri::State<'_, AppState>,
    jam_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    wallflower_core::db::clear_manual_key(&db.conn, &jam_id).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get analysis results for a jam.
#[command]
pub fn get_analysis_results(
    state: tauri::State<'_, AppState>,
    jam_id: String,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let results =
        wallflower_core::db::get_jam_analysis_results(&db.conn, &jam_id).map_err(|e| e.to_string())?;
    serde_json::to_value(results).map_err(|e| e.to_string())
}
