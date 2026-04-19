---
phase: 03-recording-engine-system-integration
verified: 2026-04-19T18:30:00Z
status: gaps_found
score: 18/19 must-haves verified
re_verification: false
gaps:
  - truth: "Silence region overlays on recording waveform (D-03)"
    status: resolved
    reason: "Fixed in commit e065d6f — RecordingWaveform now reads silenceRegions from store and draws grey bands"
  - truth: "Recording UI shows no visible indication when recording is active"
    status: failed
    reason: "User verified: system tray and global shortcut work, crash recovery saves WAV, but no recording indication appears in the UI. The RecordingView/TransportBar recording mode is not shown — likely isRecording in zustand store is never set to true when recording starts via Tauri."
    artifacts:
      - path: "src/lib/stores/recording.ts"
        issue: "startRec() sets isRecording:true but may not be called from tray/shortcut path"
      - path: "src/components/tauri-event-listener.tsx"
        issue: "recording-state-changed handler may not set isRecording:true on 'recording' state"
      - path: "src/app/page.tsx"
        issue: "Navigation lock depends on isRecording which appears never true in practice"
    missing:
      - "Investigate whether recording-state-changed Tauri event is emitted and received"
      - "Ensure isRecording is set to true in zustand when recording starts from any path (UI button, tray, global shortcut)"
      - "Verify TransportBar and page.tsx correctly read and react to isRecording state"
human_verification:
  - test: "Start recording and let silence trigger (wait >1 second of near-silence), then observe waveform"
    expected: "System tray icon appears in macOS menubar with correct menu items; Cmd+Shift+R toggles recording; notification fires when recording starts via hotkey"
    why_human: "Tray icon, global shortcuts, and native macOS notifications require a running Tauri app on macOS hardware"
  - test: "Kill the app during recording, then relaunch"
    expected: "App startup recovers the orphaned WAV, inserts it into the library with correct duration, and shows a 'Recording Recovered' notification"
    why_human: "Crash recovery requires manual kill of the process and verification in the UI"
  - test: "Full end-to-end: press Cmd+Shift+R to start, edit metadata during recording, press Cmd+Shift+R again, confirm Stop in dialog"
    expected: "Recording appears in library with duration and metadata intact; nav unlocks after stop"
    why_human: "End-to-end flow requires macOS hardware, audio interface, and visual confirmation of each step"
---

# Phase 03: Recording Engine & System Integration — Verification Report

**Phase Goal:** Users can record audio from any connected interface with crash safety, dropout recovery, live metadata editing, menubar status, and global hotkeys for hands-free control

**Verified:** 2026-04-19T18:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | RecordingEngine can start/stop capture from system default audio input device | VERIFIED | `recording/mod.rs` start() calls `device::get_default_cpal_device()`, builds cpal stream, plays it; stop() drops stream and finalizes writer |
| 2  | CrashSafeWriter flushes WAV headers every 5-10 seconds, producing a valid WAV at any interruption point | VERIFIED | `writer.rs` flush loop wakes every 100ms, calls `w.flush()` + `libc::fsync(raw_fd)` on configurable interval; test_intermediate_file_valid_after_flush passes |
| 3  | Device disconnect is detected via cpal error callback and device reconnection is detected via polling | VERIFIED | Error callback sends `RecordingEvent::DeviceError`; `handle_device_disconnect` spawns background thread calling `device::poll_for_device_reconnect` every 2s |
| 4  | Silence detection computes RMS and emits events when audio drops below configurable threshold | VERIFIED | `silence.rs` SilenceDetector computes RMS, emits SilenceEvent::Start/End; 5 unit tests pass |
| 5  | PriorityScheduler provides an AtomicBool flag that background tasks check before proceeding | VERIFIED | `scheduler.rs` wraps `Arc<AtomicBool>` with Release/Acquire ordering; `may_proceed()` returns `!is_recording()`; 4 unit tests pass |
| 6  | Recording supports 1-4 channels dynamically based on device config | VERIFIED | WavSpec channels taken from `supported_config.channels()`; test_multichannel_write validates 4-channel spec round-trips |
| 7  | Tauri commands start_recording and stop_recording invoke the RecordingEngine and return results to frontend | VERIFIED | `commands/recording.rs` has full implementations; both registered in invoke_handler in `lib.rs` |
| 8  | get_recording_status returns current RecordingState and device info for UI binding | VERIFIED | `get_recording_status` returns `{ state, device_name, is_recording }` from engine.status() and engine.device_name() |
| 9  | System tray icon is visible in macOS menubar with Start/Stop Recording and Open/Quit actions | VERIFIED (code) | `tray.rs` builds TrayIconBuilder with "Start Recording", "Open Wallflower", "Quit Wallflower" items; `setup_tray` called in lib.rs setup closure |
| 10 | Tray icon and menu text update dynamically when recording state changes (D-07) | VERIFIED (code) | `update_tray_for_recording` rebuilds menu via `tray.set_menu()`; called from event bridge on StateChanged(Recording/Idle) |
| 11 | Global shortcut Cmd+Shift+R toggles recording even when app is not focused (D-08) | VERIFIED (code) | `lib.rs` registers `Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyR)` with `on_shortcut`; handler starts recording or emits show-stop-dialog |
| 12 | Recording state changes emit Tauri events that the frontend can listen to | VERIFIED | Event bridge thread in `lib.rs` emits: recording-started, recording-stopped, recording-level, recording-state-changed, recording-device-error, recording-device-reconnected, recording-silence-start/end |
| 13 | Crash recovery runs on startup, detecting and importing incomplete WAV files (D-06) | VERIFIED | `recover_crashed_recordings` called before Tauri builder in `run()`; scans storage dir, reads WAV metadata, inserts unrecognized files into jams table |
| 14 | Transport bar shows record button in playback mode and transforms to recording layout when recording starts (D-01) | VERIFIED | `TransportBar.tsx` branches on `isRecording`; idle mode shows Circle record button; recording mode shows REC label, elapsed, level meter, Stop button |
| 15 | StopRecordingDialog appears on stop attempt with Keep Recording (auto-focused) and Stop Recording buttons (D-12) | VERIFIED | `StopRecordingDialog.tsx` uses shadcn Dialog with `open={showStopDialog}`; Keep Recording has `autoFocus`; Stop Recording calls `confirmStop()` |
| 16 | Recording store manages state: isRecording, elapsedTime, deviceName, rmsLevel, silenceRegions | VERIFIED | `src/lib/stores/recording.ts` implements full zustand store with all required fields and actions |
| 17 | When recording starts, app navigates to recording jam detail view automatically (D-10) | VERIFIED | `src/app/page.tsx` conditionally renders `<RecordingView />` when `isRecording` is true; RecordingView fetches jam data via react-query |
| 18 | Tauri recording events update the recording store in real-time (level, state, silence, device) | VERIFIED | `tauri-event-listener.tsx` handles all 8 recording event types; setLevel, setDeviceDisconnected, addSilenceRegion, requestStop, reset all wired |
| 19 | Silence regions are rendered as overlays on the recording waveform (D-03) | FAILED | silenceRegions collected in store (addSilenceRegion wired in event listener) but RecordingWaveform.tsx canvas draw function reads only `levelHistory`; no overlay rendering exists |

**Score:** 18/19 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `crates/wallflower-core/src/recording/mod.rs` | RecordingEngine, RecordingEvent, RecordingState, RecordingConfig | VERIFIED | All four types present; start/stop/status/handle_device_disconnect/device_name methods implemented |
| `crates/wallflower-core/src/recording/writer.rs` | CrashSafeWriter with periodic flush and fsync | VERIFIED | flush_loop uses 100ms polling, libc::fsync after flush; try_lock in write path; 4 tests pass |
| `crates/wallflower-core/src/recording/device.rs` | Device enumeration, default device selection, disconnect detection | VERIFIED | list_input_devices, get_default_input_device, get_default_cpal_device, poll_for_device_reconnect all present |
| `crates/wallflower-core/src/recording/silence.rs` | RMS-based silence detection | VERIFIED | SilenceDetector with dB-to-linear conversion, process_samples, SilenceEvent enum; 5 tests pass |
| `crates/wallflower-core/src/recording/scheduler.rs` | Priority scheduler with AtomicBool | VERIFIED | PriorityScheduler with Arc<AtomicBool>, Release/Acquire ordering, Clone shares atomic; 4 tests pass |
| `migrations/V3__recording_tables.sql` | recording_gaps table | VERIFIED | CREATE TABLE IF NOT EXISTS recording_gaps with all required columns; index on jam_id |
| `crates/wallflower-app/src/commands/recording.rs` | 5 Tauri commands | VERIFIED | start_recording, stop_recording, get_recording_status, list_audio_devices, get_recording_level all implemented |
| `crates/wallflower-app/src/tray.rs` | System tray setup and state updates | VERIFIED | setup_tray with TrayIconBuilder; update_tray_for_recording with menu rebuild |
| `crates/wallflower-app/capabilities/default.json` | Global shortcut permissions | VERIFIED | global-shortcut:allow-register, allow-unregister, allow-is-registered, allow-register-all present |
| `src/lib/stores/recording.ts` | Zustand recording store | VERIFIED | All state fields and 8 actions implemented; startRec calls Tauri, confirmStop calls Tauri |
| `src/components/transport/TransportBar.tsx` | Dual-mode transport bar | VERIFIED | Recording mode with REC, elapsed, level meter, device name, Stop button; playback mode with record button |
| `src/components/recording/RecordingWaveform.tsx` | Live canvas waveform | VERIFIED (partial) | Canvas draws from levelHistory with requestAnimationFrame; "Preparing..." placeholder; no silence overlay |
| `src/components/recording/StopRecordingDialog.tsx` | Stop confirmation dialog | VERIFIED | Keep Recording (autoFocus), Stop Recording buttons; human-readable duration; controlled by showStopDialog |
| `src/components/recording/RecordingView.tsx` | Locked recording view | VERIFIED | Disabled nav with tooltip, pulsing recording-dot, live waveform, MetadataEditor, StopRecordingDialog |
| `src/components/tauri-event-listener.tsx` | Extended event listener | VERIFIED | All 8 recording events handled; elapsed timer in separate useEffect; cleanup on unmount |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `recording/mod.rs` | `recording/writer.rs` | RecordingEngine owns CrashSafeWriter | WIRED | `writer: Arc<Mutex<Option<CrashSafeWriter>>>` in struct; new/write/finalize called in start/stop |
| `recording/mod.rs` | crossbeam-channel | Audio callback sends RecordingEvent via crossbeam Sender | WIRED | `event_tx: Sender<RecordingEvent>` in struct; try_send called in data_callback and error_callback |
| `commands/recording.rs` | `recording/mod.rs` | Tauri commands invoke RecordingEngine methods | WIRED | `engine.0.start()`, `engine.0.stop()`, `engine.0.status()`, `engine.0.device_name()` all called |
| `tray.rs` | `commands/recording.rs` | Tray menu events trigger recording start/stop | WIRED | `start_recording(handle, state).await` and `stop_recording(handle, state).await` called from tray event handler |
| `lib.rs` | `tray.rs` | Tray setup in Tauri Builder setup closure | WIRED | `tray::setup_tray(app)?` called in setup; `tray::update_tray_for_recording` called from event bridge |
| `tauri-event-listener.tsx` | `stores/recording.ts` | Tauri events update recording store | WIRED | setLevel, setDeviceDisconnected, addSilenceRegion, requestStop, reset all called from event handlers |
| `stores/recording.ts` | `lib/tauri.ts` | Tauri invoke calls for start/stop recording | WIRED | `startRecording()` and `stopRecording()` called in startRec and confirmStop actions |
| `app/page.tsx` | `RecordingView.tsx` | Conditional rendering when isRecording is true | WIRED | `if (isRecording) { return <RecordingView /> }` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RecordingWaveform.tsx` | `levelHistory` | `useRecordingStore((s) => s.levelHistory)` -> `setLevel` in event-listener -> `recording-level` Tauri event -> RecordingEngine `LevelUpdate` events from cpal data_callback | Yes — cpal data callback computes RMS from real audio samples | FLOWING |
| `RecordingView.tsx` | `jam` | `useQuery` -> `getJamWithMetadata` -> Tauri `get_jam_with_metadata` command -> SQLite query | Yes — DB query returns real jam record | FLOWING |
| `TransportBar.tsx` | `rmsDb` | `useRecordingStore` -> `setLevel` -> Tauri event bridge | Yes — from cpal audio callback | FLOWING |
| `StopRecordingDialog.tsx` | `elapsedSeconds` | `useRecordingStore` -> `setElapsed` -> `setInterval` in TauriEventListener | Yes — real wall-clock elapsed | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| wallflower-core tests pass (79 tests) | `~/.cargo/bin/cargo test -p wallflower-core --lib` | 79 passed; 0 failed | PASS |
| wallflower-app builds cleanly | `~/.cargo/bin/cargo build -p wallflower-app` | Finished dev profile; no errors | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No output (zero errors) | PASS |
| Writer produces valid intermediate WAV after flush | Unit test `test_intermediate_file_valid_after_flush` | PASS — hound reads 24000 samples after flush, 48000 after second flush | PASS |
| Multichannel write (1-4 channels, REC-09) | Unit test `test_multichannel_write` | PASS — 4-channel spec verified on readback | PASS |
| Scheduler blocks background tasks during recording | Unit test `test_set_recording_true_blocks_background` | PASS | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| REC-01 | 03-01 | Record from any connected audio interface with 1-4 channel support | SATISFIED | RecordingEngine.start() uses default cpal device; WavSpec channels from device config; multichannel test passes |
| REC-02 | 03-01 | Incremental WAV writes with periodic header updates and fsync every 5-10 seconds | SATISFIED | CrashSafeWriter flush loop at configurable interval; fsync via libc; intermediate file test passes |
| REC-03 | 03-01 | Graceful recovery from audio interface dropout | SATISFIED | Error callback -> DeviceError event -> handle_device_disconnect -> poll_for_device_reconnect; gap marker on reconnect |
| REC-04 | 03-04, 03-05 | Configurable silence threshold with auto-pause | SATISFIED (partial) | SilenceDetector implemented and wired to RecordingEngine; UI for configuring threshold deferred to 03-05 (not yet executed) |
| REC-05 | 03-02, 03-03, 03-04 | Edit metadata while recording with live-save | SATISFIED | RecordingView includes MetadataEditor; jam data fetched with 5s refetch interval; update commands from Phase 2 available |
| REC-06 | 03-03 | Clear recording status indicator at all times | SATISFIED | TransportBar shows pulsing red dot, REC label, elapsed time, level meter in recording mode |
| REC-07 | 03-03, 03-04 | Confirmation dialog before stopping | SATISFIED | StopRecordingDialog with Keep Recording (autoFocus safe default) and Stop Recording; triggered by requestStop() |
| REC-08 | 03-01 | All AI/ML processing pauses while recording | SATISFIED | PriorityScheduler.set_recording(true) called in RecordingEngine.start(); may_proceed() returns false |
| REC-09 | 03-01 | Architecture supports 8-16 channel expansion | SATISFIED | WavSpec channels is u16 from device config; no 4-channel hardcoded limit; multichannel test validates pattern |
| INFRA-10 | 03-02 | Menubar/system tray icon with recording status | SATISFIED (code) | tray.rs with TrayIconBuilder; update_tray_for_recording updates menu dynamically; requires macOS hardware for full UAT |
| INFRA-12 | 03-02 | Global keyboard shortcuts work when app not focused | SATISFIED (code) | tauri-plugin-global-shortcut with META+SHIFT+KeyR; capabilities include global-shortcut:allow-register; requires macOS UAT |

**All 11 requirements addressed. REC-04 UI configuration deferred to Plan 03-05 (autonomous: false, not yet executed).**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `crates/wallflower-app/src/api/mod.rs` | 44-46 | `not_implemented` handlers for /api/recording/start, /api/recording/stop, /api/recording/status | Info | HTTP API recording endpoints are stubs; Tauri IPC is the primary recording interface. Plan 03-02 explicitly accepted this deferral. No impact on goal. |
| `src/components/recording/RecordingWaveform.tsx` | (all) | silenceRegions not read or rendered | Blocker | Silence overlay visualization (D-03, plan 03-04 truth) is missing. Silence data is collected in the store but never displayed on the waveform canvas. |

---

## Human Verification Required

### 1. System Tray and Global Shortcut

**Test:** Launch the Tauri app on macOS. Verify a Wallflower icon appears in the menubar. Click it and confirm "Start Recording", "Open Wallflower", "Quit Wallflower" are present. Press Cmd+Shift+R from another application and verify recording starts with a native notification "Wallflower is now recording from {device}."

**Expected:** Tray icon appears; menu is correct; Cmd+Shift+R works globally; notification fires; tray menu switches to "Recording -- 0:00" / "Stop Recording" while active.

**Why human:** Tray icon rendering, global shortcut registration, and native notifications require a running Tauri app on macOS hardware and visual confirmation.

### 2. Crash Recovery

**Test:** Start a recording, then force-kill the Tauri process (kill -9) before stopping. Relaunch the app.

**Expected:** App shows a "Recording Recovered" notification; the partial WAV appears in the library with correct duration read from the WAV header.

**Why human:** Requires process kill and UI observation of the recovered recording.

### 3. End-to-End Recording Workflow

**Test:** Start recording via Cmd+Shift+R with an audio interface connected. Edit tags and notes in the metadata editor while recording. Press Cmd+Shift+R again. Confirm "Stop Recording" in the dialog.

**Expected:** Recording appears in library with correct duration; metadata edits persist; navigation unlocks after stop; tray reverts to idle state.

**Why human:** Requires real audio hardware, visual confirmation of each step, and end-to-end DB verification.

---

## Gaps Summary

One gap blocks complete goal achievement:

**Silence region overlays missing from waveform.** Plan 03-04 required silence regions to be rendered as visual overlays on the live recording waveform (D-03). The data pipeline is fully wired: cpal silence detector emits events -> RecordingEngine forwards them -> event bridge emits Tauri events -> tauri-event-listener.tsx converts sample offsets to seconds and calls `addSilenceRegion()` -> zustand store accumulates `silenceRegions`. However, the last step — reading `silenceRegions` from the store and drawing overlay bands on the RecordingWaveform canvas — was not implemented. The RecordingWaveform only reads `levelHistory`.

This is a display-only gap with no impact on recording functionality, data safety, or storage. All other phase goals are achieved.

---

_Verified: 2026-04-19T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
