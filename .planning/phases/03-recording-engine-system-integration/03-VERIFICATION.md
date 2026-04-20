---
phase: 03-recording-engine-system-integration
verified: 2026-04-20T07:30:00Z
status: human_needed
score: 19/19 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 18/19
  gaps_closed:
    - "Silence region overlays rendered on recording waveform (commit e065d6f)"
    - "Recording UI shows recording indication when started via tray or global shortcut (commit e119a31 plan, commit aee281d fix)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Start recording and let silence trigger (wait >1 second of near-silence), then observe waveform"
    expected: "Grey overlay bands appear on the live waveform canvas where silence was detected"
    why_human: "Requires running Tauri app with connected audio interface and visual waveform observation"
  - test: "Launch Tauri app; verify Wallflower icon appears in macOS menubar with correct menu items; press Cmd+Shift+R from another app"
    expected: "System tray icon visible; Start Recording / Open Wallflower / Quit Wallflower items present; Cmd+Shift+R starts recording with native notification and UI transitions to RecordingView"
    why_human: "Tray icon, global shortcuts, and native macOS notifications require a running Tauri app on macOS hardware"
  - test: "Kill the app during recording (kill -9), then relaunch"
    expected: "App startup recovers the orphaned WAV, inserts it into library with correct duration, and shows a Recording Recovered notification"
    why_human: "Crash recovery requires manual kill of the process and UI verification"
  - test: "Press Cmd+Shift+R to start, edit metadata during recording, press Cmd+Shift+R again, confirm Stop in dialog"
    expected: "Recording appears in library; navigation unlocks; app navigates to jam detail with duration and metadata intact"
    why_human: "End-to-end flow requires macOS hardware, audio interface, and visual confirmation"
---

# Phase 03: Recording Engine & System Integration — Verification Report

**Phase Goal:** Users can record audio from any connected interface with crash safety, dropout recovery, live metadata editing, menubar status, and global hotkeys for hands-free control

**Verified:** 2026-04-20T07:30:00Z
**Status:** human_needed (all automated checks pass; 4 items need UAT on macOS hardware)
**Re-verification:** Yes — after gap closure (previous status: gaps_found, previous score: 18/19)

---

## Re-verification Summary

| Gap | Previous Status | Current Status | Fix |
|-----|----------------|----------------|-----|
| Silence region overlays on recording waveform | FAILED | CLOSED | commit e065d6f — `RecordingWaveform.tsx` now reads `silenceRegions` from store and draws grey overlay bands |
| Recording UI shows no indication when recording starts via tray/shortcut | FAILED | CLOSED | commit e119a31 (plan 03-06) + commit aee281d — `tauri-event-listener.tsx` `recording-started` handler now directly sets `isRecording: true` in zustand; `recording-state-changed` handler also sets `isRecording: true` on `"recording"` state as fallback |

No regressions detected. Test count increased from 79 to 95 (all pass).

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | RecordingEngine starts/stops capture from system default audio input | VERIFIED | `recording/mod.rs` start() calls `device::get_default_cpal_device()`, builds cpal stream; stop() drops stream and finalizes writer |
| 2  | CrashSafeWriter flushes WAV headers every 5-10 seconds | VERIFIED | `writer.rs` flush loop wakes every 100ms, calls `w.flush()` + `libc::fsync(raw_fd)`; `test_intermediate_file_valid_after_flush` passes |
| 3  | Device disconnect detected via cpal error callback; reconnection via polling | VERIFIED | Error callback sends `RecordingEvent::DeviceError`; `handle_device_disconnect` polls `device::poll_for_device_reconnect` every 2s |
| 4  | Silence detection computes RMS and emits events when audio drops below threshold | VERIFIED | `silence.rs` SilenceDetector computes RMS, emits SilenceEvent::Start/End; 5 unit tests pass |
| 5  | PriorityScheduler provides AtomicBool flag that background tasks check before proceeding | VERIFIED | `scheduler.rs` wraps `Arc<AtomicBool>` with Release/Acquire ordering; `may_proceed()` returns `!is_recording()`; 4 unit tests pass |
| 6  | Recording supports 1-4 channels dynamically based on device config | VERIFIED | WavSpec channels taken from `supported_config.channels()`; `test_multichannel_write` validates 4-channel spec round-trips |
| 7  | Tauri commands start_recording/stop_recording invoke RecordingEngine | VERIFIED | `commands/recording.rs` full implementations; both registered in `invoke_handler` in `lib.rs` |
| 8  | get_recording_status returns current RecordingState and device info | VERIFIED | Returns `{ state, device_name, is_recording }` from `engine.status()` and `engine.device_name()` |
| 9  | System tray icon in macOS menubar with correct menu items | VERIFIED (code) | `tray.rs` builds TrayIconBuilder with "Start Recording", "Open Wallflower", "Quit Wallflower"; `setup_tray` called in `lib.rs` setup closure |
| 10 | Tray icon and menu text update dynamically when recording state changes | VERIFIED (code) | `update_tray_for_recording` rebuilds menu via `tray.set_menu()`; called from event bridge on StateChanged(Recording/Idle) |
| 11 | Global shortcut Cmd+Shift+R toggles recording when app is not focused | VERIFIED (code) | `lib.rs` registers `META+SHIFT+KeyR` with `on_shortcut`; capabilities include `global-shortcut:allow-register` |
| 12 | Recording state changes emit Tauri events the frontend listens to | VERIFIED | Event bridge emits: recording-started, recording-stopped, recording-level, recording-state-changed, recording-device-error, recording-device-reconnected, recording-silence-start/end |
| 13 | Crash recovery runs on startup, detecting and importing incomplete WAV files | VERIFIED | `recover_crashed_recordings` called before Tauri builder in `run()`; scans storage dir, reads WAV metadata, inserts unrecognized files into jams table |
| 14 | Transport bar shows record button in playback mode and transforms to recording layout when recording starts | VERIFIED | `TransportBar.tsx` branches on `isRecording`; idle mode shows Circle record button; recording mode shows REC label, elapsed, level meter, Stop button |
| 15 | StopRecordingDialog appears on stop attempt with Keep Recording (auto-focused) and Stop Recording buttons | VERIFIED | `StopRecordingDialog.tsx` uses shadcn Dialog; Keep Recording has `autoFocus`; Stop Recording calls `confirmStop()` |
| 16 | Recording store manages state: isRecording, elapsedTime, deviceName, rmsLevel, silenceRegions | VERIFIED | `src/lib/stores/recording.ts` full zustand store with all required fields and actions |
| 17 | When recording starts, app navigates to recording jam detail view | VERIFIED | `src/app/page.tsx` renders `<RecordingView />` when `isRecording` is true; `confirmStop` navigates to jam detail |
| 18 | Tauri recording events update recording store in real-time | VERIFIED | `tauri-event-listener.tsx` handles all 8 recording event types; `recording-started` sets full store state including `isRecording: true` |
| 19 | Silence regions rendered as overlays on recording waveform | VERIFIED | `RecordingWaveform.tsx` reads `silenceRegions` from store, draws `rgba(50,56,68,0.5)` filled rects in canvas draw loop (lines 79-90) |

**Score:** 19/19 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `crates/wallflower-core/src/recording/mod.rs` | RecordingEngine, RecordingEvent, RecordingState, RecordingConfig | VERIFIED | All four types present; start/stop/status/handle_device_disconnect/device_name implemented |
| `crates/wallflower-core/src/recording/writer.rs` | CrashSafeWriter with periodic flush and fsync | VERIFIED | flush_loop with 100ms polling, libc::fsync after flush; 4 tests pass |
| `crates/wallflower-core/src/recording/device.rs` | Device enumeration, default device selection, disconnect detection | VERIFIED | list_input_devices, get_default_input_device, get_default_cpal_device, poll_for_device_reconnect all present |
| `crates/wallflower-core/src/recording/silence.rs` | RMS-based silence detection | VERIFIED | SilenceDetector with dB-to-linear conversion, process_samples, SilenceEvent enum; 5 tests pass |
| `crates/wallflower-core/src/recording/scheduler.rs` | Priority scheduler with AtomicBool | VERIFIED | PriorityScheduler with Arc<AtomicBool>, Release/Acquire ordering; 4 tests pass |
| `migrations/V3__recording_tables.sql` | recording_gaps table | VERIFIED | CREATE TABLE IF NOT EXISTS recording_gaps with all required columns; index on jam_id |
| `crates/wallflower-app/src/commands/recording.rs` | 5 Tauri commands | VERIFIED | start_recording, stop_recording, get_recording_status, list_audio_devices, get_recording_level all implemented |
| `crates/wallflower-app/src/tray.rs` | System tray setup and state updates | VERIFIED | setup_tray with TrayIconBuilder; update_tray_for_recording with menu rebuild |
| `crates/wallflower-app/capabilities/default.json` | Global shortcut permissions | VERIFIED | global-shortcut:allow-register, allow-unregister, allow-is-registered, allow-register-all present |
| `src/lib/stores/recording.ts` | Zustand recording store | VERIFIED | All state fields and 8 actions; confirmStop navigates to jam detail after stop |
| `src/components/transport/TransportBar.tsx` | Dual-mode transport bar | VERIFIED | Recording mode with REC, elapsed, level meter, device name, Stop button; playback mode with record button |
| `src/components/recording/RecordingWaveform.tsx` | Live canvas waveform with silence overlays | VERIFIED | Canvas draws from levelHistory; silence overlays drawn via `fillRect` for each silence region |
| `src/components/recording/StopRecordingDialog.tsx` | Stop confirmation dialog | VERIFIED | Keep Recording (autoFocus), Stop Recording; human-readable duration; controlled by showStopDialog |
| `src/components/recording/RecordingView.tsx` | Locked recording view | VERIFIED | Disabled nav with tooltip, pulsing recording-dot, live waveform, MetadataEditor, StopRecordingDialog |
| `src/components/tauri-event-listener.tsx` | Extended event listener | VERIFIED | All 8 recording events handled; recording-started sets full isRecording:true state; recording-state-changed has fallback |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `recording/mod.rs` | `recording/writer.rs` | RecordingEngine owns CrashSafeWriter | WIRED | `writer: Arc<Mutex<Option<CrashSafeWriter>>>` in struct; new/write/finalize called in start/stop |
| `recording/mod.rs` | crossbeam-channel | Audio callback sends RecordingEvent via crossbeam Sender | WIRED | `event_tx: Sender<RecordingEvent>` in struct; try_send called in data_callback and error_callback |
| `commands/recording.rs` | `recording/mod.rs` | Tauri commands invoke RecordingEngine methods | WIRED | `engine.0.start()`, `engine.0.stop()`, `engine.0.status()`, `engine.0.device_name()` all called |
| `tray.rs` | `commands/recording.rs` | Tray menu events trigger recording start/stop | WIRED | `start_recording(handle, state).await` and `stop_recording(handle, state).await` called from tray event handler |
| `lib.rs` | `tray.rs` | Tray setup in Tauri Builder setup closure | WIRED | `tray::setup_tray(app)?` called in setup; `tray::update_tray_for_recording` called from event bridge |
| `tauri-event-listener.tsx` | `stores/recording.ts` | recording-started sets isRecording:true | WIRED | `useRecordingStore.setState({ isRecording: true, ... })` in recording-started handler (lines 229-239) |
| `tauri-event-listener.tsx` | `stores/recording.ts` | recording-state-changed fallback for isRecording | WIRED | `useRecordingStore.setState({ isRecording: true })` in state "recording" branch (lines 144-147) |
| `stores/recording.ts` | `lib/tauri.ts` | Tauri invoke calls for start/stop recording | WIRED | `startRecording()` and `stopRecording()` called in startRec and confirmStop actions |
| `app/page.tsx` | `RecordingView.tsx` | Conditional rendering when isRecording is true | WIRED | `if (isRecording) { return <RecordingView /> }` at line 23 |
| `stores/recording.ts` | `stores/library.ts` | Navigate to jam detail after stop | WIRED | `useLibraryStore.getState().setSelectedJam(jamId)` in confirmStop |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RecordingWaveform.tsx` | `levelHistory` | `useRecordingStore` -> `setLevel` in event-listener -> `recording-level` Tauri event -> cpal data_callback RMS | Yes — cpal data callback computes RMS from real audio samples | FLOWING |
| `RecordingWaveform.tsx` | `silenceRegions` | `useRecordingStore` -> `addSilenceRegion` in event-listener -> `recording-silence-start/end` Tauri events -> SilenceDetector | Yes — computed from real audio samples | FLOWING |
| `RecordingView.tsx` | `jam` | `useQuery` -> `getJamWithMetadata` -> Tauri `get_jam_with_metadata` -> SQLite query | Yes — DB query returns real jam record | FLOWING |
| `TransportBar.tsx` | `rmsDb` | `useRecordingStore` -> `setLevel` -> Tauri event bridge | Yes — from cpal audio callback | FLOWING |
| `StopRecordingDialog.tsx` | `elapsedSeconds` | `useRecordingStore` -> `setElapsed` -> `setInterval` in TauriEventListener | Yes — real wall-clock elapsed | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| wallflower-core tests pass | `~/.cargo/bin/cargo test -p wallflower-core --lib` | 95 passed; 0 failed (up from 79) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No output (zero errors) | PASS |
| Writer produces valid intermediate WAV | Unit test `test_intermediate_file_valid_after_flush` | PASS | PASS |
| Multichannel write 1-4 channels | Unit test `test_multichannel_write` | PASS | PASS |
| Scheduler blocks background tasks during recording | Unit test `test_set_recording_true_blocks_background` | PASS | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| REC-01 | 03-01 | Record from any connected audio interface with 1-4 channel support | SATISFIED | RecordingEngine uses default cpal device; WavSpec channels from device config; multichannel test passes |
| REC-02 | 03-01 | Incremental WAV writes with periodic header updates and fsync every 5-10 seconds | SATISFIED | CrashSafeWriter flush loop; fsync via libc; intermediate file test passes |
| REC-03 | 03-01 | Graceful recovery from audio interface dropout | SATISFIED | Error callback -> DeviceError event -> handle_device_disconnect -> poll_for_device_reconnect; gap marker on reconnect |
| REC-04 | 03-04, 03-05 | Configurable silence threshold with auto-pause | SATISFIED (partial) | SilenceDetector implemented and wired to RecordingEngine; overlays now rendered; UI settings configuration in plan 03-05 |
| REC-05 | 03-02, 03-03, 03-04 | Edit metadata while recording with live-save | SATISFIED | RecordingView includes MetadataEditor; jam data fetched with 5s refetch interval |
| REC-06 | 03-03, 03-06 | Clear recording status indicator at all times | SATISFIED | TransportBar recording mode (REC, pulsing dot, elapsed, level meter); UI transitions when started via tray/shortcut/button; Record button visible in library header |
| REC-07 | 03-03, 03-04 | Confirmation dialog before stopping | SATISFIED | StopRecordingDialog with Keep Recording (autoFocus) and Stop Recording; triggered by requestStop() from show-stop-dialog event or UI |
| REC-08 | 03-01 | All AI/ML processing pauses while recording | SATISFIED | PriorityScheduler.set_recording(true) in RecordingEngine.start(); may_proceed() returns false |
| REC-09 | 03-01 | Architecture supports 8-16 channel expansion | SATISFIED | WavSpec channels is u16 from device config; no hardcoded 4-channel limit; multichannel test validates pattern |
| INFRA-10 | 03-02 | Menubar/system tray icon with recording status | SATISFIED (code) | tray.rs with TrayIconBuilder; update_tray_for_recording updates menu dynamically; requires macOS UAT |
| INFRA-12 | 03-02 | Global keyboard shortcuts work when app not focused | SATISFIED (code) | tauri-plugin-global-shortcut with META+SHIFT+KeyR; capabilities include global-shortcut:allow-register; requires macOS UAT |

All 11 requirements addressed.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `crates/wallflower-app/src/api/mod.rs` | 44-46 | `not_implemented` handlers for /api/recording/start, /api/recording/stop, /api/recording/status | Info | HTTP API recording endpoints are stubs; Tauri IPC is the primary recording interface. Accepted deferral — no impact on goal. |

No blockers remain.

---

## Human Verification Required

### 1. Silence Region Overlays (Visual)

**Test:** Start recording with an audio source. Go silent for 1+ second. Observe the live waveform canvas.

**Expected:** Grey semi-transparent bands appear on the waveform where silence was detected, aligned with the recorded timeline.

**Why human:** Requires running Tauri app with connected audio interface and visual waveform observation.

### 2. System Tray and Global Shortcut

**Test:** Launch the Tauri app on macOS. Verify a Wallflower icon appears in the menubar. Click it and confirm "Start Recording", "Open Wallflower", "Quit Wallflower" are present. Switch to another app and press Cmd+Shift+R.

**Expected:** Tray icon appears with correct menu; Cmd+Shift+R globally triggers recording; native notification fires with device name; UI transitions to RecordingView; tray menu switches to "Recording -- 0:00" / "Stop Recording".

**Why human:** Tray icon rendering, global shortcut registration, and native notifications require a running Tauri app on macOS hardware.

### 3. Crash Recovery

**Test:** Start a recording, then force-kill the Tauri process (kill -9) before stopping. Relaunch the app.

**Expected:** App shows a "Recording Recovered" notification; the partial WAV appears in the library with correct duration read from the WAV header.

**Why human:** Requires process kill and UI observation of the recovered recording.

### 4. End-to-End Recording Workflow

**Test:** Start recording via Cmd+Shift+R with an audio interface connected. Edit tags and notes in the metadata editor while recording. Press Cmd+Shift+R again. Confirm "Stop Recording" in the dialog.

**Expected:** App navigates to jam detail after stop; recording appears in library with correct duration; metadata edits persist; navigation unlocks; tray reverts to idle state.

**Why human:** Requires real audio hardware, visual confirmation of each step, and end-to-end DB verification.

---

## Gaps Summary

No automation gaps remain. All 19 observable truths are verified in code. The two previously-failed items have been closed:

1. **Silence overlays (commit e065d6f):** `RecordingWaveform.tsx` now reads `silenceRegions` from the zustand store and draws grey overlay bands in the canvas draw loop, correctly clipped to the visible time window.

2. **Recording UI indication (commits e119a31 + aee281d):** `tauri-event-listener.tsx` now has a `recording-started` event handler that directly sets `isRecording: true` (and the full recording state) in the zustand store, regardless of whether recording was initiated from the UI button, system tray, or global shortcut. A fallback in the `recording-state-changed` handler also ensures `isRecording` is set to true if the `recording-started` event was missed. A Record button was also added to the library header (page.tsx) for UI-path discoverability.

The remaining items flagged for human verification are inherently untestable programmatically: they require a running Tauri app, macOS hardware, an audio interface, and visual confirmation.

---

_Verified: 2026-04-20T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
