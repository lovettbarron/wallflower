---
phase: 06-spatial-explorer-accessibility-distribution
plan: 01
subsystem: spatial-data-accessibility
tags: [spatial, accessibility, api, a11y]
dependency_graph:
  requires: [04-02, 05-01]
  provides: [spatial-data-api, accessibility-primitives]
  affects: [06-02, 06-03]
tech_stack:
  added: []
  patterns: [GROUP_CONCAT spatial query, roving tabindex, prefers-contrast media query]
key_files:
  created:
    - crates/wallflower-app/src/api/spatial.rs
    - crates/wallflower-app/src/commands/spatial.rs
    - src/components/accessibility/SkipLink.tsx
    - src/components/accessibility/HighContrastProvider.tsx
    - src/components/accessibility/useRovingTabIndex.ts
    - src/components/accessibility/index.ts
    - src/components/accessibility/__tests__/useRovingTabIndex.test.ts
  modified:
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-core/src/db/schema.rs
    - crates/wallflower-app/src/api/mod.rs
    - crates/wallflower-app/src/commands/mod.rs
    - crates/wallflower-app/src/lib.rs
    - src/lib/tauri.ts
    - src/lib/types.ts
    - src/app/globals.css
    - src/app/layout.tsx
decisions:
  - "GROUP_CONCAT with LEFT JOINs for single-query spatial data (avoids N+1)"
  - "useRovingTabIndex takes activeIndex + onChange callback (not internal state) for flexibility"
  - "HighContrastProvider wraps outside Providers to detect system preference before any rendering"
metrics:
  duration: 6min
  completed: "2026-04-24"
---

# Phase 06 Plan 01: Backend Spatial Data API & Accessibility Foundation Summary

Single-query spatial data endpoint using GROUP_CONCAT joins, plus three accessibility primitives (SkipLink, HighContrastProvider, useRovingTabIndex) and high contrast CSS overrides.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Spatial data query, API route, and Tauri command | 96df00b | schema.rs, db/mod.rs, api/spatial.rs, commands/spatial.rs, types.ts, tauri.ts |
| 2 | Accessibility foundation | 2d6f1e3 | SkipLink.tsx, HighContrastProvider.tsx, useRovingTabIndex.ts, globals.css, layout.tsx |

## What Was Built

### Spatial Data API
- `SpatialJam` struct in schema.rs combining jam record + tempo + key + tags + collaborators + instruments
- `list_jams_spatial()` in db/mod.rs: single SQL query using LEFT JOINs and GROUP_CONCAT(DISTINCT ...) to fetch all data in one round-trip
- `GET /api/jams/spatial` API route in api/spatial.rs
- `get_spatial_jams` Tauri command in commands/spatial.rs
- `SpatialJam` TypeScript interface and `getSpatialJams()` invoke wrapper
- Two unit tests: full metadata and empty metadata cases

### Accessibility Primitives
- **SkipLink**: Fixed position link, visually hidden until Tab focus, jumps to `#main-content`
- **HighContrastProvider**: React context detecting `prefers-contrast: more` media query, provides `useHighContrast()` hook
- **useRovingTabIndex**: Reusable hook for arrow key navigation in lists/groups with orientation filtering, wrap-around, Home/End support. Space/Enter not intercepted.
- **High contrast CSS**: `@media (prefers-contrast: more)` block in globals.css overriding border, foreground, muted, card, background, input tokens plus spatial map variables
- **Layout wiring**: SkipLink + HighContrastProvider integrated into app layout.tsx, `id="main-content"` on content wrapper

## Decisions Made

1. **GROUP_CONCAT approach**: Single query with LEFT JOINs and GROUP_CONCAT(DISTINCT ...) avoids N+1 queries for the spatial explorer. Comma-split parsing handles the GROUP_CONCAT output.
2. **useRovingTabIndex API**: Takes `activeIndex` + `onActiveIndexChange` callback rather than managing internal state, allowing parent components full control over focus behavior.
3. **HighContrastProvider placement**: Wraps outside `<Providers>` in layout.tsx so contrast detection is available before any styled content renders.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `cargo test -p wallflower-core spatial` -- 2 tests pass (list_jams_spatial, list_jams_spatial_empty_metadata)
- `npm run build` -- exits 0, all pages generate successfully
- All acceptance criteria met for both tasks

## Known Stubs

None -- all components are fully functional.
