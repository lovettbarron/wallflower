# Phase 1: Tauri App Shell, Storage & API Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 01-tauri-app-shell-storage-api-foundation
**Areas discussed:** Import experience, Initial app shell UI, Folder watching scope, API & CLI shape

---

## Import Experience

### Duplicate Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silently | Skip duplicates without notification | |
| Skip with toast | Skip duplicates, show brief notification | ✓ |
| Prompt each time | Ask user whether to skip, replace, or import as copy | |
| Always import as copy | Never skip, import every file even if content matches | |

**User's choice:** Skip with toast
**Notes:** None

### Device Detection Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-import new files | Automatically copy new recordings from device | |
| Show import prompt | Dialog listing new files, user selects which to import | ✓ |
| Notification only | Native macOS notification, user clicks to open import view | |

**User's choice:** Show import prompt
**Notes:** None

### Import Progress Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline progress bar | Small progress indicator in file list or status bar | ✓ |
| Toast with progress | Persistent toast showing copy progress percentage | |
| Activity panel | Dedicated area showing all active imports with progress | |

**User's choice:** Inline progress bar
**Notes:** None

### Batch Import

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, folder import | User can drop a folder, all audio files queued for import | ✓ |
| Individual files only | Single-file import only for Phase 1 | |
| You decide | Claude's discretion | |

**User's choice:** Yes, folder import
**Notes:** None

---

## Initial App Shell UI

### Phase 1 Layout

| Option | Description | Selected |
|--------|-------------|----------|
| File list + import | Simple table/list with import button and drag-drop zone | ✓ |
| Empty state focus | Large welcoming empty state, transitions to list after first import | |
| Sidebar + content | Two-pane layout with sidebar navigation from day one | |

**User's choice:** File list + import
**Notes:** None

### Settings Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Essential only | Watch folder, storage location, import behavior, About links | ✓ |
| Comprehensive | All configurable values exposed from day one | |
| You decide | Claude's discretion | |

**User's choice:** Essential only
**Notes:** User emphasized settings UI is critical -- "tool for me first, but broadly useful to others." Must include links to andrewlb.com and git repo.

### Navigation Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Flat for now | Single-view app with top bar, sidebar added in Phase 2 | |
| Sidebar from start | Left sidebar with Library and Settings nav items | |
| Tab bar | Top tabs (Library, Settings), lightweight and scalable | ✓ |

**User's choice:** Tab bar
**Notes:** None

---

## Folder Watching Scope

### Watch Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single folder (default) | Watch ~/wallflower only, user can change path in settings | |
| Multiple folders | User configures a list of watched folders | |
| Single + device volumes | One folder plus auto-detect mounted USB recorder volumes | ✓ |

**User's choice:** Single + device volumes
**Notes:** None

### Sync Folder Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Detect and warn | Detect sync folder, show one-time warning, allow proceeding | ✓ |
| Block sync folders | Refuse to set watch folder inside Dropbox/iCloud | |
| Handle silently | Filter sync artifacts by pattern, no user warning | |

**User's choice:** Detect and warn
**Notes:** None

### Debounce Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fast (1-2 seconds) | Near-instant import after file appears | |
| Moderate (5 seconds) | Wait 5 seconds after file write stabilizes | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Moderate (5 seconds)
**Notes:** None

---

## API & CLI Shape

### API Style

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri commands | Tauri invoke() IPC for frontend, separate HTTP for CLI | ✓ |
| HTTP REST throughout | axum on local port for both frontend and CLI | |
| Hybrid | Tauri commands for performance-critical, HTTP REST for rest | |

**User's choice:** Tauri commands
**Notes:** None

### CLI Command Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Subcommand style | wallflower import, wallflower list, etc. | ✓ |
| Flag style | wallflower --import, wallflower --list | |
| You decide | Claude's discretion | |

**User's choice:** Subcommand style
**Notes:** None

### CLI Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone | CLI directly opens SQLite database, no running app needed | ✓ |
| Client to running app | CLI sends HTTP requests to running app | |
| Both modes | Standalone by default, proxy through app if running | |

**User's choice:** Standalone
**Notes:** None

### API Surface Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Import + Library ops | Only Phase 1 endpoints, grow per phase | |
| Full skeleton | Stub all planned endpoints returning 501 | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Full skeleton
**Notes:** None

---

## Claude's Discretion

- Import debounce timing fine-tuning (5 seconds as baseline)
- Internal file organization within app support directory
- Error handling patterns and logging strategy

## Deferred Ideas

None -- discussion stayed within phase scope
