---
phase: 01-tauri-app-shell-storage-api-foundation
plan: 01
subsystem: infra
tags: [tauri, rust, nextjs, sqlite, cargo-workspace, shadcn, typescript]

requires: []
provides:
  - Cargo workspace with wallflower-core, wallflower-app, wallflower-cli crates
  - Tauri v2 app binary with WKWebView configuration
  - Next.js static export frontend with shadcn UI components
  - SQLite database module with WAL mode and CRUD operations
  - TypeScript types and typed Tauri IPC invoke wrappers
  - MIT license
affects: [01-02, 01-03, 02, 03, 04, 05, 06]

tech-stack:
  added: [tauri 2.10, rusqlite 0.39, clap 4, next 16, react 19, tailwindcss 4, shadcn, zustand, tanstack-query, sonner, typescript 6]
  patterns: [cargo-workspace-shared-core, tauri-ipc-commands, nextjs-static-export, sqlite-wal-mode, manual-sql-migrations]

key-files:
  created:
    - Cargo.toml
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-core/src/db/schema.rs
    - crates/wallflower-core/src/error.rs
    - crates/wallflower-app/tauri.conf.json
    - crates/wallflower-cli/src/main.rs
    - migrations/V1__initial_schema.sql
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/app/layout.tsx
    - src/app/page.tsx
  modified: []

key-decisions:
  - "Dropped refinery for manual migrations due to rusqlite 0.39 incompatibility"
  - "Using rusqlite 0.39 (latest) instead of downgrading to 0.37 for refinery compat"
  - "Removed app.title from tauri.conf.json as Tauri 2.10 doesn't support it"

patterns-established:
  - "Cargo workspace: core library + app binary + cli binary sharing wallflower-core"
  - "Database: include_str! for SQL migrations, manual version check on tables"
  - "Tauri IPC: camelCase serde serialization with #[serde(rename_all = camelCase)]"
  - "Frontend: Next.js static export with output: export for Tauri frontendDist"

requirements-completed: [INFRA-09, INFRA-07, STOR-02, STOR-06]

duration: 9min
completed: 2026-04-18
---

# Phase 1 Plan 01: Project Scaffolding Summary

**Tauri v2 + Cargo workspace with SQLite WAL-mode database, Next.js static export, shadcn components, and typed IPC contract**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-18T22:04:14Z
- **Completed:** 2026-04-18T22:13:30Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments
- Cargo workspace compiles all three crates (core, app, cli) without errors
- SQLite database module with WAL mode, 7 passing CRUD tests, and initial schema
- Next.js frontend builds to static export with shadcn UI components (button, table, tabs, dialog, input, label, progress, card, badge, separator, sonner)
- TypeScript types mirror Rust structs with full Tauri invoke wrapper contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Tauri v2 + Cargo workspace + Next.js frontend** - `6b3e7dd` (feat)
2. **Task 2: SQLite schema, migrations, and database module** - `387aaf8` (feat)
3. **Task 3: TypeScript types and typed Tauri invoke wrappers** - `a47cb51` (feat)

## Files Created/Modified
- `Cargo.toml` - Workspace root with three crate members
- `crates/wallflower-core/Cargo.toml` - Core library dependencies (rusqlite, sha2, symphonia, etc.)
- `crates/wallflower-core/src/lib.rs` - Module declarations (db, error)
- `crates/wallflower-core/src/error.rs` - WallflowerError enum with thiserror
- `crates/wallflower-core/src/db/mod.rs` - Database struct, WAL mode init, CRUD functions, 7 tests
- `crates/wallflower-core/src/db/schema.rs` - JamRecord and NewJam structs with serde
- `crates/wallflower-app/Cargo.toml` - Tauri app binary dependencies
- `crates/wallflower-app/tauri.conf.json` - Tauri config pointing to out/ frontendDist
- `crates/wallflower-app/src/main.rs` - Desktop entry point
- `crates/wallflower-app/src/lib.rs` - Tauri builder setup
- `crates/wallflower-app/build.rs` - tauri_build::build()
- `crates/wallflower-app/capabilities/default.json` - Default Tauri permissions
- `crates/wallflower-cli/Cargo.toml` - CLI binary with clap
- `crates/wallflower-cli/src/main.rs` - Status subcommand skeleton
- `migrations/V1__initial_schema.sql` - jams and settings tables
- `src/lib/types.ts` - TypeScript interfaces matching Rust structs
- `src/lib/tauri.ts` - Typed invoke wrappers for all IPC commands
- `src/app/layout.tsx` - Root layout with system font stack
- `src/app/page.tsx` - Placeholder page with Wallflower heading
- `next.config.mjs` - Static export configuration
- `postcss.config.mjs` - Tailwind CSS PostCSS config
- `src/app/globals.css` - Tailwind + shadcn theme variables
- `LICENSE` - MIT License, copyright 2026 Andrew Lovett-Barron
- `.gitignore` - Rust, Node, SQLite, IDE ignores
- `components.json` - shadcn configuration
- `src/components/ui/` - 11 shadcn components for Phase 1

## Decisions Made
- **Dropped refinery, using manual migrations:** refinery 0.9 depends on rusqlite <=0.37, which conflicts with our rusqlite 0.39. Manual migrations with include_str! and table existence checks are simpler for this use case and avoid the version conflict. This can be revisited if refinery updates to support rusqlite 0.39.
- **Kept rusqlite 0.39 (latest):** Preferred using the latest version rather than downgrading to accommodate refinery, since the migration logic is simple enough to handle manually.
- **Removed app.title from tauri.conf.json:** Tauri 2.10 does not support the `title` field under `app` -- title is only valid on individual windows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed refinery dependency due to version conflict**
- **Found during:** Task 1 (Cargo workspace scaffolding)
- **Issue:** refinery 0.9 depends on rusqlite >=0.23 <=0.37 but wallflower-core uses rusqlite 0.39, causing a libsqlite3-sys link conflict
- **Fix:** Removed refinery dependency, implemented manual migrations using include_str! with table existence check
- **Files modified:** crates/wallflower-core/Cargo.toml, crates/wallflower-core/src/db/mod.rs
- **Verification:** cargo build --workspace succeeds, all 7 db tests pass
- **Committed in:** 387aaf8

**2. [Rule 3 - Blocking] Fixed tauri.conf.json app.title field**
- **Found during:** Task 1 (Cargo workspace scaffolding)
- **Issue:** Tauri 2.10 build rejected unknown field `title` under `app` config
- **Fix:** Removed `title` from `app` section, kept it only on the window object
- **Files modified:** crates/wallflower-app/tauri.conf.json
- **Verification:** cargo build --workspace succeeds
- **Committed in:** 6b3e7dd

**3. [Rule 3 - Blocking] Created placeholder Tauri icons**
- **Found during:** Task 1 (Cargo workspace scaffolding)
- **Issue:** tauri::generate_context! panics if icon.png is missing from icons directory
- **Fix:** Generated minimal solid-color PNG icons at 32x32, 128x128, and 256x256
- **Files modified:** crates/wallflower-app/icons/
- **Verification:** cargo build --workspace succeeds
- **Committed in:** 6b3e7dd

---

**Total deviations:** 3 auto-fixed (3 blocking issues)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep. Manual migrations are simpler than refinery for this use case.

## Issues Encountered
- Rust toolchain was not installed on the system. Installed via rustup before starting.

## Known Stubs
None -- all implemented functionality is wired and operational.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workspace compiles, frontend builds, database tested -- ready for Plan 02 (import pipeline, folder watcher, settings)
- The import/watcher/device/settings modules referenced in lib.rs will be added in Plan 02
- CLI subcommands beyond `status` will be added in Plan 02
- Tauri IPC commands will be wired in Plan 02/04

---
*Phase: 01-tauri-app-shell-storage-api-foundation*
*Completed: 2026-04-18*

## Self-Check: PASSED
All 13 key files verified present. All 3 commit hashes verified in git log.
