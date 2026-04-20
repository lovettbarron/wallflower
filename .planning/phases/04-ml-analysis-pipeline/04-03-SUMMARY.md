---
phase: 04-ml-analysis-pipeline
plan: 03
subsystem: ml-analysis
tags: [essentia, librosa, grpc, tempo, key, sections, loops, python]

# Dependency graph
requires:
  - phase: 04-01
    provides: AnalyzerBase ABC, protobuf contract, ModelManager, hardware detection
provides:
  - TempoAnalyzer using essentia RhythmExtractor2013
  - KeyAnalyzer using essentia KeyExtractor with edma profile
  - SectionAnalyzer using librosa Laplacian segmentation with silhouette optimization
  - LoopAnalyzer using chroma self-similarity with diagonal stripe detection
  - gRPC AnalysisServer with streaming AnalyzeJam RPC
  - Model manager persistence tests
affects: [04-04, 04-05, 05-source-separation]

# Tech tracking
tech-stack:
  added: [essentia RhythmExtractor2013, essentia KeyExtractor, librosa Laplacian segmentation, sklearn KMeans/silhouette]
  patterns: [AnalyzerBase subclass pattern, gRPC server-streaming progress per step, skip_steps + LIGHTWEIGHT profile gating]

key-files:
  created:
    - sidecar/src/wallflower_sidecar/analyzers/tempo.py
    - sidecar/src/wallflower_sidecar/analyzers/key.py
    - sidecar/src/wallflower_sidecar/analyzers/sections.py
    - sidecar/src/wallflower_sidecar/analyzers/loops.py
    - sidecar/src/wallflower_sidecar/server.py
    - sidecar/tests/test_tempo.py
    - sidecar/tests/test_key.py
    - sidecar/tests/test_sections.py
    - sidecar/tests/test_loops.py
    - sidecar/tests/test_models.py
  modified:
    - sidecar/src/wallflower_sidecar/__main__.py
    - sidecar/src/wallflower_sidecar/wallflower_analysis_pb2_grpc.py

key-decisions:
  - "essentia RhythmExtractor2013 multifeature method for tempo — handles beats_confidence as float (not array)"
  - "Laplacian segmentation with silhouette score optimization across k=2-8 for section detection"
  - "Chroma self-similarity matrix with diagonal stripe detection for loop finding"
  - "MFCC feature distance for evolving loop detection (D-05 threshold 0.15)"
  - "Fixed pb2_grpc import to use package-qualified path for in-package use"

patterns-established:
  - "Analyzer subclass pattern: inherit AnalyzerBase, implement analyze() and is_available()"
  - "gRPC streaming: yield STARTED then COMPLETED/FAILED/SKIPPED for each analysis step"
  - "Profile-gated analysis: LIGHTWEIGHT skips sections and loops"

requirements-completed: [AI-01, AI-02, AI-03, AI-05]

# Metrics
duration: 5min
completed: 2026-04-20
---

# Phase 04 Plan 03: ML Analyzers Summary

**Four ML analyzers (tempo, key, sections, loops) with essentia/librosa and gRPC streaming server exposing sequential analysis pipeline**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-20T05:14:16Z
- **Completed:** 2026-04-20T05:19:34Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Tempo detection via essentia RhythmExtractor2013 returning BPM, confidence, and beat positions
- Key detection via essentia KeyExtractor with edma profile returning key, scale, and strength
- Section detection via librosa Laplacian segmentation with silhouette-optimized k, labeling Intro/A/B/Outro
- Loop detection via chroma self-similarity with diagonal stripe detection and MFCC-based evolving flag
- gRPC AnalysisServer streaming progress per analysis step with skip and profile gating
- 23 tests all passing (13 analyzer + 7 model manager + 3 base/provider)

## Task Commits

Each task was committed atomically:

1. **Task 1: Tempo, key, section, and loop analyzers** - `0dfada1` (feat)
2. **Task 2: gRPC server and model manager tests** - `1af04d2` (feat)

## Files Created/Modified
- `sidecar/src/wallflower_sidecar/analyzers/tempo.py` - BPM detection via essentia RhythmExtractor2013
- `sidecar/src/wallflower_sidecar/analyzers/key.py` - Key/scale detection via essentia KeyExtractor
- `sidecar/src/wallflower_sidecar/analyzers/sections.py` - Structural section detection via librosa Laplacian segmentation
- `sidecar/src/wallflower_sidecar/analyzers/loops.py` - Loop detection via chroma self-similarity matrix
- `sidecar/src/wallflower_sidecar/server.py` - gRPC AnalysisServer with streaming AnalyzeJam RPC
- `sidecar/src/wallflower_sidecar/__main__.py` - Updated to wire gRPC server with logging
- `sidecar/src/wallflower_sidecar/wallflower_analysis_pb2_grpc.py` - Fixed import path
- `sidecar/tests/test_tempo.py` - 4 tests for tempo detection
- `sidecar/tests/test_key.py` - 3 tests for key detection
- `sidecar/tests/test_sections.py` - 3 tests for section detection
- `sidecar/tests/test_loops.py` - 3 tests for loop detection
- `sidecar/tests/test_models.py` - 7 tests for model manager

## Decisions Made
- essentia RhythmExtractor2013 returns beats_confidence as a float (not array) in current version; handled with type check
- Section detection uses silhouette score to pick optimal k between 2 and 8, with KMeans on Laplacian eigenvectors
- Loop detection uses non-overlapping region tracking to avoid duplicate detections
- MFCC feature distance threshold of 0.15 for evolving loop detection (configurable via params)
- Fixed generated pb2_grpc.py bare import to package-qualified import for correct in-package resolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed beats_confidence type handling in TempoAnalyzer**
- **Found during:** Task 1 (Tempo analyzer implementation)
- **Issue:** essentia RhythmExtractor2013 returns beats_confidence as a float, not an array; calling len() on it caused TypeError
- **Fix:** Added isinstance check to handle both float and array return types
- **Files modified:** sidecar/src/wallflower_sidecar/analyzers/tempo.py
- **Verification:** All tempo tests pass
- **Committed in:** 0dfada1

**2. [Rule 3 - Blocking] Fixed pb2_grpc import path**
- **Found during:** Task 2 (gRPC server implementation)
- **Issue:** Generated wallflower_analysis_pb2_grpc.py used bare import `import wallflower_analysis_pb2` which fails when imported as part of the wallflower_sidecar package
- **Fix:** Changed to `from wallflower_sidecar import wallflower_analysis_pb2`
- **Files modified:** sidecar/src/wallflower_sidecar/wallflower_analysis_pb2_grpc.py
- **Verification:** `from wallflower_sidecar.server import AnalysisServer` succeeds
- **Committed in:** 1af04d2

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four analyzers are ready to be called by the Rust backend via gRPC
- The sidecar can be started with `python -m wallflower_sidecar --port 50051`
- Plan 04-04 (sidecar integration) can now connect to and call the analysis service

---
*Phase: 04-ml-analysis-pipeline*
*Completed: 2026-04-20*
