---
phase: 04-ml-analysis-pipeline
plan: 01
subsystem: ml-infrastructure
tags: [grpc, protobuf, python, essentia, tonic, prost, sqlite, fts5, sidecar]

# Dependency graph
requires:
  - phase: 03-recording-engine-system-integration
    provides: PriorityScheduler, recording tables, existing DB schema
provides:
  - gRPC proto contract between Rust backend and Python sidecar
  - Python sidecar project with ML dependencies (essentia, librosa, grpcio)
  - AnalyzerBase ABC for model-swappable analysis (AI-08)
  - ModelManager for model download/versioning/caching
  - SQLite V4 migration with analysis tables and FTS5 search
  - Rust AnalysisProvider trait and AnalysisQueue with priority
affects: [04-02, 04-03, 04-04, 04-05, 05-source-separation]

# Tech tracking
tech-stack:
  added: [tonic-prost-build 0.14, tonic 0.14, prost 0.13, tonic-health 0.14, tokio-stream 0.1, essentia 2.1b6, librosa 0.10, grpcio 1.x, uv, protobuf]
  patterns: [gRPC proto-first IPC, Python sidecar with uv, AnalyzerBase ABC for model swapping, FTS5 for full-text search]

key-files:
  created:
    - proto/wallflower_analysis.proto
    - sidecar/pyproject.toml
    - sidecar/src/wallflower_sidecar/analyzers/base.py
    - sidecar/src/wallflower_sidecar/models/manager.py
    - sidecar/src/wallflower_sidecar/hardware.py
    - migrations/V4__analysis_tables.sql
    - crates/wallflower-core/src/analysis/mod.rs
    - crates/wallflower-core/src/analysis/provider.rs
    - crates/wallflower-core/src/analysis/queue.rs
  modified:
    - crates/wallflower-app/Cargo.toml
    - crates/wallflower-app/build.rs
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-core/src/db/schema.rs
    - crates/wallflower-core/src/lib.rs

key-decisions:
  - "Used tonic-prost-build instead of tonic-build for tonic 0.14 API (configure/compile_protos moved)"
  - "essentia pinned to >=2.1b6.dev1389 (only available version on PyPI for Python 3.13)"
  - "AnalysisProvider trait is synchronous (not async_trait) to avoid unnecessary dependency"
  - "FTS5 with porter tokenizer for full-text search across jam metadata"

patterns-established:
  - "Proto-first IPC: define .proto, generate stubs for both Rust and Python"
  - "AnalyzerBase ABC: all analysis steps implement this for model swapping (AI-08)"
  - "Manual override protection: save_tempo/key check manual_override flag before writing (D-18)"
  - "Analysis queue with view priority (D-16) and recording resume (D-17)"

requirements-completed: [AI-07, AI-08, AI-09]

# Metrics
duration: 10min
completed: 2026-04-19
---

# Phase 4 Plan 01: Foundation Summary

**gRPC proto contract, Python ML sidecar with essentia/librosa, SQLite V4 analysis tables with FTS5, and Rust analysis queue/provider abstractions**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-19T20:34:18Z
- **Completed:** 2026-04-19T20:44:41Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments
- Defined gRPC AnalysisService proto with streaming progress, tempo/key/sections/loops results, hardware info, and health check
- Created Python sidecar project with all ML dependencies (essentia, librosa, grpcio, scikit-learn) managed by uv
- Built AnalyzerBase ABC enabling model swapping via configuration only (AI-08)
- Added SQLite V4 migration with 7 new tables including FTS5 full-text search for META-08
- Implemented Rust AnalysisProvider trait, AnalysisQueue with priority support, and 10 analysis DB methods

## Task Commits

Each task was committed atomically:

1. **Task 1: Environment setup, protobuf definition, and Python sidecar project** - `526efd7` (feat)
2. **Task 2: SQLite V4 migration and Rust analysis module types** - `03a8342` (feat)

## Files Created/Modified
- `proto/wallflower_analysis.proto` - gRPC service contract between Rust and Python
- `sidecar/pyproject.toml` - Python sidecar project with ML dependencies
- `sidecar/src/wallflower_sidecar/analyzers/base.py` - AnalyzerBase ABC for model swapping
- `sidecar/src/wallflower_sidecar/models/manager.py` - ModelManager for model download/caching
- `sidecar/src/wallflower_sidecar/hardware.py` - Hardware detection and profile recommendation
- `sidecar/tests/conftest.py` - Test audio fixtures (sine wave, complex audio)
- `sidecar/tests/test_provider.py` - AI-08 provider abstraction tests
- `migrations/V4__analysis_tables.sql` - Analysis result tables and FTS5 search
- `crates/wallflower-core/src/analysis/provider.rs` - Rust AnalysisProvider trait
- `crates/wallflower-core/src/analysis/queue.rs` - Priority analysis queue
- `crates/wallflower-core/src/db/schema.rs` - Analysis result types (AnalysisStatus, TempoResult, etc.)
- `crates/wallflower-core/src/db/mod.rs` - V4 migration + 10 analysis DB methods

## Decisions Made
- Used `tonic-prost-build` instead of `tonic-build` for build dependency -- tonic 0.14 moved `configure()` and `compile_protos()` to the separate `tonic-prost-build` crate
- Pinned essentia to `>=2.1b6.dev1389` since that is the only version available on PyPI for Python 3.13
- Made AnalysisProvider trait synchronous (not async_trait) to avoid adding async-trait dependency to wallflower-core
- Used FTS5 with porter tokenizer for full-text jam search (META-08 requirement)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tonic-build API changed in 0.14**
- **Found during:** Task 1 (proto compilation)
- **Issue:** `tonic_build::configure()` no longer exists in tonic-build 0.14 -- function moved to tonic-prost-build
- **Fix:** Changed build dependency from `tonic-build` to `tonic-prost-build` and updated build.rs to use `tonic_prost_build::configure()`
- **Files modified:** crates/wallflower-app/Cargo.toml, crates/wallflower-app/build.rs
- **Verification:** `cargo build -p wallflower-app` succeeds
- **Committed in:** 03a8342 (Task 2 commit)

**2. [Rule 3 - Blocking] essentia version pinning for Python 3.13**
- **Found during:** Task 1 (uv sync)
- **Issue:** `essentia>=2.1b6` could not resolve because only `2.1b6.dev1389` is available
- **Fix:** Changed version constraint to `>=2.1b6.dev1389`
- **Files modified:** sidecar/pyproject.toml
- **Verification:** `uv sync --python 3.13` succeeds
- **Committed in:** 526efd7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for compilation/dependency resolution. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Proto contract ready for Plan 02 (concrete analyzer implementations)
- Python sidecar project ready for Plan 03 (gRPC server implementation)
- SQLite schema ready for analysis result storage
- Rust analysis module ready for queue integration with PriorityScheduler

## Known Stubs
None - all files contain complete implementations for their intended scope.

## Self-Check: PASSED

All 9 key files verified present. Both task commits (526efd7, 03a8342) verified in git log.

---
*Phase: 04-ml-analysis-pipeline*
*Completed: 2026-04-19*
