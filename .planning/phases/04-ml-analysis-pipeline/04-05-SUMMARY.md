---
phase: 04-ml-analysis-pipeline
plan: 05
subsystem: search-filter
tags: [search, filter, fts, sqlite, ui, zustand, tauri]
dependency_graph:
  requires: ["04-02", "04-04"]
  provides: ["search-jams-api", "filter-bar-ui", "filter-state-store"]
  affects: ["timeline-browser", "library-store"]
tech_stack:
  added: ["shadcn/slider", "shadcn/select", "shadcn/command", "shadcn/dropdown-menu"]
  patterns: ["dynamic-sql-query-builder", "zustand-filter-state", "multi-select-popover"]
key_files:
  created:
    - src/components/library/FilterBar.tsx
    - src/components/library/FilterChip.tsx
    - src/components/library/KeySelect.tsx
    - src/components/library/SearchInput.tsx
    - src/components/library/TempoRangeSlider.tsx
  modified:
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-app/src/commands/jams.rs
    - crates/wallflower-app/src/api/analysis.rs
    - crates/wallflower-app/src/api/mod.rs
    - crates/wallflower-app/src/lib.rs
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/lib/stores/library.ts
    - src/components/library/Timeline.tsx
decisions:
  - Used LIKE-based free-text search instead of FTS5 JOIN due to contentless table limitation
metrics:
  duration: 12min
  completed: 2026-04-20T05:35:00Z
---

# Phase 04 Plan 05: Search & Filter Summary

Search and filter across jam library with LIKE-based free-text, key multi-select, tempo range slider, tags/collaborators/instruments filtering, and removable filter chips. All filters combine with AND logic via dynamic SQL query builder.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Search and filter backend | 7b57498 | db/mod.rs, commands/jams.rs, api/analysis.rs, types.ts, tauri.ts |
| 2 | Frontend filter bar | 64fcba9 | FilterBar.tsx, SearchInput.tsx, KeySelect.tsx, TempoRangeSlider.tsx, FilterChip.tsx, library.ts, Timeline.tsx |

## What Was Built

### Backend (Task 1)
- `SearchFilter` struct with all filter fields (query, keys, tempo range, tags, collaborators, instruments, date range, location)
- `search_jams()` function building dynamic SQL with parameterized WHERE clauses and INNER JOINs
- `get_distinct_keys()` and `get_tempo_range()` helper methods for filter option population
- Tauri commands: `search_jams`, `get_filter_options`
- Axum API routes: `GET /api/jams/search`, `GET /api/jams/filter-options`
- TypeScript types: `SearchFilter`, `FilterOptions`
- Tauri invoke wrappers: `searchJams()`, `getFilterOptions()`
- 8 unit tests covering no-filter, tempo range, key, text query, and combined filter scenarios

### Frontend (Task 2)
- `useLibraryStore` extended with `filter`, `hasActiveFilters`, `setFilter`, `clearFilter`, `clearFilterField`
- `SearchInput`: 240px search box with magnifying glass icon, clear button, instant filtering
- `KeySelect`: Multi-select popover with checkboxes, Command search, loaded from filter options
- `TempoRangeSlider`: Dual-handle BPM slider in popover, range labels
- `FilterChip`: Accent-colored removable chips showing active filters
- `FilterBar`: Sticky horizontal bar composing all controls, with "More" dropdown for collaborators/instruments, chips row with results count
- `Timeline` updated to use `searchJams` when filters active, with filtered empty state
- Installed shadcn slider, select, command, dropdown-menu components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FTS5 contentless table cannot retrieve column values for JOIN**
- **Found during:** Task 1
- **Issue:** The FTS5 `jam_search` table uses `content=''` (contentless mode), which means column values including the UNINDEXED `jam_id` cannot be read back via SELECT or JOIN.
- **Fix:** Replaced FTS5 MATCH-based search with LIKE-based search across `jams.filename`, `jams.original_filename`, `jams.notes`, `jams.location` plus EXISTS subqueries for tags, collaborators, and instruments tables. For a single-user local app with hundreds of jams, LIKE queries are fast enough.
- **Files modified:** crates/wallflower-core/src/db/mod.rs
- **Commit:** 7b57498

**2. [Rule 3 - Blocking] base-ui PopoverTrigger does not support asChild prop**
- **Found during:** Task 2
- **Issue:** The shadcn components use `@base-ui/react` which does not have an `asChild` prop on `PopoverTrigger` (unlike Radix UI). TypeScript errors on all PopoverTrigger usages.
- **Fix:** Removed `asChild` and nested button elements, putting className/style directly on PopoverTrigger (which renders as a button by default in base-ui).
- **Files modified:** KeySelect.tsx, TempoRangeSlider.tsx, FilterBar.tsx
- **Commit:** 64fcba9

## Decisions Made

1. **LIKE-based search over FTS5 JOIN**: The FTS5 contentless table (`content=''`) stores no column values for retrieval. Since the app handles hundreds (not millions) of jams, LIKE queries across relevant columns with EXISTS subqueries for related tables provide equivalent functionality without the contentless limitation.

## Verification

- `cargo test -p wallflower-core search` -- 5/5 tests pass
- `cargo check -p wallflower-app` -- compiles cleanly
- `npx tsc --noEmit` -- zero type errors

## Known Stubs

None -- all components are wired to real data sources via Tauri commands.

## Self-Check: PASSED

All 12 created/modified files verified present. Both commit hashes (7b57498, 64fcba9) verified in git log.
