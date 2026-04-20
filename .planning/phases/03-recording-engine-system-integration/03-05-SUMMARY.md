---
phase: 03-recording-engine-system-integration
plan: 05
subsystem: ui
tags: [settings, recording, tauri, zustand, react]

requires:
  - phase: 03-04
    provides: Recording UI integration (RecordingView, transport bar, event listener)
provides:
  - Recording settings page (silence threshold slider, hotkey display)
  - Record button on library header
  - Editable jam title on detail page
  - Navigate to jam detail after stopping recording
  - content_hash unique constraint fix for repeated recordings
affects: [04-ml-analysis-pipeline]

tech-stack:
  added: []
  patterns:
    - "Editable title pattern: inline input with debounced save via updateJamMetadata"
    - "Cross-store navigation: recording store sets library store selectedJamId on stop"

key-files:
  created:
    - src/components/settings/SettingsPage.tsx
  modified:
    - src/app/page.tsx
    - src/components/library/JamDetail.tsx
    - src/lib/stores/recording.ts
    - src/lib/tauri.ts
    - crates/wallflower-app/src/commands/recording.rs
    - crates/wallflower-app/src/commands/metadata.rs
    - crates/wallflower-core/src/db/schema.rs
    - crates/wallflower-core/src/db/mod.rs

key-decisions:
  - "Record button placed in library header next to Import Files — recording is a top-level action"
  - "Title editing via inline input with debounced save, not a modal"
  - "Stop recording navigates to jam detail via cross-store state (recording → library)"
  - "content_hash placeholder uses recording-{jamId} instead of empty string to avoid UNIQUE constraint"

patterns-established:
  - "Cross-store navigation: zustand stores can reference each other via static getState()"
  - "original_filename field in JamMetadata for title editing without renaming files"

requirements-completed: [REC-04, REC-09, INFRA-10, INFRA-12]

duration: 45min
completed: 2026-04-20
---

# Plan 05: Recording Settings + UAT Verification Summary

**Recording settings UI with silence threshold and hotkey display, plus UAT-driven fixes: library record button, editable title, post-recording detail navigation, and content_hash constraint fix**

## Performance

- **Duration:** ~45 min (including UAT iterations)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 10

## Accomplishments
- Settings page with Recording section: silence threshold slider (-60dB to -20dB) and hotkey display (Cmd+Shift+R)
- Record button added to library header for one-click recording start
- Editable jam title on detail page with debounced auto-save
- Stop recording navigates to the jam's detail page instead of returning to library
- Fixed content_hash UNIQUE constraint error on repeated recordings

## Task Commits

1. **Task 1: Add recording settings to Settings page** - `537614b` (feat)
2. **Task 2: Full Phase 3 recording workflow verification** - Human-verify checkpoint, approved after UAT fixes

**UAT fixes:** `aee281d` (fix: record button, content_hash, editable title, stop-to-detail nav)

## Files Created/Modified
- `src/components/settings/SettingsPage.tsx` - New settings page with recording section
- `src/app/page.tsx` - Record button in library header
- `src/components/library/JamDetail.tsx` - Editable title input
- `src/lib/stores/recording.ts` - Navigate to detail after stop
- `src/lib/tauri.ts` - originalFilename param in updateJamMetadata
- `crates/wallflower-app/src/commands/recording.rs` - content_hash placeholder fix
- `crates/wallflower-app/src/commands/metadata.rs` - original_filename param
- `crates/wallflower-core/src/db/schema.rs` - original_filename in JamMetadata
- `crates/wallflower-core/src/db/mod.rs` - original_filename update SQL

## Decisions Made
- Record button in library header (not transport bar) — recording is a top-level action accessible without loading a jam
- Title editing saves original_filename, not filename — file renaming deferred to future phase
- content_hash uses `recording-{jamId}` placeholder per recording instead of empty string

## Deviations from Plan

### Auto-fixed Issues

**1. Missing record button on library view**
- **Found during:** UAT verification
- **Issue:** Record button only existed in transport bar, which is hidden when no jam is loaded
- **Fix:** Added red Record button to library header
- **Files modified:** src/app/page.tsx

**2. content_hash UNIQUE constraint on repeated recordings**
- **Found during:** UAT verification (clicking record a second time)
- **Issue:** Empty string placeholder violates UNIQUE constraint on second recording
- **Fix:** Use `recording-{jamId}` as unique placeholder
- **Files modified:** crates/wallflower-app/src/commands/recording.rs

**3. Recording stops returning to library instead of jam detail**
- **Found during:** UAT verification
- **Issue:** confirmStop resets all state including navigation
- **Fix:** Capture jamId before reset, set as selectedJamId in library store
- **Files modified:** src/lib/stores/recording.ts

**4. Jam title not editable**
- **Found during:** UAT verification (user request)
- **Issue:** Title was a static h1 element
- **Fix:** Added original_filename to JamMetadata through full stack, replaced h1 with editable input
- **Files modified:** 6 files across Rust and TypeScript

---

**Total deviations:** 4 auto-fixed (UAT findings)
**Impact on plan:** All fixes necessary for usable recording workflow. No scope creep.

## Issues Encountered
None beyond the UAT findings above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 recording engine complete with all settings and UX polish
- Ready for Phase 4 ML analysis pipeline

---
*Phase: 03-recording-engine-system-integration*
*Completed: 2026-04-20*
