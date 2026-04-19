---
phase: 03-recording-engine-system-integration
plan: 04
subsystem: recording-ui-wiring
tags: [recording, events, navigation-lock, tauri, frontend]
dependency_graph:
  requires: ["03-02", "03-03"]
  provides: ["recording-view", "event-wiring", "navigation-lock", "elapsed-timer"]
  affects: ["page.tsx", "tauri-event-listener", "JamDetail"]
tech_stack:
  added: []
  patterns: ["zustand-store-selectors", "tauri-event-listen", "conditional-rendering-lock"]
key_files:
  created:
    - src/components/recording/RecordingView.tsx
  modified:
    - src/app/page.tsx
    - src/app/globals.css
    - src/components/library/JamDetail.tsx
    - src/components/tauri-event-listener.tsx
decisions:
  - "Elapsed timer uses Date.now() delta rather than backend sync for simplicity"
  - "Silence regions stored by converting sample offsets to seconds at 48000 Hz default"
  - "Device disconnect toast uses Infinity duration (persistent) until reconnect dismisses it"
metrics:
  duration: "2m"
  completed: "2026-04-19"
---

# Phase 03 Plan 04: Recording UI Wiring Summary

RecordingView locked detail view with live waveform, metadata editor, elapsed timer, and full Tauri event wiring for recording lifecycle

## What Was Done

### Task 1: RecordingView component and navigation lock (20d6f4b)

Created `RecordingView.tsx` -- the locked recording experience that replaces normal app content during active recording:
- Disabled back navigation with tooltip explaining "Stop recording to return to library"
- Pulsing red dot indicator with CSS animation (`recording-pulse` keyframes in globals.css)
- Live waveform via `RecordingWaveform` component
- Elapsed time display (HH:MM:SS / MM:SS format)
- Device name and disconnect status display
- Full `MetadataEditor` for editing tags, collaborators, instruments, notes during recording
- `StopRecordingDialog` rendered but hidden until triggered
- Jam data fetched via react-query with 5-second refetch interval for live metadata sync

Modified `page.tsx` to implement navigation lock: when `isRecording` is true, renders `RecordingView` instead of normal content. Tab navigation is completely replaced.

Added recording guard to `JamDetail.tsx`: if the jam being viewed is the active recording, shows a redirect message instead of the normal detail view.

### Task 2: Tauri event listener extension and elapsed time timer (c3e47bf)

Extended `TauriEventListener` with comprehensive recording event handling:
- `recording-level`: Updates store with latest RMS dB for waveform rendering
- `recording-state-changed`: Handles state machine transitions (device_disconnected, recording, idle, error)
- `recording-device-error` / `recording-device-reconnected`: Backup handlers for device state
- `recording-silence-start` / `recording-silence-end`: Converts sample offsets to seconds and adds silence regions
- `show-stop-dialog`: Opens stop confirmation dialog and brings window to focus
- `recording-started`: Toast notification with device name (3s)
- `recording-stopped`: Toast notification with captured duration (4s)

Elapsed time timer runs as a separate `useEffect` that starts when `isRecording` becomes true, incrementing every second via `setElapsed`.

All event listeners properly cleaned up on unmount via cleanup function array pattern.

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Elapsed timer approach**: Uses `Date.now()` delta instead of backend-synced time. This is simpler and accurate enough for display purposes. Backend can provide authoritative duration on stop.
2. **Silence sample rate**: Uses 48000 Hz default for converting sample offsets to seconds. This matches the project's primary recording device (Zoom F3) default sample rate.
3. **Persistent disconnect toast**: Device disconnect uses `duration: Infinity` with a stable ID so it persists until explicitly dismissed on reconnect. This ensures the user sees the warning.

## Known Stubs

None -- all components are wired to real store actions and Tauri event sources.

## Self-Check: PASSED
