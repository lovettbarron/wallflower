# Phase 3: Recording Engine & System Integration - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can record multi-channel audio from any connected interface with crash safety, dropout recovery, live metadata editing during recording, menubar status with quick actions, and a global hotkey for hands-free recording control. Recording always takes priority over all background processing. This phase adds cpal-based audio capture, a priority scheduler, Tauri system tray integration, and global shortcut support to the existing Tauri v2 app.

</domain>

<decisions>
## Implementation Decisions

### Recording UX & Controls
- **D-01:** Recording controls extend the existing bottom transport bar (Phase 2 D-07). A record button is added; when recording, the bar transforms to show recording state (elapsed time, input levels, red accent, device info). One unified bar for both playback and recording.
- **D-02:** Audio device selection uses the system default input device automatically. The active device is shown in the transport bar. Users change device in Settings. No prompt before each recording.
- **D-03:** Silence detection marks silent sections visually in the waveform rather than pausing the recording. Avoids false pauses from quiet musical passages. Silence threshold is configurable in Settings.
- **D-04:** Playback is disabled while recording is active. Transport bar shows recording controls only. Prevents audio routing conflicts and keeps the recording engine as sole priority.

### Crash Safety & Dropout Recovery
- **D-05:** When a USB audio interface disconnects mid-recording, the recording session stays open and waits for reconnection. If the same device reconnects within a timeout, recording resumes into the same file with a gap marker. If timeout expires, the file is saved and closed.
- **D-06:** On app startup, any incomplete WAV files (missing final header) are automatically detected, repaired, and imported into the library. A toast notification informs the user: "Recovered recording from crash (duration)." No user action required.

### Claude's Discretion
- WAV write strategy (REC-02 specifies periodic header updates with fsync every 5-10 seconds)
- Dropout reconnection timeout duration
- Gap marker implementation in the WAV file (silence padding vs metadata marker)
- fsync frequency tuning based on performance testing

### Menubar & Global Hotkeys
- **D-07:** System tray icon shows recording state (idle vs recording icon). Clicking opens a menu with: current recording status and elapsed time, Start/Stop Recording action, Open Wallflower, Quit. Minimal and functional.
- **D-08:** One global hotkey for start/stop recording toggle (default: Cmd+Shift+R). This is the only global shortcut; all other shortcuts work only when the app is focused.
- **D-09:** The global hotkey is configurable in Settings. Important since musicians may have conflicting shortcuts in DAWs or other tools.

### Live Metadata & Recording Workflow
- **D-10:** When recording starts, a new jam is created in the database and the jam detail view opens automatically. The view shows a live-updating waveform with the full metadata editor below (tags, collaborators, instruments, notes, photos). Same layout as viewing any completed jam, but with a recording indicator and growing waveform.
- **D-11:** While recording, the user is locked to the recording jam's detail view. Cannot browse other jams or navigate away. Recording is the sole focus. Transport bar always shows recording status.
- **D-12:** Stop-recording confirmation uses a modal dialog: "Stop recording? (duration captured)" with Stop and Cancel buttons. Dark theme consistent with the rest of the app.

### Priority Scheduler
- **D-13:** All background processing (future ML analysis, any heavy tasks) pauses automatically when recording starts and resumes when recording stops (REC-08). Recording thread runs at elevated priority.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` — Full technology stack: cpal 0.17.x for audio I/O, hound 3.5.x for WAV writing, Tauri v2 for native app shell, technology rationale and alternatives analysis
- `.planning/PROJECT.md` — Project vision, constraints, recording priority requirement, target hardware (M4 Mac Mini, Zoom F3)
- `.planning/REQUIREMENTS.md` — REC-01 through REC-09, INFRA-10, INFRA-12 requirements for this phase

### Prior Phase Context
- `.planning/phases/01-tauri-app-shell-storage-api-foundation/01-CONTEXT.md` — Tauri IPC pattern (D-12), CLI structure (D-13/D-14), settings UI (D-07/D-08)
- `.planning/phases/02-playback-metadata-design-system-notifications/02-CONTEXT.md` — Transport bar (D-07), design system (D-01 through D-04), metadata editing (D-12 through D-16), notification pattern (D-17)

### Technology
- Tauri v2 system tray plugin — `tauri-plugin-global-shortcut` and system tray APIs
- cpal 0.17.x (crates.io/crates/cpal) — Audio I/O, CoreAudio backend on macOS, multi-channel capture
- hound 3.5.x (docs.rs/crate/hound) — WAV file writing with header updates

### Existing API Stubs
- Recording API stubs exist at `/api/recording/start`, `/stop`, `/status` — these need real implementations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Bottom transport bar component (Phase 2) — extend with recording controls
- Metadata editor components (Phase 2) — tags, collaborators, instruments, notes, photos — reuse in recording view
- Jam detail view layout (Phase 2) — recording view is the same layout with live waveform
- Tauri notification plugin already integrated — reuse for recording events
- zustand stores: `useLibraryStore`, `useTransportStore` — extend with recording state
- Device detection logic in `/crates/wallflower-core/src/watcher/` — extend for audio interface detection

### Established Patterns
- Tauri IPC commands for frontend-backend communication
- SQLite via rusqlite with WAL mode
- Atomic file operations (temp-then-rename) for sync-folder safety
- zustand for client state, @tanstack/react-query for server state
- Dark theme with Mutable Instruments design language (warm accents, rounded shapes)

### Integration Points
- cpal audio capture thread → WAV file writer (hound) → SQLite jam record
- Recording state changes → Tauri system tray icon updates
- Global shortcut events → recording start/stop commands
- Recording start → pause all background tasks (priority scheduler)
- Recording stop → finalize WAV, trigger auto-import into library, resume background tasks
- Live metadata edits → SQLite writes via existing Tauri commands (META-09 live-save pattern from Phase 2)

</code_context>

<specifics>
## Specific Ideas

- Transport bar transformation during recording should feel immediate and clear — the red accent and growing waveform make it obvious recording is happening at a glance
- The "locked to recording view" decision means the recording experience is focused and distraction-free — important for creative flow
- Silence markers in the waveform (not auto-pause) respects that quiet passages are still music
- Device reconnection with gap marker handles the common USB hub / cable jiggle scenario without losing a session
- Auto-recovery on crash means the musician never loses a recording — the worst case is a few seconds of missing audio at the end

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-recording-engine-system-integration*
*Context gathered: 2026-04-19*
