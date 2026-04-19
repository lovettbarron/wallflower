---
phase: 01-tauri-app-shell-storage-api-foundation
plan: 02
subsystem: core-backend
tags: [import, hashing, metadata, tauri-ipc, cli, axum-api]
dependency_graph:
  requires: ["01-01"]
  provides: ["import-pipeline", "tauri-ipc-commands", "cli-tool", "axum-api-skeleton"]
  affects: ["01-03", "02-01"]
tech_stack:
  added: [sha2, symphonia, walkdir, axum, tower-http]
  patterns: [atomic-copy-import, content-hash-dedup, mutex-wrapped-state]
key_files:
  created:
    - crates/wallflower-core/src/import/mod.rs
    - crates/wallflower-core/src/import/hasher.rs
    - crates/wallflower-core/src/import/metadata.rs
    - crates/wallflower-core/src/settings/mod.rs
    - crates/wallflower-app/src/commands/mod.rs
    - crates/wallflower-app/src/commands/import.rs
    - crates/wallflower-app/src/commands/jams.rs
    - crates/wallflower-app/src/commands/settings.rs
    - crates/wallflower-app/src/commands/status.rs
    - crates/wallflower-app/src/api/mod.rs
  modified:
    - crates/wallflower-core/src/lib.rs
    - crates/wallflower-core/Cargo.toml
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-app/Cargo.toml
    - crates/wallflower-cli/src/main.rs
decisions:
  - "Axum API server on port 23516 (unlikely to conflict with common services)"
  - "Content hash is SHA-256 hex (64 chars) for reliable duplicate detection"
  - "Symphonia metadata extraction with graceful fallback (never blocks import)"
  - "Settings routes use method chaining (.get().put()) for same path"
metrics:
  duration: 8min
  completed: 2026-04-19T04:30:00Z
---

# Phase 01 Plan 02: Import Pipeline, Tauri IPC & API Skeleton Summary

Atomic copy-first import pipeline with SHA-256 duplicate detection, 9 Tauri IPC commands matching the TypeScript contract, CLI with import/list/status/settings subcommands, and axum HTTP API skeleton with 19 stub endpoints.

## What Was Done

### Task 1: Import Pipeline
- **Hasher** (`import/hasher.rs`): Streaming SHA-256 with 8KB buffer chunks, constant memory regardless of file size
- **Metadata** (`import/metadata.rs`): Symphonia-based audio probe extracting duration, sample rate, bit depth, channels, format; graceful fallback on probe failure
- **Import** (`import/mod.rs`): Full pipeline -- validate extension, hash, duplicate check, metadata extract, atomic copy (tempfile + fsync + rename), DB insert. Supports single file, batch, and recursive directory import
- **Settings** (`settings/mod.rs`): Config loading from DB with tilde expansion, sync folder detection (Dropbox, iCloud, OneDrive, Google Drive), storage directory management

### Task 2: Tauri IPC Commands & CLI
- **9 IPC commands** registered via `tauri::generate_handler!`: list_jams, get_jam, import_files, import_directory, import_from_device, get_settings, update_settings, get_status, get_connected_devices
- **AppState** with Mutex-wrapped Database and AppConfig for thread-safe access
- **CLI** expanded from 1 to 4 subcommands: import (file/dir), list (table/json), status, settings (view/update)

### Task 3: Axum HTTP API Skeleton
- **19 stub endpoints** all returning 501 Not Implemented with JSON error body
- Domains covered: jams, playback, recording, analysis, export, settings, devices, status
- CORS enabled via tower-http for frontend development
- Server spawned as background tokio task on port 23516

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9eeee97 | Import pipeline with atomic copy, SHA-256 hashing, metadata, duplicate detection |
| 2 | 13b7b40 | Tauri IPC commands and CLI subcommands |
| 3 | 75c7abf | Axum HTTP API skeleton with 501 stub endpoints |

## Test Results

23 unit tests passing across wallflower-core:
- 2 hasher tests (consistency, difference)
- 2 metadata tests (nonexistent file, WAV extraction)
- 6 import tests (WAV import, duplicate skip, unsupported format, directory, atomic copy, unique filename)
- 5 settings tests (defaults, save/reload, sync folder detection, tilde expansion, ensure dir)
- 8 existing DB tests (unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate content in directory import test**
- **Found during:** Task 1 test verification
- **Issue:** test_import_directory created two WAV files with identical sample count, producing identical content hashes. Second file was detected as duplicate instead of imported.
- **Fix:** Used different sample counts (22050 vs 44100) to produce distinct content hashes.
- **Files modified:** crates/wallflower-core/src/import/mod.rs
- **Commit:** 9eeee97

**2. [Rule 1 - Bug] Unused import warning in metadata.rs**
- **Found during:** Task 2 build
- **Issue:** `use crate::error::Result` was imported but extract() returns AudioMetadata directly (not Result) by design for graceful fallback.
- **Fix:** Removed unused import.
- **Files modified:** crates/wallflower-core/src/import/metadata.rs
- **Commit:** 13b7b40

**3. [Rule 1 - Bug] Unused import warning for axum put routing**
- **Found during:** Task 3 build
- **Issue:** Settings route uses method chaining `.get(handler).put(handler)` instead of separate `put()` routing function.
- **Fix:** Removed `put` from the routing imports.
- **Files modified:** crates/wallflower-app/src/api/mod.rs
- **Commit:** 75c7abf

**4. [Rule 3 - Blocking] Axum route syntax updated for 0.8**
- **Found during:** Task 3
- **Issue:** Plan specified `:id` parameter syntax but axum 0.8 uses `{id}` syntax.
- **Fix:** Used `{id}` syntax in all parameterized routes.
- **Files modified:** crates/wallflower-app/src/api/mod.rs
- **Commit:** 75c7abf

## Known Stubs

| File | Location | Stub | Reason |
|------|----------|------|--------|
| crates/wallflower-app/src/commands/status.rs | get_connected_devices | Returns empty vec | Device detection implemented in plan 01-03 |
| crates/wallflower-app/src/commands/status.rs | get_status | watcher_active: false | File watcher implemented in plan 01-03 |
| crates/wallflower-app/src/api/mod.rs | All 19 routes | Return 501 Not Implemented | Routes will be connected to real handlers in subsequent phases |

These stubs are intentional and documented -- they will be resolved by plans 01-03 (devices, watcher) and Phase 2+ (playback, recording, analysis, export).

## Verification

- `cargo build --workspace` exits 0 (clean, no warnings)
- `cargo test --workspace` exits 0 (23 tests pass)
- `cargo run -p wallflower-cli -- status` prints jam count, watch folder, storage dir
- `cargo run -p wallflower-cli -- list` prints empty library message
- All 9 Tauri IPC commands registered in invoke_handler
- All planned API endpoints stubbed with 501

## Self-Check: PASSED

All 10 created files verified on disk. All 3 task commits (9eeee97, 13b7b40, 75c7abf) verified in git log.
