---
phase: 03-recording-engine-system-integration
plan: 02
subsystem: recording, tauri, tray
tags: [tauri-commands, system-tray, global-shortcut, crash-recovery, event-bridge, cpal, crossbeam]

# Dependency graph
requires:
  - phase: 03-01
    provides: RecordingEngine, RecordingState, RecordingEvent, RecordingConfig, PriorityScheduler, device enumeration
provides:
  - Tauri IPC commands for recording control (start, stop, status, devices, levels)
  - System tray with recording state management
  - Global shortcut Cmd+Shift+R for recording toggle
  - Crash recovery for orphaned WAV files on startup
  - Recording event bridge (engine events -> Tauri events at ~15fps)
affects: [03-03, 03-04, frontend-recording-ui]

# Tech tracking
tech-stack:
  added: [tauri-plugin-global-shortcut, crossbeam-channel (app crate), hound (app crate), rusqlite (app crate)]
  patterns: [SendableRecordingEngine wrapper for cpal Send/Sync, event bridge thread with throttled emission, shared AtomicI32 for RMS metering]

key-files:
  created:
    - crates/wallflower-app/src/commands/recording.rs
    - crates/wallflower-app/src/tray.rs
  modified:
    - crates/wallflower-app/Cargo.toml
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-app/src/commands/mod.rs
    - crates/wallflower-app/capabilities/default.json

key-decisions:
  - "Wrapped RecordingEngine in SendableRecordingEngine with unsafe Send+Sync due to cpal::Stream not being Send"
  - "Event bridge thread owns the crossbeam Receiver; get_recording_level reads from shared AtomicI32 instead of draining channel"
  - "Tray menu rebuilt on state change via set_menu() since Tauri v2 doesn't support individual menu item toggling"
  - "Combined Tasks 1+2 into single compilation unit since tray module is required for event bridge compilation"

patterns-established:
  - "SendableRecordingEngine: wrapping non-Send types for Tauri managed state"
  - "Event bridge pattern: background thread consuming channel, forwarding as Tauri events with throttling"
  - "Crash recovery on startup: scanning storage dir for orphaned files"

requirements-completed: [REC-05, REC-06, REC-07, INFRA-10, INFRA-12]

# Metrics
duration: 11min
completed: 2026-04-19
---

# Phase 03 Plan 02: Tauri Recording Integration Summary

**Tauri IPC commands for recording control with system tray, Cmd+Shift+R global hotkey, crash recovery, and event bridge forwarding RecordingEvent to frontend at 15fps**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-19T16:10:26Z
- **Completed:** 2026-04-19T16:21:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Five Tauri commands (start_recording, stop_recording, get_recording_status, list_audio_devices, get_recording_level) wired to RecordingEngine core
- System tray icon with dynamic menu that switches between Start/Stop Recording based on engine state
- Global keyboard shortcut Cmd+Shift+R toggles recording from any app, with native notification feedback
- Crash recovery scans storage directory on startup for WAV files not in database, imports them automatically
- Recording event bridge thread consumes engine events and emits throttled Tauri events for frontend consumption

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Tauri recording commands, app state, event bridge, crash recovery, tray, global shortcut** - `9215672` (feat)
2. **Task 2: Global shortcut capabilities config** - `9d123a5` (chore)

## Files Created/Modified
- `crates/wallflower-app/src/commands/recording.rs` - Tauri commands for recording control, crash recovery function
- `crates/wallflower-app/src/tray.rs` - System tray setup, dynamic menu updates for recording state
- `crates/wallflower-app/src/lib.rs` - Extended AppState with RecordingEngine, event bridge, global shortcut, tray setup
- `crates/wallflower-app/src/commands/mod.rs` - Added recording module
- `crates/wallflower-app/Cargo.toml` - Added tray-icon, image-png features; global-shortcut, crossbeam-channel, uuid, hound, rusqlite deps
- `crates/wallflower-app/capabilities/default.json` - Added global-shortcut permissions

## Decisions Made
- Used `unsafe impl Send + Sync` wrapper for RecordingEngine because cpal::Stream deliberately opts out of Send/Sync, but our usage is synchronized through Mutex
- Event bridge thread owns the crossbeam channel receiver; level polling uses a shared AtomicI32 (rms_db * 100) instead of channel draining to avoid ownership issues
- Tray menu is rebuilt on state change using Menu::with_items + set_menu() because Tauri v2 tray API doesn't support individual menu item enable/disable
- Tasks 1 and 2 were combined into a single commit because the tray module is required at compile time by the event bridge in lib.rs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added SendableRecordingEngine wrapper for cpal Send/Sync**
- **Found during:** Task 1 (AppState compilation)
- **Issue:** cpal::Stream has `NotSendSyncAcrossAllPlatforms` marker, making RecordingEngine not Send+Sync, which Tauri's managed state requires
- **Fix:** Created SendableRecordingEngine wrapper with unsafe Send+Sync impl, since all access is through Mutex
- **Files modified:** crates/wallflower-app/src/lib.rs
- **Verification:** cargo build succeeds
- **Committed in:** 9215672

**2. [Rule 3 - Blocking] Added missing rusqlite dependency to wallflower-app**
- **Found during:** Task 1 (recording commands compilation)
- **Issue:** recording.rs uses rusqlite::params! macro directly for crash recovery
- **Fix:** Added rusqlite workspace dependency to wallflower-app Cargo.toml
- **Files modified:** crates/wallflower-app/Cargo.toml
- **Verification:** cargo build succeeds
- **Committed in:** 9215672

**3. [Rule 3 - Blocking] Restructured event channel ownership**
- **Found during:** Task 1 (event bridge + get_recording_level)
- **Issue:** crossbeam Receiver doesn't implement Clone, can't share between event bridge thread and AppState
- **Fix:** Event bridge thread owns the receiver; get_recording_level reads from shared AtomicI32 instead
- **Files modified:** crates/wallflower-app/src/lib.rs, crates/wallflower-app/src/commands/recording.rs
- **Verification:** cargo build succeeds
- **Committed in:** 9215672

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
- Fixed deprecated `menu_on_left_click` -> `show_menu_on_left_click` in Tauri tray API
- Added `tauri::Manager` import needed for `.state()` and `.get_webview_window()` methods

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Recording commands ready for frontend UI integration (Plan 03-03)
- Tauri events (recording-started, recording-stopped, recording-level, recording-state-changed) ready for React hooks
- System tray and global shortcut functional pending UAT
- API endpoints for recording still stubbed (low priority -- Tauri IPC is the primary interface)

---
*Phase: 03-recording-engine-system-integration*
*Completed: 2026-04-19*
