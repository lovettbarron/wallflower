---
phase: 02-playback-metadata-design-system-notifications
plan: 01
subsystem: backend-foundation-design-system
tags: [sqlite, metadata, peaks, photos, notifications, design-tokens, tauri]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [metadata-crud, peak-generation, photo-storage, notification-plugin, design-tokens, asset-protocol, typescript-contracts]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: [tauri-plugin-notification, image, wavesurfer.js, "@wavesurfer/react", "@fontsource/plus-jakarta-sans", zustand, "@tanstack/react-query"]
  patterns: [versioned-migrations, peak-caching, thumbnail-generation, tauri-managed-state]
key_files:
  created:
    - migrations/V2__metadata_tables.sql
    - crates/wallflower-core/src/peaks.rs
    - crates/wallflower-core/src/photos.rs
    - crates/wallflower-app/src/commands/metadata.rs
  modified:
    - crates/wallflower-core/src/db/mod.rs
    - crates/wallflower-core/src/db/schema.rs
    - crates/wallflower-core/src/lib.rs
    - crates/wallflower-core/Cargo.toml
    - crates/wallflower-app/src/lib.rs
    - crates/wallflower-app/Cargo.toml
    - crates/wallflower-app/tauri.conf.json
    - crates/wallflower-app/capabilities/default.json
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/app/globals.css
    - src/app/layout.tsx
    - package.json
decisions:
  - "Versioned migration system with schema_version table replaces simple table-existence check"
  - "Peaks cached as JSON files in app data directory for fast re-reads"
  - "Photo thumbnails generated via image crate at 200px max dimension"
  - "Plus Jakarta Sans loaded via @fontsource (self-hosted, no network requests)"
  - "Tauri protocol-asset feature enabled for audio Range request serving"
metrics:
  duration: 17min
  completed: "2026-04-19T05:15:00Z"
  tasks: 2
  files: 17
---

# Phase 2 Plan 1: Backend Foundation & Design System Summary

SQLite V2 migration with metadata tables (tags, collaborators, instruments, photos), peak generation engine using symphonia, photo storage with thumbnail generation, Tauri notification plugin, asset protocol for audio serving, Wallflower dark theme design tokens, and complete TypeScript type contracts.

## What Was Done

### Task 1: SQLite V2 Migration, Metadata CRUD, Peak Generation, Photo Storage
**Commit:** 4d9de82

- Created V2 migration with schema_version tracking, jam_tags/jam_collaborators/jam_instruments/jam_photos tables, and new jams columns (location, notes, patch_notes, peaks_generated)
- Built versioned migration system: detects fresh installs vs V1 upgrades, applies migrations sequentially
- Implemented full CRUD for tags, collaborators, instruments, photos with autocomplete queries (list_all_*)
- Added JamMetadata update and peaks_generated flag operations
- Created peak generation engine: symphonia decodes audio, computes min/max per chunk, mixes to mono, normalizes to [-1,1]
- Created photo storage: copy to app data dir with UUID naming, JPEG thumbnail generation at configurable max dimension
- All 52 tests passing

### Task 2: Tauri Commands, Notification Plugin, Asset Protocol, Design Tokens, TS Types
**Commit:** 9bd6998

- Created 16 new Tauri IPC commands: get_jam_with_metadata, add/remove/list_all for tags/collaborators/instruments, update_jam_metadata, attach/remove_photo, get/generate_peaks, send_notification
- Registered tauri-plugin-notification with macOS notification permissions
- Enabled asset protocol with scope for app data and wallflower directories
- Applied Wallflower dark theme: hsl(220 16% 10%) background, hsl(28 90% 58%) warm accent, custom waveform/surface tokens
- Loaded Plus Jakarta Sans via @fontsource (weights 400, 600)
- Complete TypeScript interfaces: JamTag, JamCollaborator, JamInstrument, JamPhoto, JamDetail, PeakData
- All typed invoke wrappers in tauri.ts matching backend commands
- Installed wavesurfer.js, @wavesurfer/react, zustand, @tanstack/react-query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added protocol-asset Tauri feature**
- **Found during:** Task 2 build
- **Issue:** Tauri build script requires `protocol-asset` cargo feature when assetProtocol is enabled in tauri.conf.json
- **Fix:** Added `features = ["protocol-asset"]` to tauri dependency in Cargo.toml
- **Files modified:** crates/wallflower-app/Cargo.toml

**2. [Rule 3 - Blocking] Added tauri::Manager import**
- **Found during:** Task 2 build
- **Issue:** `AppHandle::path()` requires `tauri::Manager` trait to be in scope
- **Fix:** Added `use tauri::Manager;` to metadata commands module
- **Files modified:** crates/wallflower-app/src/commands/metadata.rs

**3. [Rule 1 - Bug] Fixed image::GenericImageView trait import**
- **Found during:** Task 1 tests
- **Issue:** `DynamicImage::dimensions()` requires the GenericImageView trait in scope (image 0.25)
- **Fix:** Added `use image::GenericImageView;` in photos test module
- **Files modified:** crates/wallflower-core/src/photos.rs

## Verification

- `cargo test -p wallflower-core`: 52 tests passed (includes all metadata CRUD, peaks, photos)
- `cargo build -p wallflower-app`: Compiles successfully with notification plugin and all commands
- `npm run build`: Static export builds with dark theme and Plus Jakarta Sans font

## Known Stubs

None - all functions are fully implemented and wired.

## Self-Check: PASSED
