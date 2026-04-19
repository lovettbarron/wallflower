---
phase: 03-recording-engine-system-integration
plan: 03
subsystem: recording-ui
tags: [recording, zustand, transport, waveform, dialog, frontend]
dependency_graph:
  requires: [03-01]
  provides: [recording-store, recording-waveform, stop-dialog, transport-recording-mode]
  affects: [03-04, 03-05]
tech_stack:
  added: []
  patterns: [zustand-store, canvas-waveform, dialog-safe-default]
key_files:
  created:
    - src/lib/stores/recording.ts
    - src/components/recording/RecordingWaveform.tsx
    - src/components/recording/StopRecordingDialog.tsx
  modified:
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/components/transport/TransportBar.tsx
decisions:
  - "Keep Recording button auto-focused as safe default per D-12 design decision"
  - "Level history buffer limited to 600 values (~40s at 15fps) for waveform rendering"
  - "Used styled-jsx global for recording pulse animation to avoid external CSS dependency"
metrics:
  duration: 3min
  completed: 2026-04-19
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
---

# Phase 03 Plan 03: Recording Frontend UI Summary

Zustand recording store with full state management, transport bar dual-mode (playback/recording) transformation, canvas-based live waveform renderer, and safe-default stop confirmation dialog -- all matching the Phase 3 UI-SPEC design contract.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Recording store, Tauri wrappers, and types | 54b0d8d | Done |
| 2 | Transport bar recording mode, RecordingWaveform, StopRecordingDialog | abf9ed4 | Done |

## What Was Built

### Task 1: Recording Store, Tauri Wrappers, Types

- **Types** (`src/lib/types.ts`): Added `RecordingStatus`, `RecordingStartResult`, `RecordingStopResult`, `InputDeviceInfo`, `SilenceRegion`
- **Tauri wrappers** (`src/lib/tauri.ts`): Added `startRecording`, `stopRecording`, `getRecordingStatus`, `listAudioDevices`, `getRecordingLevel`
- **Recording store** (`src/lib/stores/recording.ts`): Zustand store with `isRecording`, `elapsedSeconds`, `rmsDb`, `deviceName`, `deviceDisconnected`, `silenceRegions`, `levelHistory`, `showStopDialog` state and `startRec`, `requestStop`, `cancelStop`, `confirmStop`, `setElapsed`, `setLevel`, `setDeviceDisconnected`, `addSilenceRegion`, `reset` actions

### Task 2: Transport Bar Recording Mode, RecordingWaveform, StopRecordingDialog

- **TransportBar** (`src/components/transport/TransportBar.tsx`):
  - Playback mode: existing controls + record button (36px circle, red border, filled circle icon)
  - Recording mode: 3px red left border, pulsing 8px red dot, "REC" label, elapsed time (tabular-nums), device name, 4px input level meter (gradient fill), Stop button
  - Device disconnect state: solid dot (no pulse), AlertTriangle icon, "Reconnect device" in destructive color, empty level meter
  - Only returns null when no jam loaded AND not recording
- **RecordingWaveform** (`src/components/recording/RecordingWaveform.tsx`): Canvas-based live waveform rendering from levelHistory, auto-scrolling, requestAnimationFrame-driven, "Preparing..." placeholder when empty
- **StopRecordingDialog** (`src/components/recording/StopRecordingDialog.tsx`): Dialog with human-readable duration ("X hours, Y minutes captured."), Keep Recording (auto-focused safe default per D-12) and Stop Recording (destructive) buttons

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components are fully wired to the recording store. The Tauri invoke wrappers call backend commands that are being built concurrently by plan 03-02; until those commands exist, the frontend will gracefully error on startRecording/stopRecording calls.

## Verification

- TypeScript compilation passes (only pre-existing error in JamDetail.tsx, out of scope)
- All acceptance criteria grep checks pass
- All UI-SPEC design contract elements present (colors, spacing, typography, interaction patterns)

## Self-Check: PASSED
