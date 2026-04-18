# Phase 1: Tauri App Shell, Storage & API Foundation - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can launch a native macOS app (Tauri v2), import audio files into a safe organized library with atomic copy-first operations, and interact with the system via Tauri IPC commands (frontend) and a standalone CLI. The app establishes the foundational UI shell, settings system, folder watching, USB device detection, and SQLite storage that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### Import Experience
- **D-01:** Duplicate detection via content hash. Duplicates are skipped with a brief toast notification ("Already imported: filename.wav"). No prompt, no silent skip.
- **D-02:** USB recorder detection (Zoom F3 and similar) shows an import prompt dialog listing new files found on the device. User selects which files to import. Not auto-import.
- **D-03:** Import progress shown as an inline progress bar in the file list or status bar area. Non-blocking, stays out of the way.
- **D-04:** Folder/batch import supported from day one. User can drop a folder or select a directory and all supported audio files inside are queued for import.

### Initial App Shell UI
- **D-05:** Phase 1 UI is a simple file list with import functionality. Table/list of imported jams showing filename, date, duration, format. Import button and drag-drop zone below.
- **D-06:** Navigation uses a top tab bar (Library | Settings). Lightweight pattern that scales as views are added in Phase 2+. No sidebar.
- **D-07:** Settings page is essential-only: watch folder path, audio storage location, import behavior (duplicate handling). Includes an About section with links to andrewlb.com and the project git repo.
- **D-08:** Settings UI is a first-class feature, not an afterthought. The app should be configurable and feel like a tool built for the user, while being broadly useful to others.

### Folder Watching
- **D-09:** Watch one configured folder (default ~/wallflower) plus auto-detect mounted USB recorder volumes. Two import paths: folder watcher and device detection.
- **D-10:** Sync folder detection: on first launch or settings change, detect if watch folder is inside Dropbox/iCloud. Show a one-time warning recommending a non-synced path. Still allow the user to proceed.
- **D-11:** File debounce: wait 5 seconds after file write stabilizes before importing. Avoids partial imports from slow copies or sync downloads.

### API & CLI Shape
- **D-12:** Frontend communicates with backend via Tauri invoke() IPC commands. Type-safe, no HTTP overhead, native to Tauri architecture. CLI uses a separate lightweight mechanism.
- **D-13:** CLI uses git-style subcommand structure: `wallflower import <path>`, `wallflower list`, `wallflower status`, etc. Built with clap.
- **D-14:** CLI operates standalone against the SQLite database. No need for the app to be running. Designed for scripting and debugging. Concurrent access handled via SQLite WAL mode.
- **D-15:** Full API skeleton stubbed out in Phase 1. All planned endpoints (playback, recording, analysis, export) return 501 Not Implemented. Documents the full API shape early so the contract is visible.

### Claude's Discretion
- Import debounce timing can be tuned based on technical constraints (user said 5 seconds is a good default)
- Internal file organization within ~/Library/Application Support/wallflower (DB location, audio storage subdirs)
- Error handling patterns and logging strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` -- Full technology stack with version pinning, "Why NOT" alternatives analysis, and architecture notes (Rust backend as independent service, frontend delivery, Python sidecar lifecycle)
- `.planning/PROJECT.md` -- Project vision, constraints, key decisions, target hardware context
- `.planning/REQUIREMENTS.md` -- Full v1 requirements with IDs (STOR-01 through STOR-07, INFRA-01 through INFRA-09 are Phase 1)
- `.planning/ROADMAP.md` -- Phase breakdown, success criteria, dependency chain

### Technology References
- Tauri v2 docs (v2.tauri.app) -- IPC commands, static export embedding, WKWebView integration
- axum 0.8.x (tokio.rs) -- HTTP server for CLI/external access
- rusqlite 0.32.x -- SQLite with bundled mode, WAL mode for concurrent access
- notify 7.x -- Filesystem watching with FSEvents backend on macOS
- clap 4.x -- CLI argument parsing with subcommands
- Next.js 15.x static export -- `output: 'export'` mode for Tauri webview

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None -- greenfield project. All patterns established in this phase.

### Established Patterns
- None yet. Phase 1 establishes:
  - Tauri v2 project structure (Rust backend + React frontend)
  - SQLite schema and migration pattern (refinery)
  - Tauri command pattern for IPC
  - Component library foundation (Tailwind CSS)
  - State management pattern (zustand)

### Integration Points
- Tauri process embeds the Rust backend; React frontend renders in WKWebView
- CLI binary shares the core Rust library but runs independently
- SQLite database is the shared data layer between app and CLI (WAL mode for concurrent access)
- Folder watcher (notify) feeds into the import pipeline
- USB volume detection (macOS FSEvents/DiskArbitration) feeds into device import prompt

</code_context>

<specifics>
## Specific Ideas

- Settings UI must include links to andrewlb.com and the project git repository in an About section
- The app should feel like a tool built for the developer first, but designed to be broadly useful to others
- Design inspiration: Mutable Instruments (generous whitespace, bold accents, rounded organic shapes) and Intellijel (structured logical sections) -- per DES-01, though full design system is Phase 2
- Phase 1 UI can be minimal/functional; the design language arrives in Phase 2

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-tauri-app-shell-storage-api-foundation*
*Context gathered: 2026-04-18*
