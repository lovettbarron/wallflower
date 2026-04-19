---
phase: 01-tauri-app-shell-storage-api-foundation
plan: 03
subsystem: core, frontend, docs
tags: [watcher, device-detection, documentation, release]
dependency_graph:
  requires: [01-02]
  provides: [folder-watcher, device-detection, project-docs]
  affects: [phase-1-completion]
tech_stack:
  added: [notify-v8]
  patterns: [debounce-thread, atomic-bool-flags, volume-scanning]
key_files:
  created:
    - crates/wallflower-core/src/watcher/mod.rs
    - crates/wallflower-core/src/device/mod.rs
    - src/components/device-import-dialog.tsx
    - agents.md
  modified:
    - crates/wallflower-core/src/lib.rs
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-app/src/commands/status.rs
    - crates/wallflower-cli/src/main.rs
    - README.md
    - src/app/page.tsx
decisions:
  - "Used notify v8 (latest) instead of v7 specified in CLAUDE.md -- v8 is current stable"
  - "Device detection scans /Volumes/ with max 3 directory depth for balance of coverage vs performance"
  - "Watcher uses separate debounce thread with AtomicBool flags rather than async/await"
metrics:
  duration: 13m
  completed: 2026-04-19T04:46:40Z
  tasks: 3/3
  files_changed: 11
---

# Phase 01 Plan 03: Folder Watcher, Device Detection & Documentation Summary

Folder watcher with 5-second debounce auto-imports audio from ~/wallflower, USB device scanner detects Zoom F3 recorders on /Volumes/, and device import dialog lets users select files to import.

## What Was Done

### Task 1: Folder Watcher and Device Detection (440cacd)

**Watcher module** (`crates/wallflower-core/src/watcher/mod.rs`):
- `start_watcher()` creates a `notify::RecommendedWatcher` with mpsc channel
- Separate debounce thread maintains a `HashMap<PathBuf, Instant>` of pending files
- After 5 seconds of no further modifications, files are auto-imported via `import::import_file`
- `WatcherHandle` provides `is_active()` and `stop()` with AtomicBool flags
- Watcher starts automatically on Tauri app launch with graceful failure handling

**Device module** (`crates/wallflower-core/src/device/mod.rs`):
- `detect_devices()` scans `/Volumes/` for mounted volumes containing audio files
- `is_zoom_recorder()` detects Zoom F3/H6-style directory patterns (ZOOM0001/, STEREO/)
- `find_audio_files_on_device()` recursively finds audio files limited to 3 directory levels
- Returns `DeviceInfo` with device name, mount point, and file list

**App integration:**
- `AppState` now holds `watcher: Mutex<Option<WatcherHandle>>`
- `get_status` reports real watcher active state
- `get_connected_devices` returns actual device detection results
- CLI `devices` subcommand lists connected recorders

**Tests:** 10 new tests covering watcher auto-import, Zoom detection patterns, file scanning depth.

### Task 2: Documentation (fc8b009)

**README.md:** Comprehensive documentation with installation, CLI usage examples, architecture overview, development guide, roadmap, and license.

**agents.md:** Phase 1 feedback tracking with decisions (refinery drop, notify version), skills learned (Tauri IPC, atomic import), and established patterns.

Note: Release build (`cargo build --release`) could not be verified due to disk space constraints (136MB free). Dev build succeeds cleanly.

### Task 3: Device Import Dialog (e828141)

**DeviceImportDialog component** (`src/components/device-import-dialog.tsx`):
- Modal overlay listing detected devices with their audio files
- Checkbox selection with Select All / Deselect All per device
- Import progress indicator with progress bar
- Result summary showing imported/duplicate/error counts
- Integrated into main page via "Check Devices" button

TypeScript compiles cleanly with `npx tsc --noEmit`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed find_audio_files_on_device depth**
- **Found during:** Task 1
- **Issue:** `WalkDir::max_depth(2)` only scans root + 1 level, missing files at depth 2
- **Fix:** Changed to `max_depth(3)` to cover root + 2 levels as intended
- **Files modified:** crates/wallflower-core/src/device/mod.rs

**2. [Rule 1 - Bug] Fixed watcher thread race in test**
- **Found during:** Task 1
- **Issue:** `is_active()` assertion failed because thread hadn't set AtomicBool yet
- **Fix:** Added 100ms sleep before assertion
- **Files modified:** crates/wallflower-core/src/watcher/mod.rs

**3. [Rule 2 - Missing] Added Database::default_path()**
- **Found during:** Task 1
- **Issue:** Watcher needs DB path for opening connections but no method existed
- **Fix:** Added `Database::default_path()` method to db module
- **Files modified:** crates/wallflower-core/src/db/mod.rs

### Deferred Issues

- Release build verification blocked by disk space (136MB free, needs ~500MB+)
- Device detection picks up all volumes with audio files, not just removable devices -- acceptable for Phase 1, can be refined later with volume type checking

## Known Stubs

None -- all data sources are wired to real implementations.

## Self-Check: PASSED
