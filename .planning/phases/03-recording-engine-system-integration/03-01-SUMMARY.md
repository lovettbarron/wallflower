---
phase: 03-recording-engine-system-integration
plan: 01
subsystem: recording-engine
tags: [recording, cpal, crash-safety, audio-capture, priority-scheduler]
dependency_graph:
  requires: [wallflower-core, hound, rusqlite]
  provides: [RecordingEngine, CrashSafeWriter, PriorityScheduler, SilenceDetector, InputDeviceInfo]
  affects: [03-02 Tauri commands, 03-03 tray/hotkeys, 03-04 frontend recording UI]
tech_stack:
  added: [cpal 0.15, crossbeam-channel 0.5, libc 0.2]
  patterns: [crash-safe WAV writing with periodic flush+fsync, AtomicBool priority gating, RMS silence detection, cpal device polling for reconnection]
key_files:
  created:
    - crates/wallflower-core/src/recording/mod.rs
    - crates/wallflower-core/src/recording/writer.rs
    - crates/wallflower-core/src/recording/scheduler.rs
    - crates/wallflower-core/src/recording/silence.rs
    - crates/wallflower-core/src/recording/device.rs
    - migrations/V3__recording_tables.sql
  modified:
    - crates/wallflower-core/Cargo.toml
    - crates/wallflower-core/src/lib.rs
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-core/src/db/schema.rs
decisions:
  - "cpal 0.15 used (latest available on crates.io, CLAUDE.md specified 0.17 but that version does not exist)"
  - "Schema versioning via PRAGMA user_version added to support incremental migrations"
  - "Flush thread uses 100ms polling loop instead of single sleep for fast shutdown"
  - "try_lock used in audio callback write path -- drops samples rather than blocking real-time thread"
metrics:
  duration: ~5min
  completed: "2026-04-19T15:57:00Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 19
  tests_total: 50
  files_created: 6
  files_modified: 4
---

# Phase 3 Plan 01: Recording Engine Core Summary

Recording engine core with crash-safe WAV writing via periodic flush+fsync, cpal audio capture with multi-channel support, RMS silence detection, device disconnect/reconnect handling, and AtomicBool priority scheduler for pausing background processing during recording.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 941ee62 | Recording module structure, scheduler, silence detector, device enumeration, V3 migration |
| 2 | 1796dd5 | CrashSafeWriter and RecordingEngine with full audio capture |

## What Was Built

### Recording Module (`crates/wallflower-core/src/recording/`)

**mod.rs** - Core types and RecordingEngine:
- `RecordingState` enum: Idle, Recording, Paused, DeviceDisconnected, Error
- `RecordingEvent` enum: LevelUpdate, SilenceStart/End, DeviceError, DeviceReconnected, SamplesWritten, StateChanged
- `RecordingConfig`: sample_rate, channels, silence_threshold_db, flush_interval_secs, reconnect_timeout_secs
- `RecordingEngine`: start/stop/status/handle_device_disconnect, orchestrates cpal stream + writer + silence + scheduler

**writer.rs** - CrashSafeWriter:
- Wraps `hound::WavWriter<BufWriter<File>>` in `Arc<Mutex<Option<...>>>`
- Background flush thread updates WAV header every N seconds
- `libc::fsync()` after every flush to guarantee data on disk
- `try_lock()` in write path so audio callback never blocks
- `finalize()` writes final header, fsyncs, stops flush thread
- Intermediate files are always valid WAVs (crash safety)

**scheduler.rs** - PriorityScheduler:
- `Arc<AtomicBool>` with Release/Acquire ordering
- `set_recording(true)` makes `may_proceed()` return false
- Clone shares the same atomic flag across threads

**silence.rs** - SilenceDetector:
- dB threshold converted to linear RMS at construction
- Processes interleaved multi-channel buffers
- Emits SilenceEvent::Start/End on state transitions
- Minimum 1 second of silence before triggering

**device.rs** - Device enumeration:
- `list_input_devices()` / `get_default_input_device()` via cpal
- `poll_for_device_reconnect()` for dropout recovery
- Graceful fallback (empty vec) when no audio hardware available

### Database

- V3 migration: `recording_gaps` table with jam_id FK, gap_start/end_seconds, reason
- `RecordingGap` schema struct in db/schema.rs
- Schema versioning via `PRAGMA user_version` for incremental migration support

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Flush thread shutdown too slow**
- **Found during:** Task 2
- **Issue:** Flush thread slept for the full flush interval (60s in tests) before checking stop flag, causing tests to take 60+ seconds
- **Fix:** Changed to 100ms polling loop that checks stop_flag between sleep increments
- **Files modified:** crates/wallflower-core/src/recording/writer.rs
- **Commit:** 1796dd5

**2. [Rule 2 - Missing functionality] Schema version tracking**
- **Found during:** Task 1
- **Issue:** Existing DB initialization only checked if `jams` table exists, no version tracking for incremental migrations
- **Fix:** Added `PRAGMA user_version` tracking to support V3+ migrations cleanly
- **Files modified:** crates/wallflower-core/src/db/mod.rs
- **Commit:** 941ee62

**3. [Rule 3 - Blocking] cpal version mismatch**
- **Found during:** Task 1
- **Issue:** CLAUDE.md specifies cpal 0.17.x but that version does not exist on crates.io. Latest available is 0.15.x.
- **Fix:** Used cpal 0.15 (latest stable). All features needed (input capture, device enumeration, CoreAudio) are available.
- **Files modified:** crates/wallflower-core/Cargo.toml
- **Commit:** 941ee62

## Known Stubs

None. All components are fully functional with tests.

## Test Results

All 50 tests pass (19 new + 31 existing):
- 4 scheduler tests (state transitions, clone sharing)
- 5 silence tests (detection, transitions, edge cases)
- 3 device tests (enumeration, serialization)
- 3 recording engine tests (state, config, events)
- 4 writer tests (write+flush, finalize, multichannel, intermediate validity)

## Self-Check: PASSED

All 6 created files verified present. Both commit hashes (941ee62, 1796dd5) verified in git log.
