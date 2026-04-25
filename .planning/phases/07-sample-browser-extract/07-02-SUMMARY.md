---
phase: 07-sample-browser-extract
plan: 02
subsystem: frontend
tags: [types, state-management, ipc, zustand]
dependency_graph:
  requires: []
  provides: [SampleRecord, SampleFilter, SampleFilterOptions, SortColumn, SampleType, useSampleBrowserStore, getAllSamples, getSampleFilterOptions, exportSampleAudio, separateSampleStems]
  affects: [src/lib/types.ts, src/lib/tauri.ts]
tech_stack:
  added: []
  patterns: [zustand-store, tauri-invoke]
key_files:
  created:
    - src/lib/stores/sample-browser.ts
  modified:
    - src/lib/types.ts
    - src/lib/tauri.ts
decisions:
  - SampleRecord uses unified model (bookmark/section/loop) with nullable fields for type-specific data
  - Store defaults to sortColumn=source, sortDirection=desc matching UI-SPEC
  - setSort toggles direction on same-column re-click, new columns default ascending except source
metrics:
  duration: 2m 1s
  completed: 2026-04-25T11:53:27Z
  tasks: 2
  files_changed: 3
---

# Phase 07 Plan 02: Sample Browser Types, IPC, and Store Summary

Frontend TypeScript types for unified sample model (bookmark/section/loop), Tauri IPC wrappers for 4 backend commands, and zustand store with filter/sort/selection state for Plans 03-04 consumption.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TypeScript types for sample browser | 923e46b | src/lib/types.ts |
| 2 | Tauri IPC wrappers and zustand store | 0207526 | src/lib/tauri.ts, src/lib/stores/sample-browser.ts |

## What Was Built

### Types (src/lib/types.ts)
- `SampleType` union: `'bookmark' | 'section' | 'loop'`
- `SortColumn` union: `'name' | 'type' | 'source' | 'key' | 'bpm' | 'duration'`
- `SampleRecord` interface: 15 fields covering unified sample data from any jam
- `SampleFilter` interface: query, types, keys, tempo/duration ranges, source jam, tags
- `SampleFilterOptions` interface: available values for filter dropdowns/sliders

### Tauri IPC (src/lib/tauri.ts)
- `getAllSamples(filter)` - fetches filtered samples across all jams
- `getSampleFilterOptions()` - fetches available filter option values
- `exportSampleAudio(jamId, start, end, name)` - exports audio by time range (no bookmark required)
- `separateSampleStems(jamId, start, end, name)` - stem separation by time range

### Zustand Store (src/lib/stores/sample-browser.ts)
- Filter state with `hasActiveFilters` computed flag
- Sort state defaulting to source/desc per UI-SPEC
- Selection state tracking both ID and sample type
- Actions: setFilter, clearFilter, toggleSidebar, setSidebarExpanded, setSort, selectSample, clearSelection
- setSort toggles direction on same-column re-click

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all types, IPC functions, and store actions are fully implemented. The IPC functions invoke backend commands that will be implemented by Plan 01 (backend). Until the backend commands exist, the frontend will get Tauri invoke errors at runtime, which is expected and handled by react-query error states in Plans 03-04.

## Self-Check: PASSED
