# Phase 4: ML Analysis Pipeline - Research

**Researched:** 2026-04-19
**Domain:** gRPC IPC, Python ML sidecar, audio analysis (tempo/key/sections/loops), progressive UI updates
**Confidence:** MEDIUM-HIGH

## Summary

Phase 4 introduces the Python ML sidecar for audio analysis (tempo, key, sections, loops), connected to the Rust backend via gRPC, with results streaming to the frontend via Tauri events. This is the first phase that spans all three layers of the stack (Rust, Python, React) with a new IPC mechanism.

The core analysis algorithms are well-established: essentia's standard algorithms (KeyExtractor, RhythmExtractor2013) handle key and tempo detection without TensorFlow, while librosa's Laplacian segmentation handles section boundary detection. Loop detection requires a custom approach using self-similarity matrices. The gRPC layer (tonic + grpcio) is mature and well-documented. The main risks are: (1) essentia-tensorflow does NOT work on macOS ARM64, so TempoCNN is unavailable -- standard algorithms must be used; (2) the system has Python 3.14 but essentia only supports up to 3.13, requiring uv to manage a compatible Python version; (3) section/loop detection requires custom implementation since no off-the-shelf library handles this for long-form jam recordings.

**Primary recommendation:** Use essentia standard algorithms (no TensorFlow) for key/tempo, librosa for section segmentation via novelty-based detection, and custom self-similarity analysis for loop detection. Manage the Python sidecar via uv with Python 3.13, communicating over gRPC with tonic/grpcio. Stream results to the frontend via Tauri events (not SSE -- simpler given existing Tauri event infrastructure).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Jam cards always show key and BPM badge slots. Values display when available; subtle "--" placeholders when analysis is pending. Layout never shifts.
- **D-02:** Section boundaries shown as colored vertical lines with short labels ("Intro", "Verse A", "Loop 1") on the waveform in the detail view. Colors differentiate section types. Consistent with Ableton arrangement markers.
- **D-03:** Analysis progress shown as a subtle "Analyzing..." status badge on the jam card, plus a detailed progress section in the jam detail view showing which steps are done (tempo check, key check, sections pending...).
- **D-04:** Analysis results in the jam detail view displayed as a compact summary row of chips/badges (Key, BPM, Section count, Loop count) below the waveform, alongside existing metadata. Clicking a chip could expand to show details in a future phase.
- **D-05:** Detected loops shown as bracketed regions on the waveform (like repeat brackets in sheet music). Each bracket shows repeat count and whether the loop evolves (e.g., "Loop A x4" vs "Loop A x4 (evolving)"). Part of the section markers system.
- **D-06:** Sidecar starts lazily on first analysis request, not on app launch.
- **D-07:** Sidecar stays alive while the app is running once started.
- **D-08:** If sidecar crashes, Rust backend auto-restarts it and re-queues the failed analysis. Max 3 retries before marking as failed.
- **D-09:** Analysis pipeline runs sequentially per jam: tempo -> key -> sections -> loops. One step at a time. Results stream to UI as each step completes.
- **D-10:** Models download in the background on first analysis request. Progress indicator shown in Settings. App is fully usable.
- **D-11:** Settings shows which models are installed, their versions, and disk usage.
- **D-12:** Horizontal filter bar above the timeline with dropdown selectors for Key, Tempo range, Tags, Collaborators, Instruments, Date range. Filters combine with AND logic. Active filters shown as removable chips.
- **D-13:** Tempo filter uses a dual-handle range slider (e.g., 110-130 BPM).
- **D-14:** Key filter uses a dropdown listing all detected keys with multi-select support.
- **D-15:** Free-text search box that matches against jam notes, tags, collaborators, instruments, and filenames.
- **D-16:** Queue ordering: currently-viewed jam jumps to front of queue. Otherwise FIFO.
- **D-17:** When recording starts, analysis is interrupted immediately and re-queued at front.
- **D-18:** Users can manually override detected key and BPM values. UI shows whether a value was AI-detected or manually set.
- **D-19:** A "Re-analyze" action in the jam detail view re-runs the full pipeline for that jam.
- **D-20:** Analysis runs on any Apple Silicon hardware but with graceful degradation.
- **D-21:** User can override the analysis profile in Settings. Lightweight profile skips the heaviest models.

### Claude's Discretion
- gRPC service definition and protobuf message design
- SSE vs Tauri event channel for streaming analysis results to the frontend
- Analysis step ordering within the sequential pipeline
- Hardware detection method and profile thresholds
- Model download/versioning implementation details
- SQLite schema migration for analysis results (new columns vs new tables)
- Filter bar component implementation details
- How "evolving loop" detection works under the hood

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | Detect tempo (BPM) from recordings using local AI models | essentia RhythmExtractor2013 (standard, no TF needed). HIGH confidence. |
| AI-02 | Detect musical key and chord progressions from recordings | essentia KeyExtractor (standard, no TF needed). HIGH confidence. |
| AI-03 | Identify structural sections and phrase boundaries | librosa Laplacian segmentation + novelty-based detection on self-similarity matrix. MEDIUM confidence -- requires custom integration. |
| AI-05 | Identify repeated sections/loops and detect when loops change substantially | Custom algorithm: self-similarity matrix + diagonal stripe detection + feature delta analysis for "evolving" detection. MEDIUM confidence -- novel implementation. |
| AI-06 | Analysis runs as background pipeline with progressive results via SSE | Tauri events (existing infrastructure) preferred over SSE. gRPC streaming from Python -> Rust, Tauri events from Rust -> frontend. HIGH confidence. |
| AI-07 | Models downloaded at runtime, cached in app support dir, reused across updates | uv manages Python environment + model files in ~/Library/Application Support/wallflower/models/. MEDIUM confidence on essentia model packaging. |
| AI-08 | Model interface abstracted for configuration-based swapping | Rust AnalysisProvider trait + Python AnalyzerBase ABC with config-driven model selection. HIGH confidence -- standard pattern. |
| AI-09 | Model downloads do not block any other app functionality | Lazy sidecar start (D-06) + async model download in Python + PriorityScheduler gate. HIGH confidence. |
| META-08 | Search and filter jams by any metadata field | SQLite queries with parameterized WHERE clauses + FTS5 for free-text search. HIGH confidence. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Tauri v2 + Rust backend + React/Next.js frontend + Python sidecar (ML models)
- **Database**: SQLite via rusqlite (0.39, bundled), WAL mode, manual SQL migrations with include_str!
- **AI/ML**: All models run locally. Models cached in user data directory, versioned.
- **Recording priority**: Active recording preempts ALL processing. PriorityScheduler already implemented.
- **IPC**: gRPC via tonic (Rust) + grpcio (Python). Protobuf definitions shared.
- **Python management**: uv for sidecar dependencies and virtual environment.
- **Licensing**: MIT for project code. No GPL dependencies in core. LGPL acceptable via dynamic linking.
- **Testing**: Full test coverage across all components.

## Standard Stack

### Core (Rust - gRPC Server)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tonic | 0.14.5 | gRPC server implementation | Standard Rust gRPC. Async/await, server streaming for progress. |
| tonic-build | 0.14.5 | Protobuf codegen (build.rs) | Companion to tonic. Generates Rust types from .proto files. |
| prost | 0.14.3 | Protobuf message types | Standard protobuf for Rust, used by tonic. |
| tonic-health | 0.14.x | gRPC health checking | Standard health check service for sidecar liveness probing. |
| tokio-stream | 0.1.x | Stream utilities for async | ReceiverStream adapter for server-streaming RPCs. |

### Core (Python - gRPC Client + ML)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| essentia | 2.1b6.dev1389 | Key, tempo, tonal analysis | Standard MIR library. KeyExtractor, RhythmExtractor2013. ARM64 macOS wheels available. |
| librosa | 0.10.x | Audio loading, segmentation, features | Standard audio analysis. Laplacian segmentation for section detection. |
| grpcio | 1.80.0 | gRPC client (IPC with Rust) | Official Google gRPC Python library. Matches tonic on Rust side. |
| grpcio-tools | 1.80.x | Python protobuf codegen | Generates Python stubs from .proto files. |
| numpy | 2.x | Numerical computing | Foundation for all audio/ML processing. |
| soundfile | 0.13.x | Audio file I/O | Reading audio files in Python sidecar. |
| scipy | 1.x | Signal processing | Used by librosa segmentation (spectral clustering, filtering). |
| scikit-learn | 1.x | K-means clustering | Used in Laplacian segmentation for section labeling. |

### Frontend (React)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (existing) @tanstack/react-query | 5.x | Server state / API caching | Already in use. For analysis status polling and jam data with analysis results. |
| (existing) zustand | 5.x | Client state | Already in use. For filter state, analysis queue status. |
| (existing) wavesurfer.js | 7.12.x | Waveform display | Already in use. Regions plugin for section markers and loop brackets. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| essentia standard KeyExtractor | essentia TempoCNN (TF) | TempoCNN is more accurate for tempo but essentia-tensorflow is BROKEN on macOS ARM64. Standard algorithms are good enough. |
| librosa Laplacian segmentation | MSAF (Music Structure Analysis Framework) | MSAF is more feature-rich but abandoned (last update 2019). librosa's built-in segmentation is actively maintained. |
| Custom loop detection | PyMusicLooper | PyMusicLooper finds seamless loop points for playback, not repeated sections in long recordings. Different problem. |
| Tauri events for UI updates | SSE from axum | SSE would require a separate HTTP endpoint. Tauri events already work, are used extensively (recording events), and are simpler. |
| tonic gRPC | Unix domain sockets | gRPC provides schema validation, streaming, codegen. Raw sockets need custom protocol. |

**Installation (Rust):**
```bash
# Add to wallflower-app Cargo.toml [dependencies]
tonic = "0.14"
prost = "0.14"
tonic-health = "0.14"
tokio-stream = "0.1"

# Add to [build-dependencies]
tonic-build = "0.14"
```

**Installation (Python sidecar via uv):**
```bash
brew install uv protobuf
uv python install 3.13
uv init --python 3.13 sidecar/
cd sidecar && uv add essentia librosa grpcio grpcio-tools numpy soundfile scipy scikit-learn
```

## Architecture Patterns

### Recommended Project Structure
```
wallflower/
  proto/
    wallflower_analysis.proto     # Shared protobuf definitions
  crates/
    wallflower-core/src/
      analysis/
        mod.rs                    # Analysis types, queue, provider trait
        queue.rs                  # Analysis job queue (FIFO + priority)
        provider.rs               # AnalysisProvider trait (model abstraction)
      db/
        schema.rs                 # Extended with analysis result types
  crates/
    wallflower-app/src/
      api/
        analysis.rs               # Analysis-related API routes
      commands/
        analysis.rs               # Tauri commands for analysis
      sidecar/
        mod.rs                    # Sidecar process manager
        grpc_client.rs            # tonic gRPC client to Python
      build.rs                    # tonic-build proto compilation
  sidecar/
    pyproject.toml                # uv-managed Python project
    src/
      wallflower_sidecar/
        __init__.py
        server.py                 # gRPC server (Python side)
        analyzers/
          __init__.py
          base.py                 # AnalyzerBase ABC
          tempo.py                # Tempo analysis (essentia)
          key.py                  # Key analysis (essentia)
          sections.py             # Section detection (librosa)
          loops.py                # Loop detection (custom)
        models/
          __init__.py
          manager.py              # Model download, versioning, cache
        hardware.py               # Hardware detection, profile selection
    proto/
      wallflower_analysis_pb2.py  # Generated
      wallflower_analysis_pb2_grpc.py
  migrations/
    V4__analysis_tables.sql       # New analysis result tables
```

### Pattern 1: gRPC Service Definition (Protobuf)
**What:** Single .proto file defining the analysis service contract between Rust and Python.
**When to use:** All Rust-Python IPC for analysis.
**Example:**
```protobuf
syntax = "proto3";
package wallflower.analysis;

service AnalysisService {
  // Analyze a single jam -- streams progress updates
  rpc AnalyzeJam(AnalyzeRequest) returns (stream AnalysisProgress);
  // Health check
  rpc GetHealth(HealthRequest) returns (HealthResponse);
  // Get hardware capabilities
  rpc GetHardwareInfo(HardwareInfoRequest) returns (HardwareInfoResponse);
}

message AnalyzeRequest {
  string jam_id = 1;
  string audio_path = 2;
  AnalysisProfile profile = 3;
  repeated string skip_steps = 4; // For lightweight profiles
}

enum AnalysisProfile {
  FULL = 0;
  STANDARD = 1;
  LIGHTWEIGHT = 2;
}

message AnalysisProgress {
  string jam_id = 1;
  AnalysisStep step = 2;
  StepStatus status = 3;
  oneof result {
    TempoResult tempo = 4;
    KeyResult key = 5;
    SectionsResult sections = 6;
    LoopsResult loops = 7;
  }
}

enum AnalysisStep {
  TEMPO = 0;
  KEY = 1;
  SECTIONS = 2;
  LOOPS = 3;
}

enum StepStatus {
  STARTED = 0;
  COMPLETED = 1;
  FAILED = 2;
  SKIPPED = 3;
}

message TempoResult {
  float bpm = 1;
  float confidence = 2;
  repeated BeatPosition beats = 3;
}

message KeyResult {
  string key = 1;        // e.g. "Bb"
  string scale = 2;      // e.g. "minor"
  float strength = 3;    // confidence
}

message SectionsResult {
  repeated Section sections = 1;
}

message Section {
  float start_seconds = 1;
  float end_seconds = 2;
  string label = 3;      // "Intro", "A", "B", etc.
  int32 cluster_id = 4;
}

message LoopsResult {
  repeated Loop loops = 1;
}

message Loop {
  float start_seconds = 1;
  float end_seconds = 2;
  int32 repeat_count = 3;
  bool evolving = 4;
  string label = 5;      // "Loop A", "Loop B"
}
```

### Pattern 2: Sidecar Process Manager
**What:** Rust module that lazily spawns, monitors, and restarts the Python sidecar process.
**When to use:** All communication with the Python ML sidecar.
**Key behaviors:**
- Spawn on first analysis request (D-06)
- Keep alive while app runs (D-07)
- Auto-restart on crash, max 3 retries (D-08)
- Kill on app quit
- Use tonic-health for liveness probing

```rust
// Pseudocode structure
pub struct SidecarManager {
    process: Option<Child>,
    grpc_client: Option<AnalysisServiceClient>,
    port: u16,
    restart_count: u32,
    max_restarts: u32,  // 3
}

impl SidecarManager {
    pub async fn ensure_running(&mut self) -> Result<&AnalysisServiceClient> {
        if self.is_healthy().await {
            return Ok(self.grpc_client.as_ref().unwrap());
        }
        if self.restart_count >= self.max_restarts {
            return Err(SidecarError::MaxRestartsExceeded);
        }
        self.spawn_sidecar().await?;
        self.wait_for_healthy().await?;
        Ok(self.grpc_client.as_ref().unwrap())
    }

    async fn is_healthy(&self) -> bool {
        // Use tonic-health gRPC health check
    }

    async fn spawn_sidecar(&mut self) -> Result<()> {
        // uv run python -m wallflower_sidecar --port {self.port}
        let child = Command::new("uv")
            .args(["run", "--project", "sidecar/", "python", "-m", "wallflower_sidecar"])
            .arg("--port").arg(self.port.to_string())
            .spawn()?;
        self.process = Some(child);
        self.restart_count += 1;
        Ok(())
    }
}
```

### Pattern 3: Analysis Queue with Priority
**What:** Job queue that respects recording priority (D-17) and view priority (D-16).
**When to use:** Scheduling analysis work.
**Key behaviors:**
- FIFO by default, oldest unanalyzed first
- Currently-viewed jam jumps to front
- Recording interrupts immediately, re-queues at front
- Checks PriorityScheduler.may_proceed() before processing

### Pattern 4: SQLite Schema Migration for Analysis Results
**What:** New tables for analysis results, not new columns on jams table.
**Why separate tables:** Analysis results are complex (arrays of sections, loops, beats). Separate tables with foreign keys to jams.id are cleaner than JSON blobs in columns.

```sql
-- V4__analysis_tables.sql

-- Analysis status per jam
CREATE TABLE IF NOT EXISTS jam_analysis (
    jam_id TEXT PRIMARY KEY REFERENCES jams(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, analyzing, complete, failed
    current_step TEXT,                        -- tempo, key, sections, loops
    analysis_profile TEXT DEFAULT 'full',
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tempo results
CREATE TABLE IF NOT EXISTS jam_tempo (
    jam_id TEXT PRIMARY KEY REFERENCES jams(id) ON DELETE CASCADE,
    bpm REAL NOT NULL,
    confidence REAL NOT NULL,
    manual_override INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key results
CREATE TABLE IF NOT EXISTS jam_key (
    jam_id TEXT PRIMARY KEY REFERENCES jams(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,    -- "Bb", "C#", etc.
    scale TEXT NOT NULL,       -- "major", "minor"
    strength REAL NOT NULL,
    manual_override INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Section boundaries
CREATE TABLE IF NOT EXISTS jam_sections (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    label TEXT NOT NULL,
    cluster_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jam_sections_jam_id ON jam_sections(jam_id);

-- Detected loops
CREATE TABLE IF NOT EXISTS jam_loops (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    repeat_count INTEGER NOT NULL DEFAULT 1,
    evolving INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jam_loops_jam_id ON jam_loops(jam_id);

-- Beat positions (for future use, section alignment)
CREATE TABLE IF NOT EXISTS jam_beats (
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    beat_time REAL NOT NULL,
    PRIMARY KEY (jam_id, beat_time)
);

-- Full-text search index for META-08
CREATE VIRTUAL TABLE IF NOT EXISTS jam_search USING fts5(
    jam_id UNINDEXED,
    filename,
    notes,
    tags,
    collaborators,
    instruments,
    location,
    content='',       -- External content mode
    tokenize='porter'
);

-- Track schema version
INSERT INTO schema_version (version) VALUES (4);
PRAGMA user_version = 4;
```

### Pattern 5: Tauri Events for Progressive UI Updates
**What:** Use existing Tauri event system to stream analysis progress to frontend.
**Why:** The app already uses Tauri events extensively for recording (level updates, state changes, silence detection). Analysis progress follows the same pattern. No need for a separate SSE endpoint.

```rust
// In Rust, after receiving gRPC stream update:
app_handle.emit("analysis-progress", serde_json::json!({
    "jamId": jam_id,
    "step": "tempo",
    "status": "completed",
    "result": { "bpm": 120.5, "confidence": 0.95 }
}))?;
```

```typescript
// In frontend TauriEventListener:
const unlistenAnalysis = await listen<AnalysisProgressPayload>(
  "analysis-progress",
  (event) => {
    const { jamId, step, status, result } = event.payload;
    // Update react-query cache or zustand store
    queryClient.setQueryData(["jam", jamId, "analysis"], (old) => ({
      ...old,
      [step]: { status, ...result }
    }));
  }
);
```

### Anti-Patterns to Avoid
- **Polling for analysis status:** Use Tauri events for push updates, not periodic polling. Polling wastes resources and introduces latency.
- **JSON blobs in SQLite columns for analysis results:** Use separate normalized tables. JSON blobs are hard to query (META-08 filtering) and break SQLite's strengths.
- **Blocking the main thread waiting for sidecar:** All sidecar communication must be async. Spawn the process in a background task, use async gRPC client.
- **Loading all models at sidecar startup:** Essentia algorithms are lightweight and load fast. Only download/cache model files (for future TempoCNN when TF is fixed), not pre-load everything.
- **Running analysis during recording:** Always check PriorityScheduler.may_proceed() before starting or continuing analysis.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tempo/BPM detection | Custom FFT-based BPM detector | essentia RhythmExtractor2013 | Handles tempo changes, provides confidence, beat positions |
| Key detection | Custom pitch analysis | essentia KeyExtractor | Handles detuning, multiple profiles, well-tested |
| Section segmentation | Custom onset/energy-based splitter | librosa Laplacian segmentation | Spectral clustering on self-similarity is state-of-art |
| gRPC codegen | Manual serialization | tonic-build + grpcio-tools | Schema validation, type safety, streaming built-in |
| Process health monitoring | Custom TCP pings | tonic-health gRPC health check | Standard gRPC pattern, works out of the box |
| Full-text search | Custom LIKE queries | SQLite FTS5 | Porter stemming, relevance ranking, fast on large datasets |
| Python environment management | pip + venv manually | uv | Fast, reproducible, handles Python version management |

**Key insight:** The hardest novel work in this phase is loop detection (AI-05) and "evolving loop" detection. Everything else has well-established library support. Budget extra time for loop detection implementation and testing.

## Common Pitfalls

### Pitfall 1: essentia-tensorflow Broken on macOS ARM64
**What goes wrong:** Importing essentia.tensorflow fails with ModuleNotFoundError on Apple Silicon. The PyPI wheel is missing/broken.
**Why it happens:** Packaging issue in essentia-tensorflow for osx-arm64 platform (GitHub issue #1486, unresolved as of 2025).
**How to avoid:** Use ONLY essentia standard algorithms (KeyExtractor, RhythmExtractor2013). Do NOT depend on TempoCNN or any TF-based models. The standard algorithms are accurate enough for this use case.
**Warning signs:** ImportError mentioning essentia.tensorflow at sidecar startup.

### Pitfall 2: Python Version Incompatibility
**What goes wrong:** essentia wheels only exist for Python 3.9-3.13. System Python is 3.14.3.
**Why it happens:** essentia hasn't released 3.14 wheels yet.
**How to avoid:** Use uv to install and manage Python 3.13 for the sidecar. The sidecar must use its own managed Python, not the system Python.
**Warning signs:** "No matching distribution found" errors when installing essentia.

### Pitfall 3: gRPC Port Conflicts
**What goes wrong:** Sidecar fails to start because the gRPC port is already in use (e.g., from a previous crashed instance).
**Why it happens:** Crashed sidecar process may still hold the port. Multiple app instances.
**How to avoid:** Use a dynamic port (bind to 0, read back assigned port) or a fixed port with SO_REUSEADDR. Always kill previous sidecar before spawning new one. Check port availability before binding.
**Warning signs:** "Address already in use" errors in sidecar logs.

### Pitfall 4: Analysis Running During Recording
**What goes wrong:** ML analysis consumes CPU/memory, causing recording buffer underruns.
**Why it happens:** Analysis queue doesn't check PriorityScheduler before processing.
**How to avoid:** Every analysis step must check scheduler.may_proceed() before AND during processing. On recording start, immediately interrupt current analysis (D-17).
**Warning signs:** Audio glitches or dropped samples in recordings made while analysis is running.

### Pitfall 5: Section Count Parameter (k) in Laplacian Segmentation
**What goes wrong:** Laplacian segmentation requires specifying number of clusters (k) upfront. Wrong k produces meaningless segments.
**Why it happens:** Algorithm needs the parameter but optimal k varies per jam.
**How to avoid:** Use multiple k values and pick the one with best silhouette score, or use novelty-based boundary detection first to estimate k, then refine with Laplacian method.
**Warning signs:** All jams getting the same number of sections regardless of actual structure.

### Pitfall 6: protoc Not Installed
**What goes wrong:** tonic-build fails during Rust compilation because protoc binary isn't found.
**Why it happens:** protobuf is a brew formula but not installed on this machine.
**How to avoid:** Wave 0 must install protoc: `brew install protobuf`. Alternatively, use `tonic-build` with `protoc_arg` or bundle protoc.
**Warning signs:** Build error "Could not find `protoc` installation".

### Pitfall 7: FTS5 Index Maintenance
**What goes wrong:** Full-text search returns stale results because FTS5 external content index wasn't updated when metadata changed.
**Why it happens:** External content FTS5 tables don't auto-sync. Must manually update on insert/update/delete.
**How to avoid:** Use triggers to keep FTS5 index in sync, or use content-table mode with direct content storage.
**Warning signs:** Search missing recently tagged/updated jams.

## Code Examples

### Essentia Tempo Detection (Python)
```python
# Source: essentia.upf.edu/tutorial_rhythm_beatdetection.html
import essentia.standard as es

def detect_tempo(audio_path: str) -> dict:
    loader = es.MonoLoader(filename=audio_path, sampleRate=44100)
    audio = loader()

    rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
    bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)

    return {
        "bpm": float(bpm),
        "confidence": float(beats_confidence.mean()) if len(beats_confidence) > 0 else 0.0,
        "beats": [float(b) for b in beats],
    }
```

### Essentia Key Detection (Python)
```python
# Source: essentia.upf.edu/reference/std_KeyExtractor.html
import essentia.standard as es

def detect_key(audio_path: str) -> dict:
    loader = es.MonoLoader(filename=audio_path, sampleRate=44100)
    audio = loader()

    key_extractor = es.KeyExtractor(profileType="edma")  # Good for electronic music
    key, scale, strength = key_extractor(audio)

    return {
        "key": key,      # e.g. "Bb"
        "scale": scale,  # e.g. "minor"
        "strength": float(strength),
    }
```

### librosa Section Segmentation (Python)
```python
# Source: librosa.org/doc/latest/auto_examples/plot_segmentation.html
import librosa
import numpy as np
from sklearn.cluster import KMeans

def detect_sections(audio_path: str, n_clusters: int = 5) -> list[dict]:
    y, sr = librosa.load(audio_path, sr=22050)

    # Beat-synchronous features
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beats, sr=sr)

    # CQT and MFCC features
    cqt = librosa.feature.chroma_cqt(y=y, sr=sr)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

    # Beat-sync
    cqt_sync = librosa.util.sync(cqt, beats, aggregate=np.median)
    mfcc_sync = librosa.util.sync(mfcc, beats, aggregate=np.median)

    # Recurrence matrix (self-similarity)
    R = librosa.segment.recurrence_matrix(
        cqt_sync, width=3, mode="affinity", sym=True
    )

    # Path enhancement
    R_path = librosa.segment.path_enhance(R, 15)

    # Laplacian decomposition + clustering
    from scipy.sparse.csgraph import laplacian
    L = laplacian(R_path, normed=True)
    eigvals, eigvecs = np.linalg.eigh(L)

    kmeans = KMeans(n_clusters=n_clusters, random_state=0)
    labels = kmeans.fit_predict(eigvecs[:, :n_clusters])

    # Find boundaries where labels change
    boundaries = [0] + list(np.where(np.diff(labels))[0] + 1)
    boundary_times = beat_times[boundaries].tolist() if len(beat_times) > 0 else []

    sections = []
    for i, (start_idx, label) in enumerate(zip(boundaries, labels[boundaries])):
        end_idx = boundaries[i + 1] if i + 1 < len(boundaries) else len(beat_times) - 1
        sections.append({
            "start_seconds": float(beat_times[start_idx]) if start_idx < len(beat_times) else 0,
            "end_seconds": float(beat_times[end_idx]) if end_idx < len(beat_times) else float(librosa.get_duration(y=y, sr=sr)),
            "label": chr(65 + label),  # A, B, C, ...
            "cluster_id": int(label),
        })

    return sections
```

### tonic gRPC Build Setup (Rust)
```rust
// build.rs in crates/wallflower-app/
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(false)  // Rust is the CLIENT
        .build_client(true)
        .compile_protos(
            &["../../proto/wallflower_analysis.proto"],
            &["../../proto/"],
        )?;
    // Also run tauri_build
    tauri_build::build();
    Ok(())
}
```

### Python gRPC Server Setup
```python
# sidecar/src/wallflower_sidecar/server.py
import grpc
from concurrent import futures
from wallflower_analysis_pb2_grpc import add_AnalysisServiceServicer_to_server
from wallflower_analysis_pb2_grpc import AnalysisServiceServicer

class AnalysisServer(AnalysisServiceServicer):
    def AnalyzeJam(self, request, context):
        """Server streaming: yields progress updates."""
        # Step 1: Tempo
        yield make_progress(request.jam_id, "TEMPO", "STARTED")
        tempo_result = detect_tempo(request.audio_path)
        yield make_progress(request.jam_id, "TEMPO", "COMPLETED", tempo=tempo_result)

        # Step 2: Key
        yield make_progress(request.jam_id, "KEY", "STARTED")
        key_result = detect_key(request.audio_path)
        yield make_progress(request.jam_id, "KEY", "COMPLETED", key=key_result)

        # Step 3: Sections (skip in lightweight profile)
        if "SECTIONS" not in request.skip_steps:
            yield make_progress(request.jam_id, "SECTIONS", "STARTED")
            sections_result = detect_sections(request.audio_path)
            yield make_progress(request.jam_id, "SECTIONS", "COMPLETED", sections=sections_result)

        # Step 4: Loops (skip in lightweight profile)
        if "LOOPS" not in request.skip_steps:
            yield make_progress(request.jam_id, "LOOPS", "STARTED")
            loops_result = detect_loops(request.audio_path, sections_result)
            yield make_progress(request.jam_id, "LOOPS", "COMPLETED", loops=loops_result)

def serve(port: int):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    add_AnalysisServiceServicer_to_server(AnalysisServer(), server)
    # Add health service
    from grpc_health.v1 import health, health_pb2, health_pb2_grpc
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set("wallflower.analysis.AnalysisService", health_pb2.HealthCheckResponse.SERVING)

    server.add_insecure_port(f"127.0.0.1:{port}")
    server.start()
    server.wait_for_termination()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| essentia TempoCNN (TF) | essentia RhythmExtractor2013 (standard) | 2025 (TF broken on ARM64) | Standard algorithms must be used. Accuracy is slightly lower but acceptable. |
| MSAF for section segmentation | librosa built-in segmentation | MSAF abandoned ~2019 | librosa's approach is simpler, maintained, and sufficient. |
| PyTorch Demucs | demucs-mlx | 2025 | Phase 5 concern, but model download infrastructure should be forward-compatible. |

**Deprecated/outdated:**
- essentia-tensorflow on macOS ARM64: broken, no fix timeline
- MSAF: abandoned, unmaintained since 2019
- tonic 0.12 / prost 0.13: outdated, use 0.14.x for both

## Open Questions

1. **Evolving Loop Detection Algorithm**
   - What we know: Need to detect when a loop repeats but with variation (e.g., filter sweep over a 4-bar loop). Self-similarity matrix diagonal stripes indicate repetition. Feature delta between repetitions indicates evolution.
   - What's unclear: Threshold for "evolving" vs "different section". No established algorithm for this specific task.
   - Recommendation: Use chroma + MFCC feature distance between loop iterations. If distance is above a threshold (tunable), mark as evolving. Start with conservative threshold and tune empirically.

2. **Optimal Section Count (k parameter)**
   - What we know: Laplacian segmentation needs k. Real jams have 2-20 sections.
   - What's unclear: Best automatic method for choosing k.
   - Recommendation: Try k values 2-10, pick best silhouette score. Alternatively, use novelty-based detection to find boundary candidates first, then count them.

3. **Section Labeling**
   - What we know: K-means gives cluster IDs, not meaningful labels like "Intro", "Verse".
   - What's unclear: How to assign human-readable labels to clusters.
   - Recommendation: Use simple heuristics: first section = "Intro", last = "Outro", repeated clusters get same letter ("A", "B"), first occurrence of each cluster gets sequential letters. This matches how musicians think about structure.

4. **grpcio Python 3.14 Compatibility**
   - What we know: System Python is 3.14. grpcio usually supports latest Python quickly.
   - What's unclear: Whether grpcio 1.80.0 has 3.14 wheels. But this is moot since essentia requires 3.13.
   - Recommendation: Use uv-managed Python 3.13 for the entire sidecar. This sidesteps all compatibility issues.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust/Cargo | Rust backend | Yes | 1.95.0 | -- |
| Python 3.13 | ML sidecar (essentia wheels) | No (system has 3.14) | -- | uv python install 3.13 |
| uv | Python env management | No | -- | brew install uv |
| protoc | tonic-build proto compilation | No | -- | brew install protobuf |
| Homebrew | Installing missing deps | Yes | -- | -- |
| Node.js/npm | Frontend build | Yes (implied by existing package.json) | -- | -- |

**Missing dependencies with no fallback:**
- None -- all missing deps can be installed via brew/uv

**Missing dependencies with fallback:**
- Python 3.13: Install via `uv python install 3.13` (uv needs to be installed first via `brew install uv`)
- uv: Install via `brew install uv`
- protoc: Install via `brew install protobuf`

**Wave 0 must install these before any implementation work.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Rust) | cargo test (built-in) |
| Framework (Python) | pytest |
| Config file (Rust) | Cargo.toml (existing) |
| Config file (Python) | sidecar/pyproject.toml (Wave 0) |
| Quick run command (Rust) | `~/.cargo/bin/cargo test -p wallflower-core --lib` |
| Quick run command (Python) | `cd sidecar && uv run pytest tests/ -x` |
| Full suite command | `~/.cargo/bin/cargo test --workspace && cd sidecar && uv run pytest tests/` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | Tempo detection returns valid BPM | unit (Python) | `cd sidecar && uv run pytest tests/test_tempo.py -x` | Wave 0 |
| AI-02 | Key detection returns valid key/scale | unit (Python) | `cd sidecar && uv run pytest tests/test_key.py -x` | Wave 0 |
| AI-03 | Section detection returns boundaries | unit (Python) | `cd sidecar && uv run pytest tests/test_sections.py -x` | Wave 0 |
| AI-05 | Loop detection identifies repeats | unit (Python) | `cd sidecar && uv run pytest tests/test_loops.py -x` | Wave 0 |
| AI-06 | Progressive results via gRPC stream | integration (Rust+Python) | `~/.cargo/bin/cargo test -p wallflower-app grpc_streaming` | Wave 0 |
| AI-07 | Model caching in app support dir | unit (Python) | `cd sidecar && uv run pytest tests/test_models.py -x` | Wave 0 |
| AI-08 | Model swap via config only | unit (Python) | `cd sidecar && uv run pytest tests/test_provider.py -x` | Wave 0 |
| AI-09 | Downloads don't block app | integration | Manual: start app, verify recording works while models download | Manual |
| META-08 | Filter/search returns correct results | unit (Rust) | `~/.cargo/bin/cargo test -p wallflower-core filter_search` | Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run command for affected component (Rust or Python)
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `sidecar/pyproject.toml` -- Python project setup with uv, all dependencies
- [ ] `sidecar/tests/conftest.py` -- shared fixtures (test audio file generation)
- [ ] `sidecar/tests/test_tempo.py` -- AI-01 coverage
- [ ] `sidecar/tests/test_key.py` -- AI-02 coverage
- [ ] `sidecar/tests/test_sections.py` -- AI-03 coverage
- [ ] `sidecar/tests/test_loops.py` -- AI-05 coverage
- [ ] `sidecar/tests/test_provider.py` -- AI-08 coverage
- [ ] `sidecar/tests/test_models.py` -- AI-07 coverage
- [ ] `proto/wallflower_analysis.proto` -- gRPC service definition
- [ ] `brew install uv protobuf` -- environment dependencies
- [ ] `uv python install 3.13` -- compatible Python version
- [ ] `migrations/V4__analysis_tables.sql` -- analysis result schema
- [ ] Rust test fixtures for analysis DB operations

## Sources

### Primary (HIGH confidence)
- [essentia PyPI](https://pypi.org/project/essentia/) - Version 2.1b6.dev1389, macOS ARM64 wheels available for Python 3.9-3.13
- [essentia KeyExtractor docs](https://essentia.upf.edu/reference/std_KeyExtractor.html) - Standard algorithm, no TF dependency
- [essentia beat detection tutorial](https://essentia.upf.edu/tutorial_rhythm_beatdetection.html) - RhythmExtractor2013 usage
- [tonic crates.io](https://crates.io/crates/tonic) - Version 0.14.5 (Feb 2026)
- [prost crates.io](https://crates.io/crates/prost) - Version 0.14.3 (Jan 2026)
- [tonic-build crates.io](https://crates.io/crates/tonic-build) - Version 0.14.5 (Feb 2026)
- [grpcio PyPI](https://pypi.org/project/grpcio/) - Version 1.80.0
- [librosa Laplacian segmentation](https://librosa.org/doc/latest/auto_examples/plot_segmentation.html) - Section boundary detection
- [librosa recurrence_matrix](https://librosa.org/doc/main/generated/librosa.segment.recurrence_matrix.html) - Self-similarity for structure analysis

### Secondary (MEDIUM confidence)
- [essentia GitHub issue #1486](https://github.com/MTG/essentia/issues/1486) - essentia-tensorflow broken on macOS ARM64 (unresolved)
- [demucs-mlx GitHub](https://github.com/ssmall256/demucs-mlx/) - Phase 5 but model infra relevant
- [tonic helloworld tutorial](https://github.com/hyperium/tonic/blob/master/examples/helloworld-tutorial.md) - gRPC setup patterns
- [Novelty-based segmentation](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html) - Alternative section detection approach
- [gRPC streaming with tonic (DockYard)](https://dockyard.com/blog/2025/04/08/grpc-basics-for-rust-developers) - Practical tonic patterns

### Tertiary (LOW confidence)
- Loop detection / evolving loop algorithm: No established library. Custom implementation required using self-similarity analysis. Needs empirical tuning.
- Section labeling heuristics: No standard approach. Common in MIR research but implementation-specific.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified on crates.io/PyPI with current versions. essentia ARM64 wheels confirmed.
- Architecture: HIGH - gRPC + tonic is well-documented pattern. Protobuf service definition is straightforward.
- Analysis algorithms (tempo/key): HIGH - essentia standard algorithms are mature and well-documented.
- Analysis algorithms (sections): MEDIUM - librosa Laplacian segmentation works but requires tuning k parameter.
- Analysis algorithms (loops): LOW-MEDIUM - No off-the-shelf solution. Custom implementation with self-similarity analysis.
- Pitfalls: HIGH - essentia-tensorflow issue verified via GitHub. Python version mismatch confirmed locally.

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days -- stable libraries, main risk is essentia-tensorflow fix)
