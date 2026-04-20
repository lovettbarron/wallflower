---
phase: 05-source-separation-export
plan: 04
subsystem: frontend-bookmarks
tags: [bookmarks, waveform, regions, zustand, ui-components]
dependency_graph:
  requires: ["05-01", "05-03"]
  provides: ["bookmark-store", "bookmark-ui", "waveform-regions"]
  affects: ["05-05"]
tech_stack:
  added: ["wavesurfer.js RegionsPlugin", "shadcn ContextMenu", "shadcn Sheet"]
  patterns: ["zustand CRUD store", "wavesurfer regions sync", "canvas bookmark indicators"]
key_files:
  created:
    - src/lib/stores/bookmarks.ts
    - src/components/bookmarks/BookmarkPopover.tsx
    - src/components/bookmarks/BookmarkList.tsx
    - src/components/bookmarks/BookmarkContextMenu.tsx
    - src/components/ui/context-menu.tsx
    - src/components/ui/sheet.tsx
  modified:
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/components/waveform/WaveformDetail.tsx
    - src/components/waveform/WaveformOverview.tsx
    - src/components/library/JamDetail.tsx
decisions:
  - Used base-ui ContextMenu (shadcn v4 pattern) for right-click bookmark menus
  - RegionsPlugin created as useMemo singleton, synced to bookmarks via useEffect
  - Snap-to-boundary uses 20px threshold converted to seconds via container width
key_decisions:
  - "RegionsPlugin drag-to-select creates temp region, snaps edges, opens popover for metadata entry"
  - "Bookmark indicators on WaveformOverview drawn directly on canvas for performance (no extra DOM)"
  - "Added bookmark types/tauri wrappers inline (Rule 3) since Plan 03 runs in parallel agent"
metrics:
  duration: 5min
  completed: "2026-04-20T11:23:28Z"
---

# Phase 05 Plan 04: Bookmark UI Components and Waveform Integration Summary

Frontend bookmark system with wavesurfer.js RegionsPlugin for drag-to-select creation, snap-to-boundary assist, popover for name/color/notes, list with context menu, and overview indicators.

## What Was Built

### Task 1: Bookmark Zustand Store and shadcn Installs
- **useBookmarkStore**: Zustand store with full CRUD (loadBookmarks, addBookmark, editBookmark, removeBookmark), selection state, auto color cycling through 8 colors, auto naming ("Bookmark N")
- **shadcn components**: Installed ContextMenu and Sheet components via shadcn CLI
- **Types**: Added BookmarkRecord, CreateBookmarkInput, UpdateBookmarkInput, BookmarkColor, BOOKMARK_COLORS, StemInfo to types.ts
- **Tauri wrappers**: Added createBookmark, getBookmarks, updateBookmark, deleteBookmark, exportAudio, separateStems to tauri.ts

### Task 2: Bookmark UI Components and Waveform Integration
- **BookmarkPopover**: 280px popover with name input (auto-focus, select-all), 8-color circular swatch palette, notes textarea, save/discard buttons. Supports create and edit modes.
- **BookmarkList**: Heading with count badge, empty state with instructions, bookmark rows with color dot, name (truncated 200px), time range (M:SS-M:SS), context menu trigger. Click scrolls waveform to bookmark.
- **BookmarkContextMenu**: Right-click menu with Export audio, Export stems, Edit bookmark, Delete bookmark (with confirmation dialog).
- **WaveformDetail**: RegionsPlugin with dragSelection enabled, region-created handler extracts range and opens popover, region sync adds/removes bookmark regions by ID, snap-to-boundary checks section/loop edges within 20px threshold, region click/double-click for select/edit.
- **WaveformOverview**: Canvas-drawn bookmark indicators -- thin 2px lines for narrow bookmarks, filled regions with borders for wider spans (>4px at overview scale).
- **JamDetail**: Loads bookmarks on jamId change, BookmarkList placed between waveform and MetadataEditor, handlers for create/edit/update/select/export/delete with toast notifications.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added bookmark types and Tauri wrappers inline**
- **Found during:** Task 1
- **Issue:** Plan 03 (which adds BookmarkRecord types and tauri.ts bookmark functions) runs in a parallel agent and hasn't been applied to this worktree
- **Fix:** Added all required types (BookmarkRecord, CreateBookmarkInput, UpdateBookmarkInput, BookmarkColor, BOOKMARK_COLORS, StemInfo) to types.ts and all bookmark/export invoke wrappers to tauri.ts
- **Files modified:** src/lib/types.ts, src/lib/tauri.ts
- **Commit:** a88f941

**2. [Rule 3 - Blocking] SectionMarkers and LoopBrackets components not yet available**
- **Found during:** Task 2
- **Issue:** These overlay components referenced in the plan don't exist yet (from Plan 03)
- **Fix:** WaveformDetail accepts sections/loops props for snap calculations but doesn't render separate marker components. The snap-to-boundary logic works with the data arrays directly.
- **Files modified:** src/components/waveform/WaveformDetail.tsx

## Decisions Made

1. **RegionsPlugin as useMemo singleton**: Created once and passed to useWavesurfer plugins array, stored in ref for imperative access
2. **Canvas-based overview indicators**: Drew bookmark indicators directly on the WaveformOverview canvas rather than DOM overlays, avoiding extra elements in the animation frame loop
3. **Inline type additions**: Added bookmark types to types.ts since the parallel Plan 03 agent hasn't committed yet -- these will merge cleanly as they're additive

## Known Stubs

None -- all bookmark CRUD operations are fully wired to Tauri invoke calls. Export audio and stem separation call real Tauri commands (backend implementation is in Plan 01/02).

## Self-Check: PASSED
