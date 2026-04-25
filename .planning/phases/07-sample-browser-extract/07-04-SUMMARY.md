---
phase: 07-sample-browser-extract
plan: 04
subsystem: frontend
tags: [preview-panel, waveform, export, keyboard-navigation, sample-browser]
dependency_graph:
  requires: [07-01, 07-02, 07-03]
  provides: [SamplePreviewPanel, keyboard-navigation, export-from-preview]
  affects: [SampleBrowser, transport-store]
tech_stack:
  added: []
  patterns: [slide-up-panel, constrained-playback, type-discriminated-export]
key_files:
  created:
    - src/components/explore/SamplePreviewPanel.tsx
  modified:
    - src/components/explore/SampleBrowser.tsx
decisions:
  - Used CSS max-height transition for slide-up animation (simpler than Sheet component, matches StemMixer visual weight)
  - Type-discriminated export: bookmarks use existing exportAudio/separateStems commands, sections/loops use new exportSampleAudio/separateSampleStems commands
  - Escape key listener on document level for closing preview panel
  - Cmd+F opens sidebar (if collapsed) and focuses search input
metrics:
  duration: 1min
  completed: 2026-04-25T12:14:04Z
---

# Phase 7 Plan 4: Sample Preview Panel Summary

Bottom preview panel with WaveformDetail, constrained playback via transport store activeLoop, type-discriminated export for audio and stems, and keyboard navigation

## What Was Done

### Task 1: SamplePreviewPanel with waveform, export, and navigation

Created `SamplePreviewPanel.tsx` -- a persistent bottom panel (220px) that slides up when a sample is selected. Three-section layout:

1. **Waveform area** (120px): Loads peaks via react-query, renders WaveformDetail with no bookmark/section/loop overlays. On sample change, calls `loadJam` and `setActiveLoop` to constrain playback to the sample's time range.

2. **Metadata row**: Sample name (semibold), key badge, BPM badge, duration (m:ss), TypeBadge.

3. **Action row** (right-aligned):
   - "Export Audio" (accent filled #E8863A): Calls `exportAudio` for bookmarks, `exportSampleAudio` for sections/loops. Toast with "Show in Finder" action.
   - "Export Stems" (ghost variant): Calls `separateStems` for bookmarks, `separateSampleStems` for sections/loops. Progress toast then success toast.
   - "Go to Jam" (ghost, accent text): Navigates to Library tab with source jam selected.

Updated `SampleBrowser.tsx`:
- Integrates SamplePreviewPanel below the table area
- Finds selected sample from fetched data by ID + type
- Table area shrinks with flex layout when preview visible
- Escape key handler closes preview panel
- Cmd+F focuses sidebar search input (expands sidebar if collapsed)
- aria-live region announces result count

**Commit:** 60e8d03

## Checkpoint: Human Verification Required

Task 2 is a `checkpoint:human-verify` task. The orchestrator should present the following verification steps to the user:

1. Launch the application: `cd /path/to/wallflower && cargo tauri dev`
2. Navigate to the **Explore** tab
3. **If bookmarks/analysis data exist:**
   - Verify the table shows bookmarks, sections, and loops with type badges
   - Click a column header (e.g., "BPM") -- verify sort order changes
   - Click a row's play button -- verify bottom preview panel slides up with waveform
   - Verify playback is constrained to the sample region
   - Click "Export Audio" -- verify toast notification with file path
   - Click source jam name -- verify navigation to Library tab
   - Toggle sidebar collapse/expand
   - Apply filters -- verify table updates
   - Press Escape -- verify preview panel closes
4. **If no data:** Verify empty state shows "No samples yet" with "Go to Library" button
5. Verify keyboard navigation: Arrow keys between rows, Enter selects, Space toggles play

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] src/components/explore/SamplePreviewPanel.tsx exists
- [x] src/components/explore/SampleBrowser.tsx exists
- [x] 07-04-SUMMARY.md exists
- [x] Commit 60e8d03 exists in git history
