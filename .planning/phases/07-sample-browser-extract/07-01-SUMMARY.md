---
phase: "07-sample-browser-extract"
plan: "01"
subsystem: "backend-data-layer"
tags: [sample-browser, cross-jam-query, union-sql, tauri-commands, direct-export]
dependency_graph:
  requires: [phase-04-analysis, phase-05-bookmarks-exports]
  provides: [get_all_samples, get_sample_filter_options, export_sample_audio, separate_sample_stems]
  affects: [frontend-sample-browser]
tech_stack:
  added: []
  patterns: [UNION-ALL-CTE, dynamic-parameterized-filtering]
key_files:
  created:
    - crates/wallflower-app/src/commands/samples.rs
  modified:
    - crates/wallflower-core/src/db/schema.rs
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-app/src/commands/export.rs
    - crates/wallflower-app/src/commands/mod.rs
    - crates/wallflower-app/src/lib.rs
decisions:
  - "D-16/D-17: export_sample_audio and separate_sample_stems accept raw jam_id + time range, skip exports table record (no bookmark_id)"
  - "Used correlated subqueries in UNION ALL for key_display and tempo_bpm to avoid complex multi-table JOINs inside each branch"
  - "Cache key for separate_sample_stems uses jam_id + sample_name + time range composite string"
metrics:
  duration: "4m 30s"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
---

# Phase 07 Plan 01: Sample Browser Backend Summary

Cross-jam sample aggregation with UNION ALL CTE, filtered querying via parameterized dynamic SQL, and direct sample export without bookmark intermediary.

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Rust types and cross-jam UNION query | e475b76 | SampleRecord/SampleFilter/SampleFilterOptions types, get_all_samples() UNION ALL query, get_sample_filter_options() |
| 2 | Tauri commands for samples and direct sample export | c8ac262 | commands/samples.rs, export_sample_audio, separate_sample_stems, generate_handler! registration |

## Implementation Details

### Task 1: Data Layer
- Added three new structs to `schema.rs`: `SampleRecord` (15 fields), `SampleFilter` (9 filter dimensions), `SampleFilterOptions` (7 option sets)
- `get_all_samples()` uses a CTE wrapping UNION ALL across bookmarks, jam_sections, and jam_loops, each JOINed with jams and using correlated subqueries for key_display and tempo_bpm
- Dynamic filtering follows the same `param_idx` + `conditions` + `param_values` pattern from `search_jams()` -- all values bound via positional `?N` parameters (T-07-01)
- Query capped at `LIMIT 5000` (T-07-03)
- `get_sample_filter_options()` reuses `get_distinct_keys()`, `list_all_tags()`, `get_tempo_range()` and adds duration range from all three sample tables

### Task 2: Tauri Commands
- Created `commands/samples.rs` with `get_all_samples` and `get_sample_filter_options` commands following the jams.rs pattern
- Added `export_sample_audio` to export.rs accepting `(jam_id, start_seconds, end_seconds, sample_name)` -- follows same export flow as `export_audio` but without bookmark lookup or exports table record
- Added `separate_sample_stems` to export.rs accepting same raw parameters -- follows `separate_stems` flow with a composite cache key instead of bookmark_id
- Both new export commands use `resolve_export_path()` for path sanitization (T-07-02)
- All four commands registered in `generate_handler!` macro in lib.rs

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `cargo test --workspace`: 123 passed, 0 failed
- `cargo build -p wallflower-app`: success (no errors)
- All threat mitigations implemented: T-07-01 (parameterized queries), T-07-02 (path sanitization), T-07-03 (LIMIT 5000)

## Self-Check: PASSED

All 6 files verified present. Both commits (e475b76, c8ac262) found in history. All key artifacts confirmed: SampleRecord, SampleFilter, SampleFilterOptions structs; get_all_samples, get_sample_filter_options functions; UNION ALL query; pub mod samples; all 4 commands registered in generate_handler!; export_sample_audio and separate_sample_stems in export.rs.
