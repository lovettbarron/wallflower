# Architecture Research

**Domain:** Local-first audio jam/sample manager with ML analysis
**Researched:** 2026-04-18
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend (React/Next.js)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Waveform │  │ Spatial  │  │ Timeline │  │ Recording / Meta │    │
│  │ Viewer   │  │ Explorer │  │ Browser  │  │ Controls         │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘    │
│       └──────────────┴──────────────┴───────────────┘               │
│                          │ HTTP + SSE                                │
├──────────────────────────┼──────────────────────────────────────────┤
│                     Rust Backend                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ HTTP API │  │ Recording│  │ Priority │  │ File Manager     │    │
│  │ (axum)   │  │ Engine   │  │ Scheduler│  │ (import/export)  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘    │
│       │             │             │                 │               │
│  ┌────┴─────┐  ┌────┴─────┐  ┌───┴────┐   ┌───────┴──────────┐    │
│  │ Audio    │  │ Waveform │  │ Device  │   │ Folder Watcher   │    │
│  │ Streamer │  │ Peak Gen │  │ Monitor │   │ (sync-safe)      │    │
│  └──────────┘  └──────────┘  └────────┘   └──────────────────┘    │
│                          │ IPC (gRPC/Unix socket)                   │
├──────────────────────────┼──────────────────────────────────────────┤
│                     Python ML Sidecar                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Source   │  │ Audio    │  │ Embedding│  │ Model Manager    │    │
│  │ Separate │  │ Analysis │  │ Generator│  │ (download/cache) │    │
│  │ (demucs) │  │ (key,bpm)│  │ (CLAP)  │  │                  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                     Storage Layer                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐      │
│  │ SQLite (WAL) │  │ Audio Files  │  │ Model Cache          │      │
│  │ metadata DB  │  │ ~/wallflower │  │ ~/Library/Caches/wf  │      │
│  └──────────────┘  └──────────────┘  └──────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| HTTP API | REST endpoints for all frontend operations, SSE for progress events | axum with tower middleware |
| Recording Engine | Multi-channel audio capture, incremental WAV writes, crash recovery | cpal for audio I/O, custom WAV writer |
| Priority Scheduler | Queue ML tasks, pause/resume on recording, manage concurrency | Custom scheduler with tokio, CancellationToken |
| Audio Streamer | Serve audio files with HTTP Range requests for scrubbing | axum with byte-range support |
| Waveform Peak Generator | Compute multi-resolution peak data for waveform display | Rust-native peak computation (min/max per N samples) |
| File Manager | Import (copy-first), export (stems, slices), atomic writes | Rust std::fs with tempfile + rename pattern |
| Folder Watcher | Watch ~/wallflower and connected devices for new files | notify crate (cross-platform fs events) |
| Device Monitor | Detect connected audio recorders (e.g., Zoom F3) | macOS diskutil/IOKit via Rust FFI |
| Source Separation | Isolate instruments from mixed recordings | demucs via Python API (adefossez/demucs fork) |
| Audio Analysis | Key, tempo, chords, sections, phrase boundaries | essentia or madmom via Python |
| Embedding Generator | Compute audio embeddings for spatial similarity map | CLAP or musicnn model |
| Model Manager | Download, version, cache ML models at runtime | Python with hash-based version checks |
| SQLite DB | Metadata storage, search queries, spatial index data | rusqlite in WAL mode |

## Recommended Project Structure

```
wallflower/
├── backend/                     # Rust workspace
│   ├── Cargo.toml               # Workspace root
│   ├── wf-server/               # HTTP API binary
│   │   └── src/
│   │       ├── main.rs          # Server startup, router setup
│   │       ├── routes/          # axum route handlers
│   │       ├── sse.rs           # Server-sent events for progress
│   │       └── audio_stream.rs  # Range-request audio serving
│   ├── wf-core/                 # Core library
│   │   └── src/
│   │       ├── db/              # SQLite schema, queries, migrations
│   │       ├── models/          # Domain types (Jam, Recording, Bookmark)
│   │       ├── recording/       # Recording engine, WAV writer
│   │       ├── scheduler/       # Priority task scheduler
│   │       ├── files/           # Import, export, atomic writes
│   │       ├── waveform/        # Peak computation
│   │       ├── watcher/         # Folder + device monitoring
│   │       └── sidecar/         # Python process management, IPC
│   └── wf-cli/                  # CLI binary for debugging
│       └── src/main.rs
├── sidecar/                     # Python ML sidecar
│   ├── pyproject.toml           # Dependencies (demucs, essentia, etc.)
│   ├── wf_sidecar/
│   │   ├── __main__.py          # gRPC/socket server entry point
│   │   ├── server.py            # IPC server (accept tasks, return results)
│   │   ├── separation.py        # Demucs wrapper
│   │   ├── analysis.py          # Key, tempo, chord, section detection
│   │   ├── embedding.py         # Audio embedding computation
│   │   └── models.py            # Model download, versioning, cache
│   └── tests/
├── frontend/                    # Next.js app
│   ├── src/
│   │   ├── app/                 # Next.js app router pages
│   │   ├── components/
│   │   │   ├── waveform/        # Waveform viewer (wavesurfer.js)
│   │   │   ├── spatial/         # Spatial explorer (WebGL/canvas)
│   │   │   ├── timeline/        # Chronological browser
│   │   │   ├── recording/       # Recording controls + live metadata
│   │   │   └── common/          # Shared UI components
│   │   ├── hooks/               # React hooks (useAudio, useRecording)
│   │   ├── api/                 # API client functions
│   │   └── store/               # Client state (zustand)
│   └── public/
├── proto/                       # Shared IPC definitions (if using gRPC)
│   └── sidecar.proto
└── .planning/                   # Project planning
```

### Structure Rationale

- **Rust workspace with multiple crates:** Separates the server binary, core logic, and CLI tool. The core library (`wf-core`) is reusable across server and CLI, enabling headless testing and scripting.
- **Python sidecar as separate project:** Isolated dependency management (PyTorch, demucs have heavy deps). Deployed as a subprocess managed by Rust, not embedded.
- **Frontend as standalone Next.js app:** Communicates exclusively via HTTP API. Could be replaced or supplemented without touching backend.
- **proto/ at root level:** Shared IPC contract between Rust and Python if using gRPC. Alternatively, use JSON over Unix domain sockets for simplicity.

## Architectural Patterns

### Pattern 1: Priority-Based Task Scheduler with Preemption

**What:** A custom task scheduler that manages all background work (ML analysis, waveform generation, model downloads) with priority levels. Recording is the highest priority and preempts all other work.

**When to use:** Whenever the system needs to run background processing while guaranteeing recording performance.

**Trade-offs:** More complex than a simple job queue, but essential for the "recording never stutters" guarantee. The scheduler becomes the central coordination point for all async work.

**Architecture:**

```
Priority Levels:
  P0 (CRITICAL):  Recording audio capture       -- never interrupted
  P1 (HIGH):      Live metadata saves            -- runs alongside recording
  P2 (MEDIUM):    Waveform peak generation       -- pauses during recording
  P3 (LOW):       ML analysis (key, tempo, etc.) -- pauses during recording
  P4 (BACKGROUND): Source separation             -- pauses during recording
  P5 (IDLE):      Model downloads                -- pauses during recording, non-blocking
```

**Implementation approach:**
```rust
// Scheduler uses CancellationToken from tokio_util for cooperative cancellation
pub struct TaskScheduler {
    recording_active: Arc<AtomicBool>,
    cancel_tokens: DashMap<TaskId, CancellationToken>,
    task_queue: PriorityQueue<Task>,
}

impl TaskScheduler {
    pub fn start_recording(&self) {
        self.recording_active.store(true, Ordering::SeqCst);
        // Signal all P2+ tasks to pause via their CancellationTokens
        self.pause_lower_priority_tasks(Priority::P1);
    }

    pub fn stop_recording(&self) {
        self.recording_active.store(false, Ordering::SeqCst);
        // Resume paused tasks
        self.resume_paused_tasks();
    }
}
```

### Pattern 2: Incremental WAV Writing with Crash Safety

**What:** Write audio data incrementally during recording so that a crash loses at most a few seconds of audio, not the entire session. WAV headers have size fields that must be updated at close, creating a crash vulnerability.

**When to use:** All recording operations.

**Trade-offs:** Slightly more I/O overhead from periodic header updates, but guarantees data recovery.

**Architecture:**

```
Recording Flow:
  1. Create WAV file with placeholder size fields (0xFFFFFFFF)
  2. Write audio chunks as they arrive from cpal callback
  3. Every N seconds (e.g., 5s): flush buffer, update header size fields, fsync
  4. On graceful stop: final header update, fsync, close
  5. On crash: recovery tool reads raw PCM data, reconstructs valid WAV header
     (data is all there, only header sizes may be wrong)
```

**Key detail:** Use a write-ahead approach -- write raw PCM to a `.recording` temp file, periodically update WAV headers in place. On crash, the `.recording` file extension signals "needs recovery" to the file manager on next startup.

### Pattern 3: Pre-Computed Waveform Peaks with Multi-Resolution

**What:** Generate waveform peak data server-side at multiple zoom levels so the browser never needs to decode the full audio file for display. Store peaks alongside the audio file.

**When to use:** All audio files, computed immediately after import or recording completes.

**Trade-offs:** Additional storage (~1% of audio file size) and computation time, but dramatically faster UI rendering and eliminates browser memory issues with large files.

**Architecture:**

```
Audio file (120 min, ~2.5 GB WAV)
    ↓ Peak generator (Rust, runs at P2 priority)
    ↓
Peaks file (.peaks.json or binary .dat):
  - Level 0: 1 peak per second     (7,200 points for 120 min) -- overview
  - Level 1: 10 peaks per second    (72,000 points)           -- zoomed
  - Level 2: 100 peaks per second   (720,000 points)          -- detail
  - Level 3: 1000 peaks per second  (7,200,000 points)        -- max zoom

Frontend requests appropriate level based on zoom:
  GET /api/jams/{id}/peaks?level=1&start=0&end=300
```

**Why not audiowaveform:** The BBC audiowaveform tool (C++) is mature, but writing peak computation in Rust is straightforward (min/max over sample windows) and avoids a system dependency. The output format should be compatible with wavesurfer.js's `load(url, peaks, duration)` API.

### Pattern 4: Rust-Python IPC via gRPC over Unix Domain Socket

**What:** The Rust backend communicates with the Python ML sidecar through gRPC (or a simpler JSON-over-socket protocol) using Unix domain sockets for low-latency local communication.

**When to use:** All ML inference requests (separation, analysis, embedding computation).

**Trade-offs:** gRPC adds protobuf complexity but provides typed contracts, streaming responses (for progress), and battle-tested serialization. A simpler alternative is JSON-over-Unix-socket with a custom protocol, which is easier to debug but less structured.

**Recommendation:** Start with JSON-over-Unix-domain-socket for v1. The ML sidecar processes one task at a time (serialized by the priority scheduler), so the IPC pattern is simple request-response. Move to gRPC only if streaming progress or multiple concurrent sidecar tasks become necessary.

**Data transfer for large audio:**

```
Option A (recommended): Pass file paths, not audio data
  Rust → Python: {"task": "separate", "input_path": "/path/to/jam.wav", "output_dir": "/path/to/stems/"}
  Python → Rust: {"status": "complete", "stems": ["vocals.wav", "drums.wav", "bass.wav", "other.wav"]}

Option B (avoid): Stream audio bytes over IPC
  Unnecessary overhead -- both processes have filesystem access.
```

### Pattern 5: HTTP Range Requests for Audio Scrubbing

**What:** Serve audio files from the Rust backend using HTTP 206 Partial Content responses so the browser can seek to any position without downloading the entire file.

**When to use:** All audio playback in the frontend.

**Trade-offs:** Requires the backend to support Range headers, but axum/tower has built-in support via `tower-http`'s `ServeFile` or manual range parsing. The browser's `<audio>` element and Web Audio API both work with range requests natively.

**Architecture:**

```
Frontend audio playback:
  1. wavesurfer.js loads pre-computed peaks for instant waveform display
  2. User hits play → browser requests audio via <audio> element with Range header
  3. Backend responds with 206 Partial Content for the requested byte range
  4. User scrubs → browser aborts current request, sends new Range request
  5. For Web Audio API decoding: request chunks progressively, decode in AudioWorklet
```

**Key configuration:** Backend must set `Accept-Ranges: bytes` and `Content-Range` headers. For WAV files, byte offsets map directly to sample positions (after the 44-byte header), making seek calculations trivial.

### Pattern 6: Progressive Analysis Pipeline

**What:** Analysis results populate the UI incrementally as each analysis step completes, rather than waiting for all processing to finish.

**When to use:** After import or recording, the jam should be browsable immediately with progressively richer metadata.

**Architecture:**

```
Import/Record Complete
    ↓ (immediate, Rust)
    ├── Generate waveform peaks (P2) → UI shows waveform
    ├── Compute duration, sample rate, channels → UI shows basic info
    ↓ (queued, Python sidecar)
    ├── Detect tempo/BPM (fast, ~10s) → UI shows tempo
    ├── Detect key (fast, ~10s) → UI shows key
    ├── Detect sections/boundaries (medium, ~30s) → UI shows section markers
    ├── Compute audio embedding (medium, ~30s) → Spatial map updates
    ├── Detect chords (slow, ~2min) → UI shows chord progression
    └── Source separation (very slow, ~10min for 120min jam) → Stems available

Each step:
  1. Python completes analysis
  2. Sends result to Rust via IPC
  3. Rust writes to SQLite
  4. Rust pushes SSE event to frontend
  5. Frontend updates UI reactively
```

**SSE event structure:**
```json
{"event": "analysis_progress", "data": {
  "jam_id": "abc123",
  "step": "tempo",
  "status": "complete",
  "result": {"bpm": 120.0, "confidence": 0.95}
}}
```

## Data Flow

### Recording Flow

```
Audio Interface (cpal)
    ↓ callback (real-time thread, no allocation)
Ring Buffer (lock-free)
    ↓ consumer (writer thread)
WAV Writer
    ↓ incremental writes + periodic header updates
Disk (~/wallflower/recordings/YYYY-MM-DD_HHMMSS.wav)
    ↓ on stop
File Manager registers in SQLite
    ↓ triggers
Priority Scheduler queues analysis tasks
```

### Import Flow

```
Source (folder watcher OR device monitor OR manual import)
    ↓
File Manager
    ├── Copy to ~/wallflower/library/{hash}/ (NEVER modify original)
    ├── Write to temp path first, atomic rename when complete
    └── Register in SQLite
         ↓ triggers
Priority Scheduler queues analysis tasks
```

### Spatial Explorer Data Flow

```
Audio Embeddings (computed by Python sidecar)
    ↓ stored in SQLite as float vectors
UMAP Projection (computed by Python sidecar on full embedding set)
    ↓ 2D coordinates stored in SQLite
Frontend fetches 2D positions + metadata
    ↓
WebGL/Canvas renderer plots jams as interactive points
    ├── Color by: key, tempo, date, instrument, collaborator
    ├── Click: show jam details, play preview
    └── Re-compute UMAP periodically as new jams added
```

### Key Data Flows Summary

1. **Recording:** cpal callback -> ring buffer -> WAV writer -> disk -> SQLite -> scheduler -> analysis pipeline
2. **Import:** file source -> copy to library -> SQLite -> scheduler -> analysis pipeline
3. **Playback:** frontend request -> axum Range handler -> disk read -> 206 response -> browser audio element
4. **Analysis:** scheduler dispatches -> Python sidecar processes -> result via IPC -> SQLite update -> SSE to frontend
5. **Export:** user selects bookmark -> backend reads audio range (+ optional stems) -> writes to export folder -> notification

## Scaling Considerations

This is a single-user, single-machine application. "Scaling" means growing the library over years.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 jams | Everything works out of the box. UMAP on full set is instant. |
| 50-500 jams | SQLite queries need proper indexes. UMAP recomputation takes seconds. Peak files add up (~50MB). |
| 500-5000 jams | SQLite FTS5 for text search. Incremental UMAP (add new points to existing projection). Consider pre-computed search facets. |
| 5000+ jams | Unlikely for personal use, but: pagination everywhere, lazy-load peaks, background UMAP recomputation with caching. |

### Scaling Priorities

1. **First bottleneck:** Waveform peak loading for very long recordings. Mitigation: multi-resolution peaks, load only visible range.
2. **Second bottleneck:** UMAP recomputation as library grows. Mitigation: incremental projection updates, cache projections, recompute only when new jams are added.
3. **Third bottleneck:** SQLite write contention during analysis. Mitigation: WAL mode handles this -- multiple readers, single writer is fine for this use case.

## Anti-Patterns

### Anti-Pattern 1: Embedding Python in Rust via PyO3

**What people do:** Use PyO3/pyo3 to call Python directly from the Rust process, sharing the same address space.
**Why it's wrong:** PyTorch + demucs + essentia have enormous memory footprints and can crash. A crash in the Python interpreter kills the entire Rust process, including any active recording. The GIL also limits concurrency.
**Do this instead:** Run Python as a separate subprocess (sidecar). If it crashes, Rust detects the failure and can restart it. Recording is never affected.

### Anti-Pattern 2: Streaming Audio Bytes Over IPC

**What people do:** Send raw audio data through the IPC channel (gRPC, socket) between Rust and Python.
**Why it's wrong:** A 120-minute stereo 32-bit WAV file is ~2.5 GB. Serializing and deserializing this through a socket is wasteful when both processes have direct filesystem access.
**Do this instead:** Pass file paths. Python reads from disk. Results (stems, metadata) are also exchanged as file paths + JSON metadata.

### Anti-Pattern 3: Decoding Full Audio in Browser for Waveform

**What people do:** Use Web Audio API's `decodeAudioData()` to decode the entire audio file in the browser, then compute peaks client-side.
**Why it's wrong:** Browser memory limits. A 120-minute WAV decoded to float32 samples is ~2.5 GB in memory. Chrome will crash or OOM. Even smaller files cause noticeable latency.
**Do this instead:** Pre-compute waveform peaks server-side in Rust. Frontend loads only peak data (a few MB) and renders instantly via wavesurfer.js `load(url, peaks, duration)`.

### Anti-Pattern 4: Writing Directly to Sync Folders

**What people do:** Write files directly to their final path in a Dropbox/iCloud-synced folder.
**Why it's wrong:** Sync services upload partially-written files, causing corrupted files on other devices and wasted bandwidth. Large audio files are especially bad -- sync starts on first write and continuously re-syncs as the file grows.
**Do this instead:** Write to a temp path outside the sync folder (or use `.nosync` extension on macOS/iCloud), then atomic-rename into the final location. The sync service sees a single complete file appear.

### Anti-Pattern 5: Single WAV Header Write at Close

**What people do:** Write the WAV header with placeholder sizes at the start, write all audio data, then update header sizes only when recording stops.
**Why it's wrong:** Any crash, power loss, or app kill loses the entire recording because the header has invalid size fields. Most audio software cannot open a WAV with zero-length headers.
**Do this instead:** Periodically update the WAV header size fields and fsync during recording (every 5-10 seconds). On crash, the file is valid up to the last header update. At worst, you lose 10 seconds of audio, not 2 hours.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Audio interfaces (cpal) | cpal's HostTrait/DeviceTrait abstraction | macOS uses CoreAudio backend. Handle device disconnection gracefully. |
| Zoom F3 recorder | Mounted as USB mass storage device | Monitor /Volumes/ for device mount events. Detect new WAV files. |
| Dropbox/iCloud | Indirect -- atomic rename into synced folder | Use temp-file-then-rename pattern. Respect `.nosync` conventions. |
| Ableton Live (v1) | Export stems/slices to a watched folder | Ableton can browse folders in its browser. No API integration needed. |
| demucs (archived repo) | Python API via adefossez/demucs fork | Use `demucs.api` module, not CLI subprocess. Pin model version. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend <-> Rust API | HTTP REST + SSE | JSON payloads. SSE for real-time progress. Range requests for audio. |
| Rust Backend <-> Python Sidecar | JSON over Unix domain socket | File paths for audio data, JSON for metadata. Rust manages sidecar lifecycle. |
| Rust Backend <-> SQLite | rusqlite (direct, in-process) | WAL mode. Single writer. Connection pool for readers. |
| Recording Engine <-> Audio I/O | cpal callback -> lock-free ring buffer | Real-time audio thread must never block. Ring buffer decouples capture from disk I/O. |
| Priority Scheduler <-> All Tasks | CancellationToken + task queue | Scheduler owns task lifecycle. Tasks check cancellation cooperatively. |

## Suggested Build Order

Based on component dependencies, the recommended build order is:

```
Phase 1: Foundation
  SQLite schema + migrations
  HTTP API skeleton (axum)
  File manager (import, copy-first, atomic writes)
  Folder watcher (notify crate)
  → Milestone: Can import audio files, store metadata, browse library via API

Phase 2: Audio Playback
  Waveform peak generator (Rust)
  Audio streamer (HTTP Range requests)
  Frontend: waveform viewer (wavesurfer.js + pre-computed peaks)
  Frontend: timeline browser
  → Milestone: Can import, browse, and play audio with scrubbing

Phase 3: Recording
  Recording engine (cpal + ring buffer + incremental WAV writer)
  Priority scheduler (basic: recording flag pauses other work)
  Device monitor (Zoom F3 detection)
  Frontend: recording controls + live metadata editing
  → Milestone: Can record audio, edit metadata live, auto-import

Phase 4: ML Analysis Pipeline
  Python sidecar scaffold (IPC server, model manager)
  Audio analysis (tempo, key, sections)
  Progressive analysis pipeline (SSE updates to frontend)
  Frontend: display progressive analysis results
  → Milestone: Imported/recorded jams get auto-analyzed, results appear progressively

Phase 5: Source Separation & Export
  Demucs integration in sidecar
  Export engine (time slices, stem separation)
  Bookmark system (mark sections for export)
  Frontend: bookmark UI, export controls
  → Milestone: Can separate sources, bookmark and export stems to Ableton folder

Phase 6: Spatial Explorer
  Embedding computation (CLAP/musicnn in sidecar)
  UMAP projection (Python)
  Spatial index in SQLite
  Frontend: spatial map (WebGL/canvas)
  → Milestone: Browse jams by musical similarity in 2D space
```

**Build order rationale:**
- **File management before audio** because every subsequent feature depends on safe file handling and database.
- **Playback before recording** because the waveform viewer and audio streamer are needed to verify recordings work correctly.
- **Recording before ML** because recording is the core workflow and the priority scheduler must exist before ML tasks can be managed.
- **Analysis before separation** because analysis is faster and validates the sidecar IPC pattern before tackling the heavier demucs workload.
- **Spatial explorer last** because it depends on embeddings from the analysis pipeline and is the most experimental feature.

## Sources

- [cpal - Rust Audio I/O library](https://github.com/RustAudio/cpal)
- [Rust audio programming ecosystem 2025](https://andrewodendaal.com/rust-audio-programming-ecosystem/)
- [wavesurfer.js pre-computed peaks](https://wavesurfer.xyz/faq/)
- [wavesurfer.js GitHub - byte range requests discussion](https://github.com/katspaugh/wavesurfer.js/discussions/3662)
- [BBC audiowaveform](https://github.com/bbc/audiowaveform)
- [SQLite WAL mode](https://sqlite.org/wal.html)
- [SQLite concurrent writes](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- [Hugging Face TGI three-tier architecture (Rust+Python)](https://deepwiki.com/huggingface/text-generation-inference/2.1-router-component)
- [Combining Rust and Python for AI Systems](https://thenewstack.io/combining-rust-and-python-for-high-performance-ai-systems/)
- [demucs Python API](https://github.com/facebookresearch/demucs/issues/448)
- [demucs repository (archived, moved to adefossez/demucs)](https://github.com/facebookresearch/demucs)
- [Self-hosted stem separation with demucs/FastAPI architecture](https://danielhonus.com/log/muxr/)
- [UMAP for audio embedding visualization](https://repositori.upf.edu/bitstream/handle/10230/53710/Serra_smc_visu.pdf)
- [Audio Atlas: Visualizing Audio Datasets](https://arxiv.org/html/2412.00591v1)
- [RTIC priority-based preemption](https://rtic.rs/1/book/en/by-example/app_priorities.html)
- [tokio cooperative task yielding](https://tokio.rs/blog/2020-04-preemption)

---
*Architecture research for: Wallflower - local-first jam/sample manager*
*Researched: 2026-04-18*
