# Requirements: Wallflower

**Defined:** 2026-04-18
**Core Value:** A musician can go from "I just finished a 2-hour jam" to "here's the interesting 8-bar synth loop in Bb minor at 120bpm" with minimal effort, staying in creative flow.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Storage & File Management

- [x] **STOR-01**: User can import audio files (WAV, FLAC, MP3) via atomic copy-first import with temp-then-rename for sync-folder safety
- [x] **STOR-02**: Application stores metadata in SQLite database located in ~/Library/Application Support/wallflower (never in sync folders)
- [x] **STOR-03**: Application watches a configurable folder (default ~/wallflower) for new audio files and auto-imports them
- [x] **STOR-04**: Application detects connected USB audio recorders (e.g., Zoom F3) and prompts to import new recordings
- [x] **STOR-05**: Application processes 32-bit float WAV files and can downsample to 24-bit for DAW compatibility
- [x] **STOR-06**: SQLite database is a single portable file that can be backed up by copying
- [x] **STOR-07**: File writes use atomic operations (temp-then-rename) to prevent corruption in Dropbox/iCloud sync folders

### Recording

- [ ] **REC-01**: User can record audio from any connected audio interface with 1-4 channel support (default stereo)
- [ ] **REC-02**: Recording writes incrementally to disk with periodic WAV header updates and fsync every 5-10 seconds to prevent data loss on crash
- [ ] **REC-03**: Recording gracefully recovers from audio interface dropout without corrupting the in-progress file
- [x] **REC-04**: User can configure a silence threshold; recording auto-pauses when audio falls below it
- [x] **REC-05**: User can edit metadata (tags, notes, collaborators) while recording is active, with live-save to database
- [x] **REC-06**: Recording status is clearly indicated at all times with prominent visual indicator
- [ ] **REC-07**: User is warned with a confirmation dialog before stopping an active recording
- [ ] **REC-08**: All AI/ML processing pauses while recording is active — recording always gets priority
- [ ] **REC-09**: Architecture supports expansion to 8 or 16 channels without significant refactoring

### AI Analysis

- [ ] **AI-01**: Application detects tempo (BPM) from recordings using local AI models
- [ ] **AI-02**: Application detects musical key and chord progressions from recordings
- [ ] **AI-03**: Application identifies structural sections and phrase boundaries in recordings
- [x] **AI-04
**: Application performs source separation (isolate drums, bass, vocals, synths) using demucs-mlx on Apple Silicon
- [ ] **AI-05**: Application identifies repeated sections/loops and detects when loops change substantially (e.g., parameter changes over same sequence)
- [x] **AI-06**: Analysis runs as a background pipeline — UI is fully usable before analysis completes, with results populating progressively via SSE
- [ ] **AI-07**: AI models are downloaded at runtime on first launch, cached in ~/Library/Application Support/wallflower/models, and reused across app updates unless model version changes
- [ ] **AI-08**: Model interface is abstracted so models can be swapped via configuration as new capabilities emerge
- [x] **AI-09**: Model downloads do not block any other application functionality — user can record and browse immediately
- [x] **AI-10
**: Demucs processes long recordings in chunks with overlap-add to stay within memory limits (~8GB target for 60-min files)

### Playback & Visualization

- [ ] **PLAY-01**: User can view waveforms for any recording, powered by pre-computed multi-resolution peaks served from the backend
- [ ] **PLAY-02**: User can scrub and seek to any position in recordings up to 120 minutes via HTTP Range requests without loading the full file
- [ ] **PLAY-03**: User can browse jam library in a chronological timeline view
- [x] **PLAY-04**: User can browse jam library in a spatial map/explorer view where jams cluster by musical similarity, temporal proximity, instrumentation, and collaborators
- [ ] **PLAY-05**: Playback and scrubbing are never interrupted by background processing

### Metadata & Organization

- [ ] **META-01**: User can add free-form tags and notes to jams and individual sections
- [ ] **META-02**: User can record collaborator information (who played in each jam)
- [ ] **META-03**: User can tag which instruments were used in a jam
- [ ] **META-04**: User can record location and time metadata for jams
- [ ] **META-05**: User can attach patch notes (text descriptions of synth/eurorack settings) to jams
- [ ] **META-06**: User can drag-and-drop photos (e.g., eurorack patch photos, sketches) into a jam's metadata
- [ ] **META-07**: Application watches a configurable patches folder (e.g., ~/wallflower/patches/) and auto-attaches new photos to the active or most recent jam
- [ ] **META-08**: User can search and filter jams by any metadata field (tags, key, tempo, collaborators, instruments, date, location)
- [ ] **META-09**: All metadata live-saves to prevent data loss

### Export & DAW Integration

- [x] **EXP-01**: User can bookmark sections of a recording for later extraction
- [x] **EXP-02
**: User can export bookmarked sections as audio files (time-sliced segments of the original)
- [x] **EXP-03
**: User can export bookmarked sections as source-separated stems (individual instruments)
- [x] **EXP-04
**: Exports are placed in a configurable folder that Ableton's browser can access
- [x] **EXP-05
**: Exported files are self-contained and shareable with collaborators
- [x] **EXP-06
**: 32-bit float recordings are downsampled to 24-bit on export for DAW compatibility

### Design & Accessibility

- [ ] **DES-01**: UI follows a playful, clean, "big" design language inspired by Mutable Instruments (generous whitespace, bold accent colors, rounded organic shapes) and Intellijel (structured logical sections)
- [x] **DES-02**: Full keyboard navigation for all application features
- [x] **DES-03**: ARIA labels and screen reader support throughout the application
- [ ] **DES-04**: High contrast mode and accessible color choices
- [ ] **DES-05**: Wireframes are generated and approved before implementation of each UI component
- [ ] **DES-06**: UI accepts photo sketches as design input that feed into the implementation approach

### Infrastructure

- [x] **INFRA-01**: Backend exposes a RESTful API for all functionality
- [x] **INFRA-02**: CLI tool provides access to all backend operations for debugging and scripting
- [x] **INFRA-03**: Comprehensive test coverage across backend (Rust), frontend (React), and ML sidecar (Python)
- [x] **INFRA-04**: README updated at end of every phase with current progress
- [x] **INFRA-05**: Release generated at end of each milestone
- [x] **INFRA-06**: agents.md maintained at repo top level capturing feedback and codified skills
- [x] **INFRA-07**: MIT license, all dependencies open source or creative commons (no GPL in core, LGPL acceptable)
- [x] **INFRA-08**: Documentation accessible for open source contributors
- [x] **INFRA-09**: Application is a native macOS app built with Tauri v2 — launches instantly, lives in dock
- [ ] **INFRA-10**: Application has a menubar/system tray icon showing recording status and quick actions
- [ ] **INFRA-11**: Application uses native macOS notifications for events (device connected, analysis complete, etc.)
- [ ] **INFRA-12**: Global keyboard shortcuts work even when the app is not focused (e.g., start/stop recording)
- [ ] **INFRA-13**: Application can be configured to auto-launch on login
- [x] **INFRA-14**: macOS app is properly signed and notarized for distribution

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### DAW Integration

- **DAW-01**: User can drag-and-drop sections directly from Wallflower into Ableton's clip view
- **DAW-02**: Export metadata in Ableton-compatible format (ALS markers, warp markers)

### Extended Recording

- **EREC-01**: Support for 8-channel recording
- **EREC-02**: Support for 16-channel recording

### Advanced Analysis

- **ADV-01**: AI-generated descriptive tags for sections (e.g., "driving bassline", "ambient pad wash")
- **ADV-02**: Cross-jam similarity detection (find similar moments across different recordings)
- **ADV-03**: Automatic loop point detection with DAW-compatible loop markers

### Platform

- **PLAT-01**: macOS Widgets (WidgetKit) showing recent jams, recording status
- **PLAT-02**: AirDrop integration for receiving patch photos directly into active jam

### Collaboration

- **COLLAB-01**: Share jam analysis and bookmarks with collaborators via exportable project files
- **COLLAB-02**: Collaborative annotation — multiple users can tag the same jam

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | macOS-first native desktop experience; mobile adds complexity without core value |
| Cloud sync of audio files | Local-first by design; sync handled by user's choice of Dropbox/iCloud for the data folder |
| Real-time collaboration | Single-user tool with sharing via export; realtime adds massive complexity |
| Multi-user accounts | Single-user local application |
| GPU-dependent ML models | Must run on M4 Mac Mini CPU/Neural Engine; no CUDA dependency |
| Commercial features | Open source, non-commercial, MIT licensed |
| MIDI recording/analysis | Audio-only tool; MIDI is a different domain |
| Video recording | Audio-focused; video adds storage and processing complexity |
| Streaming/online playback | Local files only |
| GPL-licensed core dependencies | License incompatibility with MIT |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 1 | Complete |
| STOR-03 | Phase 1 | Complete |
| STOR-04 | Phase 1 | Complete |
| STOR-05 | Phase 1 | Complete |
| STOR-06 | Phase 1 | Complete |
| STOR-07 | Phase 1 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| INFRA-08 | Phase 1 | Complete |
| INFRA-09 | Phase 1 | Complete |
| PLAY-01 | Phase 2 | Pending |
| PLAY-02 | Phase 2 | Pending |
| PLAY-03 | Phase 2 | Pending |
| PLAY-05 | Phase 2 | Pending |
| META-01 | Phase 2 | Pending |
| META-02 | Phase 2 | Pending |
| META-03 | Phase 2 | Pending |
| META-04 | Phase 2 | Pending |
| META-05 | Phase 2 | Pending |
| META-06 | Phase 2 | Pending |
| META-07 | Phase 2 | Pending |
| META-09 | Phase 2 | Pending |
| DES-01 | Phase 2 | Pending |
| DES-05 | Phase 2 | Pending |
| DES-06 | Phase 2 | Pending |
| INFRA-11 | Phase 2 | Pending |
| REC-01 | Phase 3 | Pending |
| REC-02 | Phase 3 | Pending |
| REC-03 | Phase 3 | Pending |
| REC-04 | Phase 3 | Complete |
| REC-05 | Phase 3 | Complete |
| REC-06 | Phase 3 | Complete |
| REC-07 | Phase 3 | Pending |
| REC-08 | Phase 3 | Pending |
| REC-09 | Phase 3 | Pending |
| INFRA-10 | Phase 3 | Pending |
| INFRA-12 | Phase 3 | Pending |
| AI-01 | Phase 4 | Pending |
| AI-02 | Phase 4 | Pending |
| AI-03 | Phase 4 | Pending |
| AI-05 | Phase 4 | Pending |
| AI-06 | Phase 4 | Complete |
| AI-07 | Phase 4 | Pending |
| AI-08 | Phase 4 | Pending |
| AI-09 | Phase 4 | Complete |
| META-08 | Phase 4 | Pending |
| AI-04 | Phase 5 | Complete |
| AI-10 | Phase 5 | Complete |
| EXP-01 | Phase 5 | Complete |
| EXP-02 | Phase 5 | Complete |
| EXP-03 | Phase 5 | Complete |
| EXP-04 | Phase 5 | Complete |
| EXP-05 | Phase 5 | Complete |
| EXP-06 | Phase 5 | Complete |
| PLAY-04 | Phase 6 | Complete |
| DES-02 | Phase 6 | Complete |
| DES-03 | Phase 6 | Complete |
| DES-04 | Phase 6 | Pending |
| INFRA-13 | Phase 6 | Pending |
| INFRA-14 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 66 total
- Mapped to phases: 66
- Unmapped: 0

---
*Requirements defined: 2026-04-18*
*Last updated: 2026-04-18 after roadmap revision (Tauri v2 architecture)*
