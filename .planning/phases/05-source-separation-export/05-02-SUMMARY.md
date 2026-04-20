---
phase: 05-source-separation-export
plan: 02
subsystem: ml
tags: [demucs-mlx, mlx, source-separation, grpc, protobuf, chunked-processing]

requires:
  - phase: 04-ml-analysis-pipeline
    provides: gRPC proto, Python sidecar, AnalyzerBase, gRPC server

provides:
  - SeparateStems gRPC RPC with streaming progress
  - SeparationAnalyzer with chunked demucs-mlx processing
  - Overlap-add crossfading for seamless chunk boundaries
  - Cancellation support between chunks

affects: [05-03-rust-bridge, 05-05-frontend-separation-ui]

tech-stack:
  added: [demucs-mlx, mlx]
  patterns: [chunked-ml-processing, overlap-add-crossfade, threaded-grpc-streaming]

key-files:
  created:
    - sidecar/src/wallflower_sidecar/analyzers/separation.py
    - sidecar/tests/test_separation.py
  modified:
    - proto/wallflower_analysis.proto
    - sidecar/pyproject.toml
    - sidecar/src/wallflower_sidecar/server.py

key-decisions:
  - "Used SEPARATION_COMPLETED/SEPARATION_FAILED enum names to avoid protobuf duplicate conflict with StepStatus enum"
  - "Threaded separation in gRPC handler to allow progress streaming while separation runs"
  - "_test_audio parameter on separate() to enable unit testing without file I/O"

patterns-established:
  - "Chunked ML processing: calculate_chunks -> process each -> overlap-add crossfade"
  - "Cancellation via threading.Event checked between chunks"

requirements-completed: [AI-04, AI-10]

duration: 4min
completed: 2026-04-20
---

# Phase 5 Plan 2: Demucs-MLX Separation Analyzer Summary

**Chunked source separation via demucs-mlx with overlap-add crossfading, gRPC streaming progress, and inter-chunk cancellation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-20T10:57:09Z
- **Completed:** 2026-04-20T11:01:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended gRPC proto with SeparateStems RPC and all supporting messages (SeparateRequest, SeparationProgress, SeparationStatus, StemFile)
- Implemented SeparationAnalyzer with chunked processing, linear crossfade overlap-add, and cancellation support
- Added gRPC SeparateStems handler with threaded execution and streaming progress
- 8 unit tests passing: chunk calculation, crossfade math, cancellation, availability check

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend gRPC proto with SeparateStems RPC and add demucs-mlx dependency** - `f26182e` (feat)
2. **Task 2 RED: Add failing tests for SeparationAnalyzer** - `2c0af60` (test)
3. **Task 2 GREEN: Implement SeparationAnalyzer and gRPC handler** - `7db8dec` (feat)

## Files Created/Modified
- `proto/wallflower_analysis.proto` - Added SeparateStems RPC, SeparateRequest, SeparationProgress, SeparationStatus, StemFile messages
- `sidecar/pyproject.toml` - Added demucs-mlx and mlx dependencies
- `sidecar/src/wallflower_sidecar/analyzers/separation.py` - SeparationAnalyzer with chunked demucs-mlx, crossfade, cancellation
- `sidecar/src/wallflower_sidecar/server.py` - SeparateStems gRPC handler with threaded streaming
- `sidecar/tests/test_separation.py` - 8 tests for chunking, crossfade, cancellation, availability

## Decisions Made
- Used SEPARATION_COMPLETED/SEPARATION_FAILED instead of COMPLETED/FAILED for SeparationStatus enum to avoid protobuf duplicate name conflict with existing StepStatus enum values
- Used threading for separation in gRPC handler to enable concurrent progress streaming while ML model processes
- Added _test_audio parameter to separate() method to allow unit testing without requiring real audio files or demucs model

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed protobuf enum name collision**
- **Found during:** Task 1
- **Issue:** Plan specified COMPLETED/FAILED for SeparationStatus but these clash with existing StepStatus enum values in same proto file
- **Fix:** Renamed to SEPARATION_COMPLETED and SEPARATION_FAILED
- **Files modified:** proto/wallflower_analysis.proto
- **Verification:** Proto compiles, stubs generate successfully
- **Committed in:** f26182e

**2. [Rule 1 - Bug] Fixed cancellation test logic**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** Test set cancel flag before calling separate(), but separate() calls reset_cancel() at start, clearing the flag
- **Fix:** Rewrote test to use mock separator that sets cancel flag after first chunk processes
- **Files modified:** sidecar/tests/test_separation.py
- **Verification:** All 8 tests pass
- **Committed in:** 7db8dec

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SeparateStems RPC ready for Plan 03 (Rust bridge) to consume via gRPC client
- SeparationAnalyzer ready for Plan 05 (frontend) to trigger via API
- demucs-mlx model will be downloaded on first use at runtime

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 05-source-separation-export*
*Completed: 2026-04-20*
