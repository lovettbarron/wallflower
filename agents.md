# Wallflower -- Agent Feedback & Skills

Tracking feedback and codified skills from AI-assisted development.

## Phase 1: Tauri App Shell, Storage & API Foundation

### Decisions

- Dropped refinery for manual SQL migrations due to rusqlite 0.39 incompatibility
- Using include_str! migration pattern with table existence check for idempotent schema setup
- Tauri 2.10 does not support app.title in tauri.conf.json (only window-level title)
- notify v8 used for folder watching (v7 initially specified in CLAUDE.md but v8 is current)
- Device detection scans /Volumes/ with max 3 directory levels to balance coverage vs performance

### Skills Learned

- Cargo workspace with shared core library consumed by app + CLI binaries
- Tauri IPC commands use #[serde(rename_all = "camelCase")] for JS interop
- Next.js static export (output: 'export') for Tauri frontendDist
- SQLite WAL mode for concurrent access from app and CLI
- Atomic file import: tempfile in target dir -> fsync -> rename (same-filesystem guarantee)
- notify::RecommendedWatcher with mpsc channel + debounce thread pattern for file watching
- Zoom F3 directory structure: ZOOM0001/ numbered folders and STEREO/ subdirectory

### Patterns Established

- Database: manual migrations via include_str! with idempotent table checks
- Error handling: thiserror WallflowerError enum with From impls
- Tauri commands: thin wrappers calling wallflower-core functions
- CLI: clap derive with git-style subcommands sharing wallflower-core
- Watcher: separate thread with AtomicBool flags for active/stop, HashMap debounce
- Device detection: scan /Volumes/, pattern-match known recorder directory structures
