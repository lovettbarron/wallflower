# Wallflower

## What This Is

Wallflower is a local-first jam and sample manager for musicians who want to focus on creating music, not managing files. It records, imports, analyzes, and organizes musical explorations — using local AI to automatically detect structure, separate sources, and tag metadata — so musicians can quickly find and extract the interesting moments from long jam sessions for use in a DAW or sampler.

## Core Value

A musician can go from "I just finished a 2-hour jam" to "here's the interesting 8-bar synth loop in Bb minor at 120bpm" with minimal effort, staying in creative flow rather than doing file management.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Record multi-channel audio (1-4 channels, default stereo) with incremental disk writes and crash safety
- [ ] Monitor for connected audio recorders (e.g., Zoom F3) and prompt to import new recordings
- [ ] Watch configurable folder (default ~/wallflower) for new audio files, with sync-folder safety (Dropbox, iCloud)
- [ ] Always COPY files to local storage before processing — never modify originals
- [ ] Process 32-bit float audio and downsample to 24-bit
- [ ] Generate metadata file from whole-file analysis (no splitting during initial processing)
- [ ] Detect key, chords, tempo, sections, and phrase boundaries using local AI models
- [ ] Identify repeated sections/loops and detect when loops change substantially
- [ ] Perform source separation (isolate instruments from mixed recordings) using local AI
- [ ] Browse jam library through a spatial map/explorer view (musical similarity, temporal proximity, instrumentation, collaborators)
- [ ] Browse jam library through a chronological timeline view
- [ ] Scrub and navigate audio without interruption during background processing
- [ ] Filter and search jams by musical attributes, tags, collaborators, instruments, time, place
- [ ] Bookmark sections for later processing
- [ ] Export bookmarked sections as stems (both time-sliced and source-separated)
- [ ] Export sections to a folder that Ableton can browse (v1), drag-and-drop to Ableton clip view (future)
- [ ] Share exports with collaborators as self-contained files
- [ ] Capture jam metadata: instruments, time, place, collaborators, tags, free-form notes
- [ ] Edit metadata and tags live during active recording
- [ ] Metadata live-saves to prevent data loss
- [ ] Auto-pause recording when audio falls below configurable silence threshold
- [ ] Gracefully recover from audio interface dropout without corrupting the recording
- [ ] Pause all AI processing while recording is active — recording always gets priority
- [ ] Non-blocking UX: model downloads don't block recording, features light up progressively as dependencies become ready
- [ ] Download AI models at runtime on first launch, cache locally (not in repo), reuse across app updates unless model version changes
- [ ] Abstract model interface so models can be swapped via configuration as new capabilities emerge
- [ ] API-driven backend with CLI for debugging and extension into services/daemons
- [ ] SQLite database for metadata, single-file backup

### Out of Scope

- Mobile app — web-first, local-first desktop experience
- Cloud sync of audio files — local storage only, though metadata DB is portable
- Real-time collaboration — this is a personal tool with sharing via export
- Commercial features (payments, accounts, multi-user) — open source, single-user
- GPU-dependent ML models — must run well on M4 Mac Mini CPU/Neural Engine
- More than 4 recording channels in v1 — architecture should support 8/16 but not initially
- Native drag-and-drop to Ableton in v1 — export-to-folder workflow first

## Context

- **Target hardware**: Maxed-out M4 Mac Mini (Apple Silicon, Neural Engine available)
- **Primary recording device**: Zoom F3 (32-bit float, 2-channel field recorder)
- **Primary DAW**: Ableton Live
- **Audio interface**: May experience dropouts that need graceful recovery
- **Storage**: ~/wallflower default, may be in Dropbox/iCloud sync folder — file writes must be atomic/safe
- **Scale**: Hundreds of jams over time, each up to 120 minutes, multi-channel
- **Existing tool**: roughneck (github.com/lovettbarron/roughneck) — existing source separation tool by the developer, potential integration or inspiration
- **License model**: MIT, open source, non-commercial. Avoid GPL dependencies. LGPL and system-level tools (FFmpeg) acceptable.

## Constraints

- **Tech stack**: Rust backend (performance-critical audio I/O, API, recording) + React/Next.js frontend (waveform UI, spatial explorer) + Python sidecar (ML models — demucs, analysis)
- **Database**: SQLite — single file, portable, fast queries for metadata
- **AI/ML**: All models run locally. Models downloaded at runtime, cached in user data directory, versioned for update-safe reuse. Model interface abstracted for forward compatibility.
- **Recording priority**: Active recording preempts ALL other processing. Task scheduler must support pause/resume of ML workloads.
- **File safety**: Atomic writes, write-ahead patterns for recordings, sync-folder awareness. Incremental writes for long recordings to prevent total data loss.
- **Licensing**: MIT for project code. No GPL dependencies in core. LGPL acceptable via dynamic linking. System tools like FFmpeg acceptable.
- **Testing**: Full test coverage across all components. UAT at each phase.
- **Documentation**: README updated each phase. Release at each milestone. agents.md for captured feedback/skills.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rust backend over Python | Audio I/O performance, recording reliability, safe concurrency for multi-channel capture | — Pending |
| Python sidecar for ML | Full access to audio ML ecosystem (demucs, librosa, essentia) without rewriting in Rust | — Pending |
| SQLite over markdown/flat files | Hundreds of jams with rich metadata needs fast queries; single-file backup still works | — Pending |
| React/Next.js frontend | Rich ecosystem for audio visualization (wavesurfer.js, Web Audio API), spatial UX libraries | — Pending |
| Spatial map explorer UX | Differentiator — browse by musical relationships, not just file names. Multi-dimensional: similarity, time, instrumentation, collaborators | — Pending |
| Runtime model downloads | Keep repo lean, allow model updates independent of code updates, version-check before re-download | — Pending |
| Export-to-folder before drag-and-drop | Browser-to-DAW drag-and-drop is technically complex; folder export is reliable and sufficient for v1 | — Pending |
| Recording priority over analysis | Musician flow state must never be interrupted by background processing | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-18 after initialization*
