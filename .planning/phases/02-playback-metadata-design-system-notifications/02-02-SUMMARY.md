---
phase: 02-playback-metadata-design-system-notifications
plan: 02
subsystem: ui
tags: [zustand, wavesurfer.js, react-query, waveform, transport, timeline]

requires:
  - phase: 02-01
    provides: "SQLite V2 schema, peak generation, Tauri IPC commands, asset protocol"
provides:
  - "Timeline browser with date-grouped jam cards and mini-waveform thumbnails"
  - "Waveform overview + detail views using wavesurfer.js"
  - "Persistent transport bar with play/pause, skip, time display"
  - "Zustand stores for transport and library state"
  - "JamDetail component for drill-down jam viewing"
affects: [02-03, 02-04, 03, 04]

tech-stack:
  added: [zustand, "@tanstack/react-query", wavesurfer.js, "@wavesurfer/react"]
  patterns: [zustand-stores, react-query-data-fetching, canvas-waveform-rendering, state-based-view-switching]

key-files:
  created:
    - src/lib/stores/transport.ts
    - src/lib/stores/library.ts
    - src/lib/format.ts
    - src/components/library/Timeline.tsx
    - src/components/library/DateGroup.tsx
    - src/components/library/JamCard.tsx
    - src/components/library/JamDetail.tsx
    - src/components/waveform/WaveformOverview.tsx
    - src/components/waveform/WaveformDetail.tsx
    - src/components/transport/TransportBar.tsx
    - src/components/providers.tsx
  modified:
    - src/app/page.tsx
    - src/app/layout.tsx
    - src/lib/types.ts
    - src/lib/tauri.ts
    - package.json

key-decisions:
  - "State-based view switching instead of Next.js dynamic routes due to static export constraint"
  - "QueryClientProvider in separate client component wrapper for SSG compatibility"
  - "Dark theme forced via html class='dark' in layout"

patterns-established:
  - "Zustand store pattern: create() with typed interface, actions colocated"
  - "React Query pattern: useQuery with Tauri invoke wrappers, staleTime for peak data"
  - "Canvas waveform: devicePixelRatio scaling, resize listener, accent color #E8863A"
  - "View switching: library store selectedJamId controls timeline vs detail view"

requirements-completed: [PLAY-01, PLAY-02, PLAY-03, PLAY-05]

duration: 6min
completed: 2026-04-19
---

# Phase 2 Plan 02: Timeline Browser and Waveform Playback Summary

**Timeline browser with date-grouped jam cards, wavesurfer.js waveform viewer, and persistent transport bar with zustand state management**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-19T10:03:49Z
- **Completed:** 2026-04-19T10:10:07Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Timeline browser with date grouping (Today/Yesterday/weekday/week-of/month-year) and empty state
- Jam cards with mini-waveform canvas thumbnails, duration, and format badges
- Waveform overview (canvas) + detail view (wavesurfer.js) with seek, play/pause sync
- Persistent bottom transport bar with play/pause circle button, skip controls, jam name, time display
- Zustand transport store (playback state) and library store (navigation state)
- React Query integration with QueryClientProvider for data fetching

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand stores + Timeline browser with date-grouped jam cards** - `a85d1b0` (feat)
2. **Task 2: Waveform viewer + Transport bar + Jam detail view** - `256d99b` (feat)

## Files Created/Modified
- `src/lib/stores/transport.ts` - Zustand store for playback state (currentJamId, isPlaying, currentTime, duration)
- `src/lib/stores/library.ts` - Zustand store for library navigation (selectedJamId)
- `src/lib/format.ts` - Duration formatting utility (H:MM:SS)
- `src/components/library/Timeline.tsx` - Chronological jam list with date grouping and empty state
- `src/components/library/DateGroup.tsx` - Date group header component (uppercase, muted)
- `src/components/library/JamCard.tsx` - Jam card with mini-waveform canvas, duration badge, format badge
- `src/components/library/JamDetail.tsx` - Jam detail view with waveforms, transport sync, back nav
- `src/components/waveform/WaveformOverview.tsx` - Canvas overview waveform with seek and viewport highlight
- `src/components/waveform/WaveformDetail.tsx` - wavesurfer.js detail waveform with play/pause/seek sync
- `src/components/transport/TransportBar.tsx` - Fixed bottom transport bar with 44px accent play button
- `src/components/providers.tsx` - QueryClientProvider wrapper for react-query
- `src/app/page.tsx` - Updated with Timeline, Import Files button, state-based view switching
- `src/app/layout.tsx` - Updated with TransportBar, dark mode, Providers wrapper
- `src/lib/types.ts` - Added PeakData, JamTag, JamCollaborator types and JamRecord metadata fields
- `src/lib/tauri.ts` - Added getPeaks() invoke wrapper

## Decisions Made
- **State-based view switching:** Next.js `output: 'export'` requires `generateStaticParams` for dynamic routes. Since jam IDs are unknown at build time (Tauri app), switched from `/jam/[id]` route to state-based view switching using the library store's `selectedJamId`. This preserves the same UX while being compatible with static export.
- **Client QueryClientProvider wrapper:** React Query's provider must be a client component, but layout.tsx is a server component. Created a separate `Providers` wrapper component.
- **Dark mode by default:** Added `dark` class to html element and inline background/color styles for the Wallflower dark theme.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Static export incompatible with dynamic routes**
- **Found during:** Task 2 (Jam detail page)
- **Issue:** `output: 'export'` requires `generateStaticParams()` for all dynamic `[id]` routes. Jam IDs are dynamic runtime data in a Tauri app, so this route cannot be statically generated.
- **Fix:** Moved jam detail to a `JamDetail` component rendered conditionally in `page.tsx` based on `useLibraryStore().selectedJamId`. Same UX, compatible with static export.
- **Files modified:** src/components/library/JamDetail.tsx (created), src/app/page.tsx, src/components/library/Timeline.tsx
- **Verification:** `npm run build` succeeds
- **Committed in:** 256d99b (Task 2 commit)

**2. [Rule 2 - Missing Critical] Missing PeakData and metadata types**
- **Found during:** Task 1 (Zustand stores + Timeline)
- **Issue:** Plan interfaces reference PeakData, JamTag, JamCollaborator types and JamRecord metadata fields (location, notes, patchNotes, peaksGenerated) not present in existing types.ts
- **Fix:** Added missing types and fields to types.ts and getPeaks() to tauri.ts
- **Files modified:** src/lib/types.ts, src/lib/tauri.ts
- **Verification:** TypeScript compilation succeeds
- **Committed in:** a85d1b0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. View switching deviation preserves identical UX. No scope creep.

## Known Stubs
- `src/components/library/JamDetail.tsx:159` - "Metadata section coming in Plan 03" placeholder div (intentional, Plan 03 will implement metadata editor)

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timeline browser and waveform viewer fully functional for Plan 03 (metadata editor)
- Transport bar ready for audio playback once Tauri backend serves audio via asset protocol
- Zustand stores ready for extension by metadata editing components
- React Query infrastructure in place for all future data fetching

---
*Phase: 02-playback-metadata-design-system-notifications*
*Completed: 2026-04-19*

## Self-Check: PASSED
- All 11 created files verified present on disk
- Commits a85d1b0 and 256d99b verified in git log
- `npm run build` exits 0
