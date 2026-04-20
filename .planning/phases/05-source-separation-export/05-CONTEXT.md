# Phase 5: Source Separation & Export - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can isolate instruments from recordings using demucs-mlx, bookmark interesting sections of jams on the waveform, preview separated stems with a built-in mixer, and export time-sliced audio or source-separated stems to a folder that Ableton can browse. Exports are self-contained for sharing with collaborators. Separation runs on-demand per bookmark (not full-jam upfront), uses chunked processing to stay within memory limits, and respects recording priority.

</domain>

<decisions>
## Implementation Decisions

### Bookmarking UX
- **D-01:** Bookmarks created via click-drag on the waveform detail view. User drags across the waveform to select a time range, a region appears, and a small popover offers name input with Save/Cancel. Matches Ableton/Logic selection behavior.
- **D-02:** Snap-assist: edges snap to nearby section/loop boundaries from Phase 4 analysis when close (like DAW snap-to-grid). Hold modifier key to disable snap for precise free-form selection.
- **D-03:** Bookmark metadata: user-editable name (auto-generated default "Bookmark 1"), color from a palette for visual distinction, and a free-text notes field for recording intent (e.g., "cool bass riff", "export this for track B").
- **D-04:** Bookmarks render as a separate visual layer above Phase 4 section markers on the waveform. Colored region overlays for bookmarks, vertical lines for AI sections — visually distinct concerns (user intent vs AI-detected structure), both visible simultaneously.

### Export Workflow
- **D-05:** Export triggered via context menu on bookmark (right-click or menu icon on the bookmark region). Options: "Export audio" (time-sliced), "Export stems" (source-separated). Also includes "Edit bookmark" and "Delete bookmark" actions.
- **D-06:** Export folder structure: `~/wallflower/exports/[Jam Name]/[Bookmark Name].wav` for time-sliced audio, `~/wallflower/exports/[Jam Name]/[Bookmark Name]_stems/drums.wav|bass.wav|vocals.wav|other.wav` for stems. Configurable export root in Settings.
- **D-07:** Default export format: WAV 24-bit (Ableton standard). Configurable in Settings to change default format (WAV/FLAC) and bit depth (16/24/32-float). 32-bit float recordings auto-downsample to 24-bit per EXP-06. No per-export format dialog.
- **D-08:** Self-contained exports include audio file(s) plus a small JSON metadata sidecar with jam info (key, BPM, tags, notes, collaborators, source jam reference). Collaborators can use the audio directly and reference the metadata.

### Source Separation UX
- **D-09:** Source separation runs on-demand per bookmark — only when user clicks "Export stems." Processes just the bookmarked time range. No upfront full-jam separation. Saves compute; user waits at export time (~30s for 2-min section on M4).
- **D-10:** After separation completes, a stem mixer panel slides up from the bottom of the jam detail view (replaces metadata area temporarily). Waveform stays visible. Mixer shows solo/mute buttons per stem with playback controls. User can audition stems before exporting.
- **D-11:** Export options in the mixer: "Export All" (all 4 stems) or "Export Selected" (only soloed/unmuted stems). Dismiss mixer to return to metadata view.
- **D-12:** Demucs model is user-selectable in Settings: 4-stem (htdemucs: drums, bass, vocals, other) or 6-stem (htdemucs_6s: adds guitar and piano). Default to 4-stem. Leverages the abstracted model interface from Phase 4 (AI-08).

### Chunked Processing
- **D-13:** Chunk-aware progress bar in the slide-up panel during separation. Shows overall percentage, chunk progress ("Chunk 7/12"), and estimated time remaining. Cancel button available.
- **D-14:** When recording starts during active separation, separation pauses immediately via PriorityScheduler. When recording stops, separation resumes from last completed chunk — no wasted work. UI shows "Paused — recording in progress." Consistent with Phase 3/4 recording priority.
- **D-15:** Memory limit auto-detected from available system memory. Default targets ~4GB for separation (leaves headroom). Users can adjust in Settings. Ties into Phase 4 hardware profile (D-20). Chunk size calculated to stay within the configured limit.

### Claude's Discretion
- Chunk size and overlap-add strategy for demucs
- gRPC service extension for separation requests (extend existing wallflower_analysis.proto or new .proto)
- SQLite schema for bookmarks and export records
- Stem audio caching strategy (keep separated stems on disk or re-run each time)
- Bookmark color palette design
- Snap-assist threshold distance and modifier key choice
- JSON sidecar format and fields
- Export filename sanitization rules

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` — Full technology stack: demucs-mlx, hound 3.5.x (WAV writing), symphonia (audio decoding), tonic 0.14.x (gRPC), grpcio 1.x (Python gRPC), mlx, uv for Python
- `.planning/PROJECT.md` — Project vision, constraints, recording priority, target hardware (M4 Mac Mini), Ableton as primary DAW
- `.planning/REQUIREMENTS.md` — AI-04, AI-10, EXP-01 through EXP-06 requirements for this phase

### Prior Phase Context
- `.planning/phases/02-playback-metadata-design-system-notifications/02-CONTEXT.md` — Waveform overlay system (D-06), design system (D-01-D-04), transport bar (D-07)
- `.planning/phases/03-recording-engine-system-integration/03-CONTEXT.md` — Priority scheduler (D-13), recording-locks-UI pattern (D-11)
- `.planning/phases/04-ml-analysis-pipeline/04-CONTEXT.md` — gRPC sidecar pattern (D-06-D-09), analysis queue (D-16/D-17), section markers (D-02), loop brackets (D-05), hardware profiles (D-20/D-21), model management (D-10/D-11), model interface abstraction (AI-08)

### Existing Code
- `proto/wallflower_analysis.proto` — Existing gRPC service definition (AnalysisService, Section, Loop messages — extend for separation)
- `crates/wallflower-core/src/analysis/queue.rs` — AnalysisQueue with JobPriority (extend for separation jobs)
- `crates/wallflower-core/src/analysis/provider.rs` — Analysis provider abstraction (extend for separation)
- `crates/wallflower-core/src/recording/scheduler.rs` — PriorityScheduler with `may_proceed()` gate
- `src/components/waveform/WaveformDetail.tsx` — Waveform detail view (add bookmark regions layer)
- `src/components/waveform/WaveformOverview.tsx` — Waveform overview (add bookmark indicators)
- `src/components/library/JamDetail.tsx` — Jam detail view (add stem mixer slide-up panel)
- `crates/wallflower-core/src/audio/` — Audio processing utilities
- `crates/wallflower-core/src/db/schema.rs` — Current schema (needs migration for bookmarks/exports)

### Technology
- demucs-mlx (github.com/ssmall256/demucs-mlx) — MLX port of HTDemucs, 73x realtime on M4, supports htdemucs and htdemucs_6s models
- hound 3.5.x — WAV file writing for exports
- wavesurfer.js regions plugin — For bookmark region rendering on waveform

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- AnalysisQueue (`analysis/queue.rs`) — extend with separation job type, already has priority ordering
- PriorityScheduler (`recording/scheduler.rs`) — `may_proceed()` gate handles recording preemption
- WaveformDetail/Overview components — extend with bookmark regions layer (wavesurfer.js regions plugin)
- JamDetail component — host for the slide-up stem mixer panel
- Tauri event listener component — extend for separation progress events
- gRPC proto definitions — extend for separation RPC
- Python sidecar infrastructure (Phase 4) — add demucs separation as another analysis step
- 32-bit float downsampling utility (Phase 1, STOR-05) — reuse for export bit depth conversion

### Established Patterns
- Tauri IPC commands for frontend-backend communication
- gRPC streaming for progress updates (AnalysisProgress pattern)
- SQLite via rusqlite with WAL mode, migration via PRAGMA user_version
- zustand for client state, @tanstack/react-query for server state
- Dark theme with Mutable Instruments design language
- Atomic file operations for export writes
- Toast notifications via sonner for completion events

### Integration Points
- Bookmark CRUD: new SQLite table, new Tauri commands, new zustand store
- Separation: extend gRPC proto with SeparateRequest/SeparateProgress, add demucs to Python sidecar
- Export: new Rust module for file writing (hound), folder management, metadata sidecar generation
- Stem mixer: new React component in jam detail view, Web Audio API or wavesurfer for stem playback
- Settings: extend with export format defaults, demucs model selection, memory limit override

</code_context>

<specifics>
## Specific Ideas

- Bookmark snap-assist should feel like DAW snap-to-grid — not mandatory, just helpful when edges are near section boundaries
- The stem mixer slide-up panel should feel lightweight and focused — musician auditions stems, picks what to export, done. Not a full DAW mixer.
- Export folder structure mirrors how a musician would organize samples in Ableton's browser — drill into a jam folder, see bookmarks and stems
- JSON metadata sidecar keeps exports meaningful when shared — collaborator knows the key, BPM, and context without having Wallflower installed
- On-demand separation respects that most bookmarks will be exported as time-sliced audio, not stems. Separation is the exception, not the default.
- 4-stem vs 6-stem model selection acknowledges that for eurorack/synth jams, even 6-stem won't perfectly isolate individual synth voices — "other" will always be a catch-all

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-source-separation-export*
*Context gathered: 2026-04-20*
