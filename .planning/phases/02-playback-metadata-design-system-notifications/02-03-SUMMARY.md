---
phase: 02-playback-metadata-design-system-notifications
plan: 03
subsystem: ui
tags: [react, metadata, tanstack-query, tauri, drag-drop, autocomplete]

requires:
  - phase: 02-01
    provides: "SQLite metadata tables, Tauri IPC commands for metadata CRUD"
provides:
  - "MetadataEditor composite component with tags, collaborators, gear, location, notes, patch notes"
  - "TagChip reusable chip UI component"
  - "AutocompletePopover for suggestion-based entry"
  - "PhotoGallery with Tauri drag-drop attachment"
  - "Jam detail page at /jam?id=xxx"
  - "QueryClientProvider and Toaster in app layout"
affects: [02-02-waveform, 03-recording, 04-analysis]

tech-stack:
  added: ["@tanstack/react-query"]
  patterns: ["useMutation with query invalidation", "debounced auto-save", "Tauri onDragDropEvent", "search-param routing for static export"]

key-files:
  created:
    - src/components/metadata/TagChip.tsx
    - src/components/metadata/AutocompletePopover.tsx
    - src/components/metadata/MetadataEditor.tsx
    - src/components/metadata/PhotoGallery.tsx
    - src/components/providers.tsx
    - src/app/jam/page.tsx
    - src/app/jam/client.tsx
  modified:
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/app/layout.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/scroll-area.tsx
    - src/components/ui/tooltip.tsx

key-decisions:
  - "Used search-param routing (/jam?id=xxx) instead of dynamic routes (/jam/[id]) for Next.js static export compatibility"
  - "Added metadata types and Tauri invoke wrappers directly since plan 02-01 runs in parallel"
  - "Installed @tanstack/react-query and added QueryClientProvider to layout"

patterns-established:
  - "Debounced auto-save: save on blur OR 1s inactivity with 'Saved' indicator that fades after 2s"
  - "Chip section pattern: TagChip + AutocompletePopover + add button, reused for tags/collaborators/gear"
  - "Tauri drag-drop: dynamic import of @tauri-apps/api/webview for SSR safety"
  - "Search-param routing: server page with Suspense wrapping client component using useSearchParams"

requirements-completed: [META-01, META-02, META-03, META-04, META-05, META-06, META-07, META-09, DES-01]

duration: 7min
completed: 2026-04-19
---

# Phase 02 Plan 03: Metadata Editing UI Summary

**Chip-based tag/collaborator/gear editor with autocomplete, debounced text field auto-save, and Tauri drag-drop photo gallery -- all wired via react-query mutations**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-19T10:04:04Z
- **Completed:** 2026-04-19T10:10:38Z
- **Tasks:** 2/2
- **Files modified:** 17

## Accomplishments

### Task 1: TagChip + AutocompletePopover + MetadataEditor composite
- **TagChip**: 24px height chip with hover-reveal X button, keyboard delete, collaborator @ prefix, focus ring
- **AutocompletePopover**: Filterable dropdown with keyboard navigation (ArrowUp/Down/Enter/Escape), "Press Enter to add" option for new values
- **MetadataEditor**: Composite component with 7 sections:
  - Tags (chip + autocomplete)
  - Collaborators (chip + autocomplete with @ prefix)
  - Gear (chip + autocomplete)
  - Location (Input with debounced save)
  - Recorded date (display only, formatted)
  - Notes (Textarea with debounced save)
  - Patch Notes (Textarea with debounced save)
- All mutations via useMutation with query invalidation
- "Saved" indicator with 2s fade-out
- Error handling via sonner toast

### Task 2: PhotoGallery + jam detail page
- **PhotoGallery**: 3-column grid, drag-drop via Tauri onDragDropEvent, remove confirmation dialog, toast notifications, file path deduplication
- **Jam detail page**: Back nav, waveform placeholders, separator, MetadataEditor, PhotoGallery
- Dynamic import of Tauri webview API for SSR safety

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added metadata types and Tauri invoke wrappers**
- **Found during:** Task 1
- **Issue:** Plan 02-01 (which provides metadata types in types.ts and Tauri invoke wrappers in tauri.ts) runs in parallel, so these interfaces were not yet available
- **Fix:** Added JamDetail, JamTag, JamCollaborator, JamInstrument, JamPhoto interfaces to types.ts and all metadata functions to tauri.ts directly
- **Files modified:** src/lib/types.ts, src/lib/tauri.ts
- **Commit:** e9d8f4b

**2. [Rule 3 - Blocking] Installed @tanstack/react-query**
- **Found during:** Task 1
- **Issue:** react-query was specified in tech stack but not yet installed
- **Fix:** npm install @tanstack/react-query, added QueryClientProvider in src/components/providers.tsx
- **Files modified:** package.json, package-lock.json, src/components/providers.tsx, src/app/layout.tsx
- **Commit:** e9d8f4b

**3. [Rule 1 - Bug] Changed from dynamic route to search-param routing**
- **Found during:** Task 2
- **Issue:** Next.js static export (`output: 'export'`) does not support dynamic routes without pre-generated params; `/jam/[id]` fails to build
- **Fix:** Changed to `/jam?id=xxx` pattern with Suspense-wrapped client component using useSearchParams
- **Files modified:** src/app/jam/page.tsx, src/app/jam/client.tsx
- **Commit:** f13e442

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | e9d8f4b | feat(02-03): TagChip, AutocompletePopover, MetadataEditor with live-save |
| 2 | f13e442 | feat(02-03): PhotoGallery with drag-drop and jam detail page |

## Known Stubs

- **Waveform placeholders**: Two `<div>` elements in jam detail page (48px overview, 200px detail) serve as placeholders for WaveformOverview and WaveformDetail components, which will be built in plan 02-02. These are intentional -- the plan specifies waveform components are out of scope for this plan.
- **Photo src in SSR**: `getPhotoSrc` in PhotoGallery uses a try/catch dynamic require for `convertFileSrc` from `@tauri-apps/api/core`. This works at runtime in Tauri but returns raw file paths during SSR/build. This is intentional for build compatibility.

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (e9d8f4b, f13e442) verified in git history.
