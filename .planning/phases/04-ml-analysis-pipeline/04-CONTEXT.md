# Phase 4: ML Analysis Pipeline - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Imported and recorded jams are automatically analyzed for tempo, key, sections, and loops by a Python ML sidecar communicating with the Rust backend via gRPC. Results appear progressively in the UI as each analysis step completes. Users can search and filter their jam library by musical attributes, metadata, and free text. The model interface is abstracted for future model swaps. Analysis gracefully degrades on lower-powered hardware.

</domain>

<decisions>
## Implementation Decisions

### Analysis Results in the UI
- **D-01:** Jam cards always show key and BPM badge slots. Values display when available; subtle "--" placeholders when analysis is pending. Layout never shifts.
- **D-02:** Section boundaries shown as colored vertical lines with short labels ("Intro", "Verse A", "Loop 1") on the waveform in the detail view. Colors differentiate section types. Consistent with Ableton arrangement markers.
- **D-03:** Analysis progress shown as a subtle "Analyzing..." status badge on the jam card, plus a detailed progress section in the jam detail view showing which steps are done (tempo check, key check, sections pending...).
- **D-04:** Analysis results in the jam detail view displayed as a compact summary row of chips/badges (Key, BPM, Section count, Loop count) below the waveform, alongside existing metadata. Clicking a chip could expand to show details in a future phase.
- **D-05:** Detected loops shown as bracketed regions on the waveform (like repeat brackets in sheet music). Each bracket shows repeat count and whether the loop evolves (e.g., "Loop A x4" vs "Loop A x4 (evolving)"). Part of the section markers system.

### Python Sidecar Lifecycle
- **D-06:** Sidecar starts lazily on first analysis request, not on app launch. App starts faster, no wasted resources if user just wants to record/browse. Small delay on first analysis acceptable.
- **D-07:** Sidecar stays alive while the app is running once started. Avoids repeated startup cost (Python + model loading). Killed when app quits.
- **D-08:** If sidecar crashes, Rust backend auto-restarts it and re-queues the failed analysis. Max 3 retries before marking as failed. User sees brief "restarting analysis..." status.
- **D-09:** Analysis pipeline runs sequentially per jam: tempo -> key -> sections -> loops. One step at a time. Results stream to UI as each step completes via SSE or Tauri events. Simpler, predictable memory usage.

### Model Management UX
- **D-10:** Models download in the background on first analysis request. Progress indicator shown in Settings. App is fully usable (record, browse, import) -- only analysis is unavailable until models are ready. No blocking setup wizard.
- **D-11:** Settings shows which models are installed, their versions, and disk usage. No UI to add/remove individual models -- managed automatically. The abstracted model interface (AI-08) is a developer concern, not user-facing.

### Search & Filter Experience
- **D-12:** Horizontal filter bar above the timeline with dropdown selectors for Key, Tempo range, Tags, Collaborators, Instruments, Date range. Filters combine with AND logic. Active filters shown as removable chips.
- **D-13:** Tempo filter uses a dual-handle range slider (e.g., 110-130 BPM). Musicians think in tempo ranges, not exact values.
- **D-14:** Key filter uses a dropdown listing all detected keys with multi-select support. Simple and direct.
- **D-15:** Free-text search box that matches against jam notes, tags, collaborators, instruments, and filenames. Complements the structured filters.

### Analysis Queue Behavior
- **D-16:** Queue ordering: currently-viewed jam jumps to front of queue. Otherwise FIFO (oldest unanalyzed first). Prioritizes what the user cares about right now.
- **D-17:** When recording starts, analysis is interrupted immediately and re-queued at front. Recording priority is absolute. Analysis restarts from scratch when recording stops (steps aren't resumable mid-stream).

### Re-analysis & Corrections
- **D-18:** Users can manually override detected key and BPM values. UI shows whether a value was AI-detected or manually set (small icon or different text treatment). Manual values are never overwritten by re-analysis.
- **D-19:** A "Re-analyze" action in the jam detail view re-runs the full pipeline for that jam. Useful after model updates or if initial results seem wrong. Respects manual overrides (doesn't overwrite them unless user explicitly clears them).

### Hardware Adaptation
- **D-20:** Analysis runs on any Apple Silicon hardware but with graceful degradation on lower-powered machines. App auto-detects hardware and sets a default analysis profile (Full / Standard / Lightweight).
- **D-21:** User can override the analysis profile in Settings. Lightweight profile skips the heaviest models. Profiles affect which essentia models are loaded and which analysis steps run.

### Claude's Discretion
- gRPC service definition and protobuf message design
- SSE vs Tauri event channel for streaming analysis results to the frontend
- Analysis step ordering within the sequential pipeline
- Hardware detection method and profile thresholds
- Model download/versioning implementation details
- SQLite schema migration for analysis results (new columns vs new tables)
- Filter bar component implementation details
- How "evolving loop" detection works under the hood

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` -- Full technology stack: tonic 0.14.x (gRPC), prost 0.13.x (protobuf), essentia 2.1-beta6, demucs-mlx, librosa 0.10.x, grpcio 1.x, mlx, uv for Python package management
- `.planning/PROJECT.md` -- Project vision, constraints, recording priority requirement, target hardware (M4 Mac Mini), Zoom F3 recorder
- `.planning/REQUIREMENTS.md` -- AI-01 through AI-10, META-08 requirements for this phase
- `.planning/ROADMAP.md` -- Phase 4 success criteria, dependency on Phase 3

### Prior Phase Context
- `.planning/phases/01-tauri-app-shell-storage-api-foundation/01-CONTEXT.md` -- Tauri IPC pattern (D-12), settings UI (D-07/D-08)
- `.planning/phases/02-playback-metadata-design-system-notifications/02-CONTEXT.md` -- Waveform overlay system (D-06), transport bar (D-07), design system (D-01-D-04), jam cards (D-09)
- `.planning/phases/03-recording-engine-system-integration/03-CONTEXT.md` -- Priority scheduler (D-13), recording-locks-UI pattern (D-11)

### Existing Code
- `crates/wallflower-core/src/recording/scheduler.rs` -- PriorityScheduler with `may_proceed()` gate for background tasks
- `crates/wallflower-core/src/db/schema.rs` -- Current JamRecord schema (no analysis fields yet -- needs migration)
- `crates/wallflower-core/src/db/mod.rs` -- Database operations, SQLite with WAL mode, settings key-value store
- `src/components/library/JamCard.tsx` -- Jam card component (extend with key/BPM badges)
- `src/components/library/JamDetail.tsx` -- Jam detail view (extend with analysis results)
- `src/components/waveform/WaveformOverview.tsx` -- Waveform overview (extend with section markers)
- `src/components/waveform/WaveformDetail.tsx` -- Waveform detail view (extend with section markers and loop brackets)

### Technology
- tonic 0.14.x (crates.io/crates/tonic) -- Rust gRPC server for sidecar communication
- grpcio 1.x -- Python gRPC client
- essentia 2.1-beta6 (essentia.upf.edu) -- Key, chord, tempo, tonal analysis with pre-trained TensorFlow models
- librosa 0.10.x -- Audio loading, spectrograms, onset detection
- demucs-mlx -- Source separation (Phase 5, but model download infrastructure shared)
- uv -- Python package management for sidecar

### Research References
- `.planning/research/STACK.md` -- Technology stack research and rationale
- `.planning/research/ARCHITECTURE.md` -- Architecture research

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- PriorityScheduler (`recording/scheduler.rs`) -- already gates background tasks during recording, analysis queue integrates here
- JamCard component -- has layout slots for metadata, extend with key/BPM badges
- JamDetail component -- extend with analysis summary row and re-analyze button
- WaveformOverview/Detail components -- extend with section markers and loop brackets
- Settings page -- extend with model management section and analysis profile selector
- Tauri event listener component (`tauri-event-listener.tsx`) -- may be extendable for analysis progress events
- TagChip component -- reusable for analysis result chips (key, BPM badges)

### Established Patterns
- Tauri IPC commands for frontend-backend communication
- SQLite via rusqlite with WAL mode, PRAGMA user_version for schema migrations
- zustand for client state, @tanstack/react-query for server state
- Dark theme with Mutable Instruments design language
- Toast notifications via sonner
- Atomic file operations

### Integration Points
- New: gRPC server in Rust backend + gRPC client in Python sidecar (greenfield)
- New: Protobuf definitions shared between Rust and Python (greenfield)
- New: SSE or Tauri event channel for streaming analysis results to frontend
- New: SQLite schema migration adding analysis result columns/tables
- New: Filter bar component in library view above timeline
- New: Python sidecar process management (spawn, health check, restart)
- Existing: PriorityScheduler `may_proceed()` gate -- analysis queue checks this

</code_context>

<specifics>
## Specific Ideas

- Analysis results should feel like they "light up" progressively -- the jam card starts with "--" placeholders and fills in as each analysis step completes
- Section markers on the waveform should feel like Ableton's arrangement markers -- colored vertical lines with labels, not cluttering the waveform
- Loop brackets inspired by sheet music repeat notation -- a familiar metaphor for musicians
- The filter bar should feel instant and responsive -- no loading states when filtering, since it's querying local SQLite
- Hardware adaptation matters because the developer uses both an M4 Mac Mini and an M1 MacBook Air -- the app should work well on both
- Analysis profile auto-detection should be conservative (suggest Lightweight on M1 Air) with easy override in Settings
- Model downloads should never block the user from doing anything -- recording and browsing always work immediately

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-ml-analysis-pipeline*
*Context gathered: 2026-04-19*
