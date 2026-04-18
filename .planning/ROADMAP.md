# Roadmap: Wallflower

## Overview

Wallflower delivers a local-first jam and sample manager as a native macOS app built with Tauri v2, in six phases. The Tauri shell is established in Phase 1 alongside storage and API foundations -- the Rust backend runs embedded in the Tauri process, and the React frontend renders in Tauri's WKWebView via static export. Each subsequent phase delivers a complete, verifiable capability. The build order follows component dependencies: storage underpins everything, playback verifies imported audio works, recording depends on the priority scheduler and adds menubar/hotkey integration, ML analysis validates the sidecar IPC pattern, source separation extends it to the heaviest workload, and the spatial explorer caps the experience with the signature differentiator plus distribution readiness.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Tauri App Shell, Storage & API Foundation** - Tauri v2 scaffolding, SQLite database, file import pipeline, API skeleton, CLI, and infrastructure practices
- [ ] **Phase 2: Playback, Metadata, Design System & Notifications** - Waveform visualization, audio streaming, timeline browser, metadata CRUD, design language, and native macOS notifications
- [ ] **Phase 3: Recording Engine & System Integration** - Multi-channel audio capture, crash safety, dropout recovery, live metadata, priority scheduler, menubar status, and global hotkeys
- [ ] **Phase 4: ML Analysis Pipeline** - Python sidecar, tempo/key/section detection, progressive results via SSE, model management, and search/filter
- [ ] **Phase 5: Source Separation & Export** - Demucs integration, bookmarking, stem export, DAW folder integration
- [ ] **Phase 6: Spatial Explorer, Accessibility & Distribution** - Spatial similarity map, keyboard navigation, screen reader support, accessibility, auto-launch, code signing

## Phase Details

### Phase 1: Tauri App Shell, Storage & API Foundation
**Goal**: Users can launch a native macOS app, import audio files into a safe, organized library, and interact with it via API and CLI
**Depends on**: Nothing (first phase)
**Requirements**: STOR-01, STOR-02, STOR-03, STOR-04, STOR-05, STOR-06, STOR-07, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09
**Success Criteria** (what must be TRUE):
  1. Application launches as a native macOS app from the dock with the Tauri v2 shell rendering a React frontend in the webview
  2. User can import a WAV, FLAC, or MP3 file and it appears in the library without modifying the original
  3. Application watches ~/wallflower for new audio files and auto-imports them
  4. Application detects a connected Zoom F3 (USB mass storage) and prompts to import new recordings
  5. SQLite database is stored in ~/Library/Application Support/wallflower, not in any sync folder, and can be backed up by copying the single file
  6. All API endpoints are accessible via CLI for debugging and scripting
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffolding: Tauri v2 + Cargo workspace + SQLite + Next.js + shadcn
- [ ] 01-02-PLAN.md -- Import pipeline, Tauri IPC commands, CLI subcommands, settings module
- [ ] 01-03-PLAN.md -- Folder watcher, device detection, documentation, release verification

### Phase 2: Playback, Metadata, Design System & Notifications
**Goal**: Users can see waveforms, play and scrub audio, browse their library chronologically, edit metadata, experience the Wallflower design language, and receive native macOS notifications for key events
**Depends on**: Phase 1
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-05, META-01, META-02, META-03, META-04, META-05, META-06, META-07, META-09, DES-01, DES-05, DES-06, INFRA-11
**Success Criteria** (what must be TRUE):
  1. User can view a waveform for any imported recording (including 120-minute files) without the app slowing down
  2. User can scrub and seek to any position in a recording without loading the full file
  3. User can browse jams in a chronological timeline and add tags, collaborators, instruments, location, and notes to any jam
  4. User can drag-and-drop photos (patch photos, sketches) into a jam's metadata
  5. All metadata changes save immediately without explicit save actions
  6. User receives native macOS notifications for key events (e.g., device connected, import complete)
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [ ] 02-01-PLAN.md -- Backend foundation: SQLite V2 migration, metadata CRUD, peak generation, photo storage, design tokens, Tauri commands
- [ ] 02-02-PLAN.md -- Timeline browser with date-grouped jam cards, waveform viewer, transport bar, audio playback
- [ ] 02-03-PLAN.md -- Metadata editor: tag/collaborator/instrument chips, text fields with live-save, photo gallery with drag-drop
- [ ] 02-04-PLAN.md -- Patches folder watcher, native notifications, full Phase 2 verification checkpoint

### Phase 3: Recording Engine & System Integration
**Goal**: Users can record audio from any connected interface with crash safety, dropout recovery, live metadata editing, menubar status, and global hotkeys for hands-free control
**Depends on**: Phase 2
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, REC-08, REC-09, INFRA-10, INFRA-12
**Success Criteria** (what must be TRUE):
  1. User can record stereo audio from any connected audio interface, and the recording is recoverable even if the application crashes mid-session
  2. User can unplug and reconnect a USB audio interface during recording without losing previously captured audio
  3. User can edit tags, notes, and collaborator info while recording is active, with changes saved immediately
  4. Recording status is visible in both the main window and the macOS menubar/system tray icon, with quick actions available from the tray
  5. All background processing pauses automatically when recording starts and resumes when recording stops
  6. User can start and stop recording via global keyboard shortcuts even when the app is not focused
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: ML Analysis Pipeline
**Goal**: Imported and recorded jams are automatically analyzed for tempo, key, sections, and loops, with results appearing progressively in the UI
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-05, AI-06, AI-07, AI-08, AI-09, META-08
**Success Criteria** (what must be TRUE):
  1. After importing or recording a jam, tempo, key, and section boundaries appear progressively in the UI without the user taking any action
  2. User can record and browse the library immediately on first launch while AI models download in the background
  3. User can search and filter jams by key, tempo, tags, collaborators, instruments, date, and location
  4. Swapping an AI model requires only a configuration change, not code changes
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Source Separation & Export
**Goal**: Users can isolate instruments from recordings, bookmark interesting sections, and export stems ready for use in Ableton
**Depends on**: Phase 4
**Requirements**: AI-04, AI-10, EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06
**Success Criteria** (what must be TRUE):
  1. User can bookmark a section of a recording and export it as a time-sliced audio file or as source-separated stems (drums, bass, vocals, other)
  2. Source separation completes on a 60-minute recording without exceeding 8 GB memory usage
  3. Exported files appear in a folder that Ableton's browser can access, and are self-contained for sharing with collaborators
  4. 32-bit float recordings are downsampled to 24-bit on export for DAW compatibility
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Spatial Explorer, Accessibility & Distribution
**Goal**: Users can browse their jam library through a spatial similarity map, the entire application is keyboard-navigable and accessible, and the app is distribution-ready with auto-launch and code signing
**Depends on**: Phase 5
**Requirements**: PLAY-04, DES-02, DES-03, DES-04, INFRA-13, INFRA-14
**Success Criteria** (what must be TRUE):
  1. User can browse jams in a spatial map where musically similar jams cluster together, with coloring by key, tempo, date, or instrumentation
  2. User can navigate every feature of the application using only the keyboard
  3. Screen readers can announce all interactive elements and application state
  4. High contrast mode is available with accessible color choices throughout
  5. Application can be configured to auto-launch on macOS login
  6. Application is properly signed and notarized for distribution to other macOS users
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tauri App Shell, Storage & API Foundation | 1/3 | In progress | - |
| 2. Playback, Metadata, Design System & Notifications | 0/4 | Not started | - |
| 3. Recording Engine & System Integration | 0/3 | Not started | - |
| 4. ML Analysis Pipeline | 0/3 | Not started | - |
| 5. Source Separation & Export | 0/3 | Not started | - |
| 6. Spatial Explorer, Accessibility & Distribution | 0/3 | Not started | - |
