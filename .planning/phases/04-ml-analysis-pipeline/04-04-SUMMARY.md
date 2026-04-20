---
phase: 04-ml-analysis-pipeline
plan: 04
subsystem: analysis
tags: [grpc, tonic, sidecar, tauri-commands, analysis-pipeline]

requires:
  - phase: 04-02
    provides: Analysis tables, queue, provider trait, protobuf contract

provides:
  - SidecarManager for spawning/monitoring Python sidecar process
  - gRPC client wrapper for analysis calls (tonic-generated)
  - Tauri commands for analysis operations (analyze, re-analyze, manual overrides)
  - Axum API routes for analysis results and manual overrides
  - TypeScript types and invoke wrappers for frontend integration
  - Manual override DB methods for tempo and key (D-18)

affects: [04-05-analysis-ui, 04-06-search-filter, 05-source-separation]

tech-stack:
  added: [anyhow, tonic-prost (runtime)]
  patterns: [sidecar-lifecycle-management, grpc-streaming-to-tauri-events, lazy-spawn-on-demand]

key-files:
  created:
    - crates/wallflower-app/src/sidecar/mod.rs
    - crates/wallflower-app/src/sidecar/grpc_client.rs
    - crates/wallflower-app/src/commands/analysis.rs
    - crates/wallflower-app/src/api/analysis.rs
  modified:
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-app/src/commands/mod.rs
    - crates/wallflower-app/src/api/mod.rs
    - crates/wallflower-app/Cargo.toml
    - crates/wallflower-core/src/db/mod.rs
    - src/lib/types.ts
    - src/lib/tauri.ts

key-decisions:
  - "Upgraded prost from 0.13 to 0.14 to match tonic-prost runtime codec requirements"
  - "SidecarManager initialized with None for app_handle at startup (resolve_sidecar_dir fallback to CARGO_MANIFEST_DIR)"
  - "Analysis commands use tauri::State for sync operations, AppHandle for async streaming operations"

patterns-established:
  - "Sidecar lifecycle: lazy spawn via ensure_running(), health check polling, max 3 restarts, kill on Drop"
  - "gRPC streaming to Tauri events: iterate tonic::Streaming, save each result to DB, emit analysis-progress event"
  - "Recording priority gate: check scheduler.may_proceed() before and between analysis steps"

requirements-completed: [AI-06, AI-09]

duration: 9min
completed: 2026-04-20
---

# Phase 04 Plan 04: Rust Sidecar Integration Summary

**Sidecar lifecycle manager, gRPC client bridge, analysis Tauri commands, and event streaming connecting Rust backend to Python ML sidecar**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-20T05:01:24Z
- **Completed:** 2026-04-20T05:10:27Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

### Task 1: Sidecar process manager and gRPC client
- Created `SidecarManager` with lazy spawn on first analysis request (D-06)
- Max 3 restart attempts on crash (D-08), process killed on Drop (D-07)
- Path resolution: env var > Tauri resource_dir > CARGO_MANIFEST_DIR fallback
- gRPC client wraps tonic-generated code for health check, hardware info, and analysis streaming

### Task 2: Analysis Tauri commands, API routes, event bridge, TypeScript types
- 9 Tauri commands: analyze_jam, queue_pending_analysis, prioritize_analysis, reanalyze_jam, set/clear_manual_tempo, set/clear_manual_key, get_analysis_results
- Analysis progress streams via "analysis-progress" Tauri events with result payloads
- Recording priority checked before and between analysis steps (D-17)
- Axum API routes for analysis results and manual overrides (CLI access)
- DB methods for manual tempo/key overrides with proper INSERT OR REPLACE (D-18)
- TypeScript types: AnalysisResults, AnalysisProgressPayload, SectionRecord, LoopRecord, TempoResult, KeyResult
- Tauri invoke wrappers for all analysis commands

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] prost version mismatch**
- **Found during:** Task 1
- **Issue:** tonic-prost 0.14 depends on prost 0.14 but Cargo.toml had prost 0.13, causing codec trait bound failures
- **Fix:** Upgraded prost from 0.13 to 0.14 in wallflower-app/Cargo.toml
- **Files modified:** crates/wallflower-app/Cargo.toml
- **Commit:** fe88b46

**2. [Rule 3 - Blocking] Missing anyhow and tonic-prost dependencies**
- **Found during:** Task 1
- **Issue:** SidecarManager uses anyhow::Result, generated code uses tonic_prost::ProstCodec
- **Fix:** Added anyhow and tonic-prost to dependencies
- **Files modified:** crates/wallflower-app/Cargo.toml
- **Commit:** fe88b46

**3. [Rule 2 - Missing] DB methods for manual overrides not present**
- **Found during:** Task 2
- **Issue:** Plan specified set_manual_tempo/key and clear_manual_tempo/key but they didn't exist in db/mod.rs
- **Fix:** Added 4 DB functions with proper INSERT OR REPLACE and manual_override flag
- **Files modified:** crates/wallflower-core/src/db/mod.rs
- **Commit:** 74beae4

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | fe88b46 | feat(04-04): sidecar process manager and gRPC client |
| 2 | 74beae4 | feat(04-04): analysis Tauri commands, API routes, event bridge, and TypeScript types |

## Verification

- `cargo check -p wallflower-app` -- compiles with 0 errors
- `cargo test -p wallflower-core --lib` -- 95 tests pass
- TypeScript types and invoke wrappers added for all analysis operations

## Known Stubs

None -- all functions are fully wired to DB operations or gRPC calls.
