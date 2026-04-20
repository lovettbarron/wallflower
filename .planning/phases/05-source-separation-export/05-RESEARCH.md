# Phase 5: Source Separation & Export - Research

**Researched:** 2026-04-20
**Domain:** Audio source separation (demucs-mlx), bookmark/export UX, chunked ML processing, WAV file I/O
**Confidence:** HIGH

## Summary

Phase 5 adds three interconnected capabilities: bookmarking sections on the waveform, source separation via demucs-mlx, and exporting audio/stems to a DAW-compatible folder structure. The existing codebase provides strong foundations -- the `AnalysisQueue` with `JobPriority`, `PriorityScheduler` with `may_proceed()`, gRPC streaming for progress, the `downsample_32f_to_24i` utility, and the `AnalyzerBase` abstraction all extend naturally for this phase.

The critical technical challenge is chunked demucs processing for long recordings within memory limits. HTDemucs uses ~2-3GB for a 10-second segment at 44.1kHz stereo. A 60-minute recording must be split into chunks with overlap-add crossfading. The demucs-mlx Python API (`Separator.separate_audio_file()`) handles chunking internally, but we need to control segment size and overlap to respect the user's memory limit setting, and we need per-chunk progress reporting via gRPC streaming. This means wrapping the demucs-mlx separator at a lower level rather than calling the high-level API directly.

The frontend work centers on wavesurfer.js regions plugin for bookmark creation (drag-to-select), a new bookmark CRUD layer (SQLite + Tauri commands + zustand store), and the stem mixer slide-up panel. All frontend patterns follow established Phase 2/3/4 conventions.

**Primary recommendation:** Extend the existing gRPC AnalysisService with a `SeparateStems` RPC, implement chunk-level progress streaming, and cache separated stems on disk keyed by `bookmark_id + model_name`. Use the existing `PriorityScheduler.may_proceed()` gate between chunks for recording preemption.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Bookmarks created via click-drag on waveform detail view
- **D-02:** Snap-assist to section/loop boundaries, Option key to disable
- **D-03:** Bookmark metadata: name (auto-generated default), color palette, notes field
- **D-04:** Bookmarks as separate visual layer above Phase 4 section markers
- **D-05:** Export via context menu on bookmark (Export audio, Export stems, Edit, Delete)
- **D-06:** Export folder: `~/wallflower/exports/[Jam Name]/[Bookmark Name].wav` for audio, `_stems/` subfolder for stems
- **D-07:** Default WAV 24-bit, configurable format/bit-depth in Settings
- **D-08:** JSON metadata sidecar with jam info for self-contained exports
- **D-09:** Source separation on-demand per bookmark, only when "Export stems" clicked
- **D-10:** Stem mixer panel slides up from bottom, replaces metadata area, waveform stays visible
- **D-11:** Export All / Export Selected in mixer
- **D-12:** Model selectable in Settings: 4-stem (htdemucs) or 6-stem (htdemucs_6s)
- **D-13:** Chunk-aware progress bar with percentage, chunk count, ETA, cancel
- **D-14:** Recording pauses separation via PriorityScheduler, resumes from last completed chunk
- **D-15:** Memory limit auto-detected, default 4GB, user-adjustable in Settings

### Claude's Discretion
- Chunk size and overlap-add strategy for demucs
- gRPC service extension approach (extend existing proto or new proto)
- SQLite schema for bookmarks and export records
- Stem audio caching strategy
- Bookmark color palette design
- Snap-assist threshold distance and modifier key choice
- JSON sidecar format and fields
- Export filename sanitization rules

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-04 | Source separation using demucs-mlx on Apple Silicon | demucs-mlx Python API with Separator class, extend gRPC proto, add SeparationAnalyzer |
| AI-10 | Chunked processing with overlap-add for 60-min recordings within 8GB memory | 10s default segment, 0.25 overlap ratio, linear crossfade, chunk-between pause gate |
| EXP-01 | User can bookmark sections of a recording | wavesurfer.js regions plugin drag-to-select, SQLite bookmarks table, Tauri CRUD commands |
| EXP-02 | Export bookmarked sections as time-sliced audio | hound WAV writer for time-slice extraction, symphonia for decoding source |
| EXP-03 | Export bookmarked sections as source-separated stems | demucs-mlx separation of bookmark range, stem caching, mixer UI for audition |
| EXP-04 | Exports in configurable folder accessible to Ableton | `~/wallflower/exports/[Jam]/[Bookmark].wav` structure, configurable root in Settings |
| EXP-05 | Self-contained exports shareable with collaborators | JSON metadata sidecar with key, BPM, tags, notes, source jam reference |
| EXP-06 | 32-bit float recordings downsampled to 24-bit on export | Existing `downsample_32f_to_24i` in `audio/downsample.rs`, reuse for export pipeline |

</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| demucs-mlx | latest | Source separation on Apple Silicon | MLX-optimized HTDemucs, 73x realtime on M4, bit-exact with upstream |
| hound | 3.5.x | WAV file writing for exports | Already used for recording/downsampling, purpose-built WAV encoder |
| symphonia | 0.5.x | Audio file decoding for time-slice reads | Already in project, pure Rust, supports WAV/FLAC/MP3 |
| wavesurfer.js | 7.12.6 | Waveform display + regions plugin | Already in project, regions plugin built-in for bookmark overlays |
| @wavesurfer/react | 1.0.12 | React wrapper for wavesurfer | Already in project |
| tonic | 0.14.x | gRPC server (Rust side) | Already in project for analysis sidecar communication |
| grpcio | 1.x | gRPC client (Python side) | Already in project |
| rusqlite | 0.39.x | SQLite database | Already in project |
| zustand | 5.x | Client state management | Already in project for transport/recording stores |
| @tanstack/react-query | 5.x | Server state / API data | Already in project |

### Supporting (new additions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn ContextMenu | latest | Bookmark right-click context menu | New shadcn component install for D-05 |
| shadcn Sheet | latest | Stem mixer bottom slide-up panel | New shadcn component install for D-10 |

### No New Dependencies
This phase requires NO new npm packages or Rust crates. All work extends existing libraries. The Python sidecar needs `demucs-mlx` and `mlx` added to `pyproject.toml` dependencies.

**Python sidecar addition:**
```toml
# Add to sidecar/pyproject.toml dependencies
"demucs-mlx>=0.1",
"mlx>=0.20",
```

## Architecture Patterns

### Recommended Project Structure (new files)
```
migrations/
  V5__bookmarks_exports.sql           # Bookmarks + exports + stems tables

crates/wallflower-core/src/
  bookmarks/
    mod.rs                             # Bookmark CRUD operations
    schema.rs                          # BookmarkRecord, ExportRecord, StemRecord types
  export/
    mod.rs                             # Export orchestration (time-slice + stems)
    writer.rs                          # WAV/FLAC file writing with bit-depth conversion
    sidecar.rs                         # JSON metadata sidecar generation
    sanitize.rs                        # Filename sanitization

crates/wallflower-app/src/commands/
  bookmarks.rs                         # Tauri commands for bookmark CRUD
  export.rs                            # Tauri commands for export + separation

proto/
  wallflower_analysis.proto            # Extended with SeparateStems RPC

sidecar/src/wallflower_sidecar/
  analyzers/separation.py              # SeparationAnalyzer wrapping demucs-mlx

src/
  lib/stores/bookmarks.ts              # Bookmark zustand store
  lib/stores/separation.ts             # Separation state (progress, stems, mixer)
  components/bookmarks/
    BookmarkRegion.tsx                  # Wavesurfer region wrapper
    BookmarkPopover.tsx                 # Create/edit popover
    BookmarkList.tsx                    # Bookmark list below analysis summary
    BookmarkContextMenu.tsx            # Right-click context menu
  components/stems/
    StemMixer.tsx                       # Slide-up mixer panel
    StemRow.tsx                         # Individual stem row
    SeparationProgress.tsx             # Chunk-aware progress display
```

### Pattern 1: Chunked Separation with Progress Streaming
**What:** Process audio through demucs in fixed-size segments with overlap, streaming chunk-level progress via gRPC.
**When to use:** Any separation request.
**Key details:**
- Default segment: 10 seconds (at 44.1kHz = 441,000 samples)
- Overlap ratio: 0.25 (2.5s overlap between segments)
- Memory per chunk: ~2-3GB for htdemucs (4-stem), ~3-4GB for htdemucs_6s (6-stem)
- Between each chunk: check `PriorityScheduler.may_proceed()` -- if recording started, pause and save chunk index
- Linear crossfade on overlapping regions (fade out previous chunk end, fade in next chunk start, sum)
- For a 2-minute bookmark at 44.1kHz: ~16 chunks, ~30s on M4

```python
# Separation analyzer pattern (Python sidecar)
class SeparationAnalyzer(AnalyzerBase):
    def separate(self, audio_path: str, start_sec: float, end_sec: float,
                 model_name: str, segment: float = 10.0, overlap: float = 0.25,
                 on_progress=None) -> dict[str, np.ndarray]:
        # 1. Load audio segment from start_sec to end_sec
        # 2. Calculate chunk boundaries with overlap
        # 3. For each chunk:
        #    - Run separator on chunk
        #    - Report progress via callback
        #    - Check cancellation flag
        # 4. Crossfade overlap regions
        # 5. Return dict of stem_name -> audio_array
```

### Pattern 2: gRPC Proto Extension for Separation
**What:** Add `SeparateStems` RPC to existing `AnalysisService` rather than a new service.
**Why:** Keeps the single gRPC connection pattern, reuses health checking, follows existing streaming pattern.

```protobuf
// Extend wallflower_analysis.proto
service AnalysisService {
  // existing RPCs...
  rpc SeparateStems(SeparateRequest) returns (stream SeparationProgress);
}

message SeparateRequest {
  string bookmark_id = 1;
  string audio_path = 2;
  float start_seconds = 3;
  float end_seconds = 4;
  string model_name = 5;       // "htdemucs" or "htdemucs_6s"
  float segment_seconds = 6;    // chunk size, default 10.0
  float overlap = 7;            // overlap ratio, default 0.25
}

message SeparationProgress {
  string bookmark_id = 1;
  SeparationStatus status = 2;
  int32 current_chunk = 3;
  int32 total_chunks = 4;
  float percent_complete = 5;
  float estimated_seconds_remaining = 6;
  // On completion, stem_paths contains paths to cached stem files
  repeated StemFile stem_files = 7;
}

enum SeparationStatus {
  SEPARATING = 0;
  CHUNK_COMPLETE = 1;
  COMPLETED = 2;
  FAILED = 3;
  CANCELLED = 4;
  PAUSED = 5;
}

message StemFile {
  string stem_name = 1;  // "drums", "bass", "vocals", "other", etc.
  string file_path = 2;
  int64 file_size_bytes = 3;
}
```

### Pattern 3: Stem Caching Strategy
**What:** Cache separated stems on disk, keyed by bookmark ID + model name.
**Why:** Avoids re-running demucs when user revisits "Export stems" for the same bookmark.

```
~/Library/Application Support/wallflower/stems/
  {bookmark_id}/
    {model_name}/
      drums.wav
      bass.wav
      vocals.wav
      other.wav
      manifest.json  # metadata: model version, audio hash, bookmark range
```

**Invalidation:** When bookmark time range is edited, delete cached stems for that bookmark. Track in `stem_cache` SQLite table.

### Pattern 4: Export Pipeline
**What:** Orchestrate the full export flow from bookmark to files on disk.
**Steps:**
1. Resolve export path: `{export_root}/{jam_name}/{bookmark_name}.wav` (sanitized)
2. For time-sliced export: read source audio from `start` to `end`, write with configured bit depth
3. For stem export: ensure stems are cached (run separation if not), copy stems to export folder
4. Generate JSON metadata sidecar alongside audio files
5. Use atomic writes (temp file + rename) for crash safety

### Pattern 5: Bookmark Region Snap-Assist
**What:** When dragging bookmark edges, snap to nearby section/loop boundaries from Phase 4 analysis.
**Implementation:** On drag end, query section and loop records for the jam. If any boundary is within 20px (converted to seconds based on waveform zoom level), snap the edge to that boundary. Show tooltip "Snapped to {label}". Option key bypass via `event.altKey` check.

### Anti-Patterns to Avoid
- **Processing full jam upfront:** Only separate the bookmarked time range, never the full recording (D-09)
- **Loading entire audio into memory for export:** Stream/read only the needed segment using symphonia seeks
- **Blocking UI during separation:** All separation runs in background with progress streaming
- **Custom audio crossfading from scratch:** Use established linear crossfade formula (ramp up + ramp down + sum)
- **Storing stems in the export folder:** Cache stems in app support dir, copy to export folder on export

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source separation | Custom ML model | demucs-mlx `Separator` | State-of-art quality, MLX optimized for Apple Silicon |
| WAV writing | Manual WAV byte writing | hound | Handles headers, multi-channel, bit depths correctly |
| Audio decoding | Custom format parsers | symphonia | Multi-format support, seeking, streaming |
| Region selection UI | Custom canvas drag logic | wavesurfer.js regions plugin | Handles drag, resize, events, rendering |
| Context menu | Custom positioned menu | shadcn ContextMenu (Radix) | Accessible, keyboard-navigable, positioned correctly |
| Bottom sheet panel | Custom slide-up animation | shadcn Sheet (side=bottom) | Handles animation, dismiss, overlay, focus trap |
| 32-bit to 24-bit conversion | Manual bit manipulation | Existing `downsample_32f_to_24i` | Already tested and correct in `audio/downsample.rs` |
| Overlap-add crossfade | Novel crossfade algorithm | Linear fade (standard DSP) | Simple, artifact-free, proven approach |

## Common Pitfalls

### Pitfall 1: Memory Explosion on Long Recordings
**What goes wrong:** Loading a 60-minute stereo 44.1kHz recording into memory all at once uses ~1.4GB for raw audio alone. Running demucs on it would exceed 8GB.
**Why it happens:** Naive implementation processes entire files.
**How to avoid:** Always chunk. Extract only the bookmarked range first, then chunk that range for demucs. For a 2-minute bookmark, 16 chunks at 10s is manageable. For time-sliced export, use symphonia seeking to read only the needed range.
**Warning signs:** Memory usage growing proportionally to file duration.

### Pitfall 2: Chunk Boundary Artifacts
**What goes wrong:** Audible clicks or phase discontinuities at chunk boundaries in separated stems.
**Why it happens:** Demucs output has artifacts at segment edges.
**How to avoid:** Use overlap-add with linear crossfade. 0.25 overlap ratio (2.5s for 10s segments) provides sufficient blending. Fade out last 2.5s of previous chunk, fade in first 2.5s of next chunk, sum.
**Warning signs:** Clicking sounds at regular intervals in separated audio.

### Pitfall 3: Race Condition Between Separation and Recording
**What goes wrong:** Demucs continues processing while recording starts, causing audio glitches in recording.
**Why it happens:** Separation and recording compete for CPU/memory.
**How to avoid:** Check `PriorityScheduler.may_proceed()` between EVERY chunk, not just at job start. Store current chunk index to resume from. Use the existing pattern from Phase 4 analysis queue.
**Warning signs:** Recording audio contains dropouts when separation is running.

### Pitfall 4: Bookmark Time Range vs. Sample Alignment
**What goes wrong:** Bookmark start/end times don't align to sample boundaries, causing off-by-one errors in exported audio length.
**Why it happens:** Floating-point time -> sample index conversion rounding.
**How to avoid:** Convert time to samples early: `sample = floor(time * sample_rate)`. Always work in samples internally, convert back to time only for display.
**Warning signs:** Exported audio is 1 sample longer/shorter than expected, loop points don't align.

### Pitfall 5: Export Path Collisions and Invalid Characters
**What goes wrong:** Two bookmarks with the same name in the same jam create overlapping export paths. Special characters in jam/bookmark names create invalid filesystem paths.
**Why it happens:** User-provided names aren't sanitized.
**How to avoid:** Sanitize filenames: replace `/\:*?"<>|` with `-`, trim whitespace, limit length to 200 chars. On collision, append ` (2)`, ` (3)`, etc. Validate before writing.
**Warning signs:** Export fails silently or overwrites previous export.

### Pitfall 6: Stem Playback Synchronization
**What goes wrong:** Playing multiple stems in the mixer, they drift out of sync or start at different positions.
**Why it happens:** Multiple audio sources started sequentially rather than atomically.
**How to avoid:** Use Web Audio API's `AudioContext.currentTime` for synchronized playback start. Load all stems into AudioBuffers, schedule `start()` at the same time. Alternatively, mix stems into a single buffer with solo/mute applied.
**Warning signs:** Phase misalignment between stems, flanging effect when playing all stems.

### Pitfall 7: Wavesurfer Regions Plugin Lifecycle in React
**What goes wrong:** Regions disappear after re-render, duplicate regions on state update, memory leaks from unsubscribed event listeners.
**Why it happens:** React re-renders destroy and recreate DOM; wavesurfer has its own lifecycle.
**How to avoid:** Initialize RegionsPlugin once in a `useEffect` with cleanup. Store the plugin instance in a ref. Sync regions with bookmark state using `useEffect` dependencies -- add/remove regions based on diff, don't recreate all regions on every render.
**Warning signs:** Regions flash on re-render, bookmark count doesn't match visible regions.

## Code Examples

### SQLite Migration V5: Bookmarks & Exports

```sql
-- V5: Bookmarks, exports, and stem cache tables

CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    color TEXT NOT NULL DEFAULT 'coral',
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_jam_id ON bookmarks(jam_id);

CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL,  -- 'audio' or 'stems'
    export_path TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'wav',
    bit_depth INTEGER NOT NULL DEFAULT 24,
    model_name TEXT,  -- NULL for audio exports, 'htdemucs'/'htdemucs_6s' for stems
    metadata_path TEXT,  -- path to JSON sidecar
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exports_bookmark_id ON exports(bookmark_id);

CREATE TABLE IF NOT EXISTS stem_cache (
    id TEXT PRIMARY KEY,
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    stem_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    audio_hash TEXT,  -- hash of source audio range for invalidation
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(bookmark_id, model_name, stem_name)
);
CREATE INDEX IF NOT EXISTS idx_stem_cache_bookmark ON stem_cache(bookmark_id, model_name);

PRAGMA user_version = 5;
```

### JSON Metadata Sidecar Format

```json
{
  "wallflower_version": "0.1.0",
  "source_jam": {
    "name": "jam-2026-04-19",
    "id": "uuid-here",
    "duration_seconds": 3600.0,
    "recorded_at": "2026-04-19T20:30:00Z"
  },
  "bookmark": {
    "name": "Cool bass riff",
    "start_seconds": 42.0,
    "end_seconds": 78.0,
    "notes": "nice groove, use for track B"
  },
  "analysis": {
    "key": "Bb minor",
    "bpm": 120.5,
    "tags": ["eurorack", "ambient"],
    "collaborators": ["Alice", "Bob"],
    "instruments": ["modular synth", "bass guitar"]
  },
  "export": {
    "format": "wav",
    "bit_depth": 24,
    "sample_rate": 44100,
    "channels": 2,
    "stems": ["drums", "bass", "vocals", "other"],
    "model": "htdemucs",
    "exported_at": "2026-04-20T10:00:00Z"
  }
}
```

### Filename Sanitization (Rust)

```rust
/// Sanitize a user-provided name for use as a filename.
pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();
    let trimmed = sanitized.trim().trim_matches('.');
    let limited = if trimmed.len() > 200 { &trimmed[..200] } else { trimmed };
    if limited.is_empty() { "untitled".to_string() } else { limited.to_string() }
}
```

### Wavesurfer Regions Plugin Integration (React)

```typescript
// Source: wavesurfer.js docs + existing WaveformDetail pattern
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

// In WaveformDetail component:
const regionsRef = useRef<RegionsPlugin | null>(null);

// Initialize regions plugin with wavesurfer instance
useEffect(() => {
  if (!wavesurfer) return;
  const regions = wavesurfer.registerPlugin(
    RegionsPlugin.create({ dragSelection: true })
  );
  regionsRef.current = regions;

  // Drag-select creates new bookmark
  regions.on("region-created", (region) => {
    // Only for user-created regions (drag), not programmatic
    if (!region.id.startsWith("bookmark-")) {
      onBookmarkDragEnd(region.start, region.end);
      region.remove(); // Remove temp region, replace with bookmark-managed one
    }
  });

  return () => {
    regions.destroy();
    regionsRef.current = null;
  };
}, [wavesurfer]);

// Sync bookmark state to regions
useEffect(() => {
  const regions = regionsRef.current;
  if (!regions) return;
  // Clear existing bookmark regions
  regions.getRegions()
    .filter(r => r.id.startsWith("bookmark-"))
    .forEach(r => r.remove());
  // Add regions for each bookmark
  bookmarks.forEach(bm => {
    regions.addRegion({
      id: `bookmark-${bm.id}`,
      start: bm.startSeconds,
      end: bm.endSeconds,
      color: BOOKMARK_COLORS[bm.color].fill,
      drag: true,
      resize: true,
    });
  });
}, [bookmarks]);
```

### Chunk Size Calculation from Memory Limit

```rust
/// Calculate the segment size in seconds based on available memory.
/// htdemucs uses ~250MB per second of audio at 44.1kHz stereo.
/// htdemucs_6s uses ~350MB per second.
pub fn calculate_segment_seconds(
    memory_limit_bytes: u64,
    model_name: &str,
    sample_rate: u32,
    channels: u16,
) -> f64 {
    let bytes_per_second: f64 = match model_name {
        "htdemucs_6s" => 350_000_000.0,
        _ => 250_000_000.0,  // htdemucs default
    };
    // Reserve 30% headroom for intermediate buffers
    let usable = memory_limit_bytes as f64 * 0.7;
    let segment = usable / bytes_per_second;
    // Clamp between 5 and 30 seconds
    segment.clamp(5.0, 30.0)
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Rust) | cargo test (built-in) |
| Framework (Python) | pytest 8.x |
| Framework (Frontend) | Not yet established (manual testing) |
| Rust quick run | `cargo test -p wallflower-core` |
| Python quick run | `cd sidecar && uv run pytest tests/ -x` |
| Full suite | `cargo test --workspace && cd sidecar && uv run pytest tests/` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-04 | Separation produces 4 stems from audio | integration | `cd sidecar && uv run pytest tests/test_separation.py -x` | No -- Wave 0 |
| AI-10 | 60-min audio stays under 8GB memory | integration | `cd sidecar && uv run pytest tests/test_separation.py::test_chunked_memory -x` | No -- Wave 0 |
| EXP-01 | Bookmark CRUD operations | unit | `cargo test -p wallflower-core bookmark` | No -- Wave 0 |
| EXP-02 | Time-sliced export produces correct WAV | unit | `cargo test -p wallflower-core export` | No -- Wave 0 |
| EXP-03 | Stem export produces correct stem files | integration | Manual (requires demucs model) |  |
| EXP-04 | Export folder structure matches spec | unit | `cargo test -p wallflower-core export::folder` | No -- Wave 0 |
| EXP-05 | JSON sidecar contains required fields | unit | `cargo test -p wallflower-core export::sidecar` | No -- Wave 0 |
| EXP-06 | 32-bit float downsampled to 24-bit | unit | `cargo test -p wallflower-core audio::downsample` | Yes (existing) |

### Sampling Rate
- **Per task commit:** `cargo test -p wallflower-core` + relevant Python tests
- **Per wave merge:** `cargo test --workspace && cd sidecar && uv run pytest tests/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `sidecar/tests/test_separation.py` -- SeparationAnalyzer unit tests (mock demucs, test chunking logic)
- [ ] `crates/wallflower-core/src/bookmarks/` module with tests -- bookmark CRUD
- [ ] `crates/wallflower-core/src/export/` module with tests -- export writer, sidecar generation
- [ ] `migrations/V5__bookmarks_exports.sql` -- schema migration

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| uv | Python sidecar management | Yes | 0.11.7 | -- |
| demucs-mlx | AI-04 source separation | No (not installed) | -- | Install via `uv add demucs-mlx mlx` in sidecar |
| hound | WAV writing | Yes | 3.5.x (in Cargo.toml) | -- |
| symphonia | Audio decoding | Yes | 0.5.x (in Cargo.toml) | -- |
| wavesurfer.js | Waveform regions | Yes | 7.12.6 | -- |
| shadcn ContextMenu | Bookmark context menu | No (not installed) | -- | `npx shadcn@latest add context-menu` |
| shadcn Sheet | Stem mixer panel | No (not installed) | -- | `npx shadcn@latest add sheet` |

**Missing dependencies with no fallback:**
- demucs-mlx must be added to Python sidecar dependencies (model download happens at runtime per AI-07)

**Missing dependencies with fallback:**
- shadcn ContextMenu and Sheet are install-on-demand (`npx shadcn@latest add context-menu sheet`)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PyTorch demucs on MPS | demucs-mlx on MLX | Feb 2026 | 2.6x faster, no MPS tensor issues |
| Full-file separation | On-demand per-bookmark | Phase 5 design | Saves compute, user waits only when needed |
| wavesurfer regions v6 | wavesurfer regions v7 (built-in) | wavesurfer 7.x | No separate plugin package needed, import from `wavesurfer.js/dist/plugins/regions` |

## Open Questions

1. **Exact demucs-mlx chunk control API**
   - What we know: `Separator.separate_audio_file()` exists as high-level API; `--overlap` and `--shifts` CLI flags
   - What's unclear: Whether the Python API exposes segment/chunk size control, or if we need to chunk the audio ourselves and call the separator per-chunk
   - Recommendation: Start with manual chunking (load segment, call separator, crossfade). This gives full control over progress reporting and pause/resume. If demucs-mlx exposes chunk callbacks, switch to that.

2. **Stem playback in mixer**
   - What we know: Need synchronized multi-stem playback with solo/mute
   - What's unclear: Whether to use Web Audio API directly (AudioBuffers + GainNodes) or wavesurfer instances per stem
   - Recommendation: Use Web Audio API directly. Create one AudioBuffer per stem, connect through GainNodes for mute control. Simpler and more reliable for synchronized playback than multiple wavesurfer instances. Mini waveforms in the mixer are static (pre-rendered canvas), not interactive wavesurfer instances.

3. **Memory per segment accuracy**
   - What we know: HTDemucs is memory-intensive, M4 has unified memory
   - What's unclear: Exact memory usage per second of audio in MLX (training data suggests ~250MB/s but unverified for MLX specifically)
   - Recommendation: Default to conservative 10s segments. Add a calibration step on first run that processes a 5s test segment and measures peak memory. Store in hardware profile from Phase 4.

## Sources

### Primary (HIGH confidence)
- demucs-mlx GitHub: https://github.com/ssmall256/demucs-mlx -- API, model support, MLX optimizations
- wavesurfer.js regions plugin docs: https://wavesurfer.xyz/plugins/regions -- region events, drag selection, programmatic API
- PyTorch Hybrid Demucs tutorial: https://docs.pytorch.org/audio/stable/tutorials/hybrid_demucs_tutorial.html -- chunking algorithm, overlap-add, crossfade
- Existing codebase: `proto/wallflower_analysis.proto`, `analysis/queue.rs`, `analysis/provider.rs`, `recording/scheduler.rs`, `audio/downsample.rs`

### Secondary (MEDIUM confidence)
- demucs upstream (facebook/demucs): https://github.com/facebookresearch/demucs -- segment/overlap parameters, memory management patterns
- demucs memory issues: https://github.com/facebookresearch/demucs/issues/231, https://github.com/facebookresearch/demucs/issues/498

### Tertiary (LOW confidence)
- Memory per segment estimates (250MB/s for htdemucs) -- extrapolated from training data and PyTorch benchmarks, not verified for MLX

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project or well-documented
- Architecture: HIGH -- extends established patterns from Phase 3/4 (gRPC streaming, priority scheduler, analysis queue)
- Chunking strategy: MEDIUM -- demucs-mlx specific chunk API needs runtime verification, but the overlap-add algorithm is well-established DSP
- Pitfalls: HIGH -- common issues well-documented in demucs issue tracker and wavesurfer discussions

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (stable domain, demucs-mlx actively maintained)
