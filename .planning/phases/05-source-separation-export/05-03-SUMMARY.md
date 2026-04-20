---
phase: 05-source-separation-export
plan: 03
subsystem: app
tags: [tauri-commands, bookmarks, export, separation, grpc, typescript]
dependency_graph:
  requires: [05-01 bookmark CRUD and export pipeline, 05-02 demucs-mlx separation analyzer]
  provides: [Tauri bookmark CRUD commands, audio export command, stem separation command with progress, TypeScript types and invoke wrappers]
  affects: [05-04, 05-05]
tech_stack:
  added: []
  patterns: [atomic cancellation via Arc<AtomicBool>, stem cache hit/miss helper, memory-limit-aware chunk sizing]
key_files:
  created:
    - crates/wallflower-app/src/commands/bookmarks.rs
    - crates/wallflower-app/src/commands/export.rs
  modified:
    - crates/wallflower-app/src/commands/mod.rs
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-app/src/sidecar/grpc_client.rs
    - crates/wallflower-core/src/analysis/queue.rs
    - src/lib/types.ts
    - src/lib/tauri.ts
decisions:
  - "Used Arc<AtomicBool> for separation cancellation instead of channel-based approach for simplicity"
  - "Stem cache validated by checking both DB entries AND file existence on disk"
  - "Export settings read from DB settings table with sensible defaults (24-bit WAV, ~/wallflower/exports)"
metrics:
  duration: 9min
  completed: 2026-04-20
---

# Phase 5 Plan 03: Tauri Bridge for Bookmarks, Export, and Separation Summary

Tauri command layer bridging Plan 01 backend (bookmark CRUD, export pipeline) and Plan 02 sidecar (demucs-mlx separation) to the frontend via typed commands, gRPC streaming, progress events, and stem caching with memory-limit-aware chunk sizing.

## What Was Built

### Task 1: Tauri Bookmark CRUD Commands and gRPC Separation Bridge

- **Bookmark commands** (`commands/bookmarks.rs`): create_bookmark, get_bookmarks, update_bookmark (with stem cache invalidation on time range change), delete_bookmark (cascade handles cleanup).
- **Export commands** (`commands/export.rs`):
  - `export_audio`: Fetches bookmark+jam from DB, resolves export path with collision avoidance, calls `export_time_slice`, generates JSON sidecar with analysis metadata (key, bpm, tags, collaborators, instruments), records in exports table, emits `export-complete` event.
  - `separate_stems`: Checks stem cache first (cache hit returns immediately). On miss, computes `segment_seconds` from `memory_limit_gb` via `calculate_segment_seconds` (D-15), calls gRPC `SeparateStems`, streams `separation-progress` Tauri events, pauses between chunks when `scheduler.may_proceed()` is false (recording priority), saves stems to cache on completion.
  - `export_stems`: Copies cached stem WAV files to export directory, generates JSON sidecar with stems list.
  - `cancel_separation`: Sets atomic cancellation flag checked during stream processing.
- **Helper functions**: `should_use_cache` validates cache entries exist on disk for the requested model.
- **gRPC client extension**: Added `separate_stems` function to grpc_client.rs.
- **Queue extension**: Added `Separation` variant to `JobPriority` enum.
- **AppState extension**: Added `separation_cancel: Arc<AtomicBool>` field.
- **Command registration**: All 8 new commands registered in Tauri invoke handler.

### Task 2: TypeScript Types and Invoke Wrappers

- **Types** (`src/lib/types.ts`): BookmarkRecord, CreateBookmarkInput, UpdateBookmarkInput, ExportRecord, StemInfo, SeparationProgressEvent, BookmarkColor union type, BOOKMARK_COLORS constant (8 colors with fill/border/solid HSL variants), STEM_COLORS constant (6 instrument colors).
- **Invoke wrappers** (`src/lib/tauri.ts`): createBookmark, getBookmarks, updateBookmark, deleteBookmark, exportAudio, separateStems, exportStems, cancelSeparation -- all with correct type signatures and parameter naming (camelCase for Tauri's serde rename).

## Test Results

- 7 bookmark tests pass (CRUD, cascade delete, export records)
- 14 export tests pass (sanitize, resolve paths, sidecar JSON, time-slice writer, segment calculator)
- `cargo build -p wallflower-app` compiles clean (0 warnings)
- `npx tsc --noEmit` passes with all new TypeScript types

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 7bc44dd | feat(05-03): Tauri commands for bookmark CRUD, audio export, and stem separation |
| 2 | 143200b | feat(05-03): TypeScript types and Tauri invoke wrappers for bookmarks and export |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DB function name mismatches**
- **Found during:** Task 1
- **Issue:** Plan referenced `get_tags`, `get_collaborators`, `get_instruments` but actual DB functions are `list_tags_for_jam`, `list_collaborators_for_jam`, `list_instruments_for_jam`
- **Fix:** Used correct function names in export.rs
- **Files modified:** crates/wallflower-app/src/commands/export.rs

## Known Stubs

None -- all commands are fully implemented with working DB operations, gRPC calls, and file I/O.

## Self-Check: PASSED
