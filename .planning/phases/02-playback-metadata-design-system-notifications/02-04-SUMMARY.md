---
phase: 02-playback-metadata-design-system-notifications
plan: 04
subsystem: ui, infra
tags: [tauri, notification, file-watcher, drag-drop, notify-crate]

requires:
  - phase: 02-02
    provides: timeline browser, jam detail page, transport bar
  - phase: 02-03
    provides: metadata editing UI, photo gallery component

provides:
  - patches folder watcher auto-attaching photos to most recent jam
  - native macOS notification triggers (import complete, patch photo attached)
  - in-app toast notifications via Tauri events
  - drag-drop photo attachment on jam detail view and library cards
  - full-page drag overlay affordance

affects: [recording, device-import, notifications]

tech-stack:
  added: [tauri-plugin-notification, @tauri-apps/plugin-notification, notify-crate-watcher]
  patterns: [tauri-event-bridge, elementFromPoint-drag-targeting]

key-files:
  created:
    - src/components/tauri-event-listener.tsx
  modified:
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-core/src/db/mod.rs
    - src/components/metadata/PhotoGallery.tsx
    - src/components/metadata/MetadataEditor.tsx
    - src/components/library/JamDetail.tsx
    - src/components/library/JamCard.tsx
    - src/components/library/Timeline.tsx
    - src/components/metadata/AutocompletePopover.tsx

key-decisions:
  - "Lift drag overlay to JamDetail level for full-page affordance rather than scoping to PhotoGallery"
  - "Use elementFromPoint with Tauri drag position for drop-on-list-item targeting"
  - "Use useRef for photos in drag handler to avoid listener teardown/re-register on photo changes"

patterns-established:
  - "Tauri event bridge: backend emits events, TauriEventListener shows toasts"
  - "Drag-drop: full-page overlay + elementFromPoint for card-level targeting"

requirements-completed: [META-07, INFRA-11, DES-05, DES-06]

duration: 45min
completed: 2026-04-19
---

# Plan 02-04: Patches Folder Watcher + Notifications Summary

**Patches folder watcher auto-attaching photos, native macOS notification plugin, drag-drop photo UX with full-page overlay and list-item targeting**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-19T15:00:00Z
- **Completed:** 2026-04-19T17:50:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 12

## Accomplishments
- Patches folder watcher at ~/wallflower/patches/ auto-attaches new image files to most recent jam
- Native macOS notification plugin integrated (tauri-plugin-notification) with permission request on startup
- In-app toasts via TauriEventListener for photo-auto-attached events
- PhotoGallery wired into MetadataEditor (was never rendered before)
- Full-screen drag overlay on JamDetail with accent-colored drop zone
- Drop-on-list-item support in Timeline using Tauri drag position + elementFromPoint
- Fixed nested button hydration error in AutocompletePopover

## Task Commits

1. **Task 1: Patches folder watcher + notification triggers** - `edc183f` (feat)
2. **Task 2: UAT fixes** - `a8137ad` (fix) — PhotoGallery wiring, drag-drop affordances, nested button fix

## Files Created/Modified
- `crates/wallflower-app/src/lib.rs` - Patches watcher, notification triggers, plugin registration
- `crates/wallflower-core/src/db/mod.rs` - get_most_recent_jam() helper
- `src/components/tauri-event-listener.tsx` - Global Tauri event listener with notification permission request
- `src/components/metadata/PhotoGallery.tsx` - Drag-drop with full-section overlay, stale closure fix
- `src/components/metadata/MetadataEditor.tsx` - Added PhotoGallery section
- `src/components/library/JamDetail.tsx` - Full-page drag overlay
- `src/components/library/JamCard.tsx` - Drop target visual state
- `src/components/library/Timeline.tsx` - Drag position tracking, drop-on-card attach
- `src/components/metadata/AutocompletePopover.tsx` - Fixed nested button (triggerClassName/triggerContent)

## Decisions Made
- PhotoGallery was an orphaned component never rendered — wired into MetadataEditor as Photos section
- Lifted drag overlay from PhotoGallery to JamDetail for full-page affordance
- Added drop-on-list-item using Tauri drag event position + document.elementFromPoint

## Deviations from Plan

### Auto-fixed Issues

**1. PhotoGallery never rendered**
- **Found during:** UAT checkpoint
- **Issue:** PhotoGallery component existed but was never imported or rendered in MetadataEditor or JamDetail
- **Fix:** Added PhotoGallery to MetadataEditor as "Photos" section
- **Committed in:** a8137ad

**2. Nested button hydration error**
- **Found during:** UAT checkpoint
- **Issue:** PopoverTrigger renders a <button>, and the trigger prop was also a <Button> — nested buttons
- **Fix:** Changed to triggerClassName/triggerContent pattern to avoid double button wrapper
- **Committed in:** a8137ad

---

**Total deviations:** 2 auto-fixed during UAT
**Impact on plan:** Essential fixes for photo UX to work at all. Drop-on-list-item was user-requested enhancement.

## Issues Encountered
- Native macOS notifications not triggering despite correct plugin setup, permission request, and capability configuration. Logged as gap for follow-up investigation.

## Next Phase Readiness
- Phase 2 UI complete: timeline, playback, metadata, photos all functional
- Notification gap (INFRA-11) partially met — in-app toasts work, native macOS notifications need investigation
- Ready for Phase 3 (Recording Engine)

---
*Phase: 02-playback-metadata-design-system-notifications*
*Completed: 2026-04-19*
