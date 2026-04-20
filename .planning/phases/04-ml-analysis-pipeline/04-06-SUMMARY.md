---
phase: 04-ml-analysis-pipeline
plan: 06
subsystem: frontend-analysis-ui
tags: [ui, analysis, waveform, settings, progressive-disclosure]
dependency_graph:
  requires: [04-03, 04-04]
  provides: [analysis-ui, section-markers, loop-brackets, model-management]
  affects: [jam-card, jam-detail, waveform, settings-page, tauri-events]
tech_stack:
  added: []
  patterns: [progressive-badge-loading, inline-manual-override, section-color-palette]
key_files:
  created:
    - src/components/analysis/AnalysisBadge.tsx
    - src/components/analysis/AnalysisStatus.tsx
    - src/components/analysis/AnalysisSummary.tsx
    - src/components/waveform/SectionMarkers.tsx
    - src/components/waveform/LoopBrackets.tsx
    - src/components/settings/ModelManagement.tsx
    - src/components/settings/AnalysisProfileSelector.tsx
    - src/app/settings/page.tsx
  modified:
    - src/components/library/JamCard.tsx
    - src/components/library/JamDetail.tsx
    - src/components/waveform/WaveformDetail.tsx
    - src/components/waveform/WaveformOverview.tsx
    - src/components/tauri-event-listener.tsx
    - src/components/settings/SettingsPage.tsx
    - src/app/page.tsx
decisions:
  - Essentia models shown as "Built-in" with "Ready" status since standard algorithms need no download
  - Analysis profile defaults to "Full" with auto-detection placeholder for hardware
  - Key/BPM badges use min-width 52px to prevent layout shift on jam cards
metrics:
  duration: 6min
  completed: 2026-04-20
---

# Phase 04 Plan 06: Analysis UI Summary

Progressive analysis UI with badges on jam cards, section markers and loop brackets on waveforms, analysis summary row with re-analyze and manual override, model management settings with profile selector

## What Was Built

### Analysis Badge Components
- **AnalysisBadge**: Compact badge with pending ("--"), loaded, and manual-override states. Fixed min-width prevents layout shift. Pencil icon for manual overrides, X to clear.
- **AnalysisStatus**: Two variants -- card (pulsing dot + "Analyzing...") and detail (step-by-step progress with check/spinner/dash icons for Tempo/Key/Sections/Loops).
- **AnalysisSummary**: Row of analysis badges (Key, BPM, Sections, Loops) with inline editing for key (select dropdown) and BPM (number input). Re-analyze ghost button with failed/analyzing states.

### Waveform Overlays
- **SectionMarkers**: Colored vertical lines (2px, 60% opacity) at section boundaries. Six-color palette matching UI-SPEC (Intro/Outro blue, Verse green, Chorus pink, Bridge gold, Loop purple, Unknown muted). Labels shown on WaveformDetail, hidden on WaveformOverview. Overlap prevention (40px minimum).
- **LoopBrackets**: Repeat-notation brackets above waveform with horizontal line, end ticks, and centered labels. Shows "Loop A x4" or "Loop A x4 (evolving)" for evolving loops. Labels hidden when bracket too narrow.
- **WaveformDetail**: Now overlays SectionMarkers (with labels), LoopBrackets, and a persistent Key/BPM badge in top-right corner.
- **WaveformOverview**: Now overlays SectionMarkers (without labels).

### Settings Page Additions
- **ModelManagement**: Shows installed models (Essentia Tempo/Key/Sections) as "Built-in" with "Ready" status. Scaffolded for future TempoCNN and demucs model downloads.
- **AnalysisProfileSelector**: Full/Standard/Lightweight dropdown with auto-detection message. Defaults to "Full" for the target M4 hardware.
- **SettingsPage**: Wired ML Analysis section containing both components.
- **Settings route**: `/settings` route page for direct navigation.

### Event Handling
- **TauriEventListener**: Added analysis-progress listener (invalidates react-query cache, shows completion/failure toasts) and sidecar-status listener (restart/failed/recovered toasts).
- **page.tsx**: Calls queuePendingAnalysis() on mount for automatic analysis of imported jams.
- **JamDetail**: Calls prioritizeAnalysis() on mount so currently-viewed jam jumps to front of queue (D-16).

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Essentia models as "Built-in"**: Since essentia standard algorithms are compiled in and need no separate downloads, the model management UI shows them as "Built-in" with "Ready" status rather than showing download sizes.
2. **Profile defaults to Full**: Auto-detection is a placeholder; defaults to "Full" since the target hardware (M4 Mac Mini) supports all analysis steps.
3. **Waveform jamId prop**: Added optional `jamId` prop to WaveformDetail and WaveformOverview to enable analysis result fetching within the waveform components.

## Known Stubs

- **AnalysisProfileSelector**: Profile selection does not persist to backend settings yet (TODO comment). The backend command for saving analysis profile is not yet implemented.
- **ModelManagement**: Static model list, not fetched from backend. Will be dynamic when TempoCNN/demucs model downloads are implemented in Phase 5.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | fe0c9b8 | Analysis badges, summary row, event listeners |
| 2 | c461a39 | Section markers, loop brackets, model management, settings wiring |

## Checkpoint

Task 3 is a human-verify checkpoint for full phase verification. Awaiting user approval before marking plan complete.
