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

## Release Process

### Code Signing & Notarization

- Releases MUST be built through the CI pipeline (`.github/workflows/release.yml`) — never upload locally-built artifacts to GitHub releases. Local builds are ad-hoc signed and will trigger macOS "damaged app" errors for users who download them.
- The CI workflow imports the Apple Developer ID certificate from repo secrets and uses `tauri-apps/tauri-action` to build, code-sign, and notarize the app.
- Required secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.
- The signing identity is "Developer ID Application: Andrew Lovett-Barron (JXW9RJT4W2)".
- The CI creates a **draft** release. Always verify assets before publishing.

### Changelog

- Every release must include a changelog in the release notes summarizing user-facing changes.
- Group changes by category: fixes, features, performance, etc.
- Keep it concise — focus on what changed for the user, not implementation details.
- Format example:
  ```
  ## What's new
  - **Feature name**: One-line description of what it does for the user.
  - **Fix name**: One-line description of what was broken and how it's fixed.
  ```

### Release Workflow

1. Bump version in `crates/wallflower-app/tauri.conf.json`
2. Commit and push to `main` — CI triggers automatically
3. CI builds, signs, notarizes, and uploads assets to a draft release
4. Review the draft: verify assets are present and properly signed
5. Edit the release notes with a changelog
6. Publish the draft as the latest release
