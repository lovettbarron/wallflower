# Phase 1: Tauri App Shell, Storage & API Foundation - Research

**Researched:** 2026-04-18
**Domain:** Tauri v2 desktop app scaffolding, SQLite storage, file import pipeline, folder watching, CLI tooling
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire application foundation: a Tauri v2 native macOS app with a React/Next.js frontend in WKWebView, a Rust backend handling audio file import with atomic operations, SQLite storage with WAL mode, filesystem watching via notify, USB device detection via macOS DiskArbitration, and a standalone CLI binary sharing the core library. This is a greenfield phase -- all patterns established here carry forward through all subsequent phases.

The primary architectural challenge is structuring the Rust workspace so that core logic (import pipeline, database, file management) lives in a shared library crate consumed by both the Tauri app binary and the standalone CLI binary. The Tauri app uses IPC commands (invoke()) for frontend-backend communication, while the CLI operates independently against the same SQLite database using WAL mode for safe concurrent access.

**Primary recommendation:** Use a Cargo workspace with three members: `wallflower-core` (library), `wallflower-app` (Tauri binary), and `wallflower-cli` (clap binary). The core library owns all business logic; app and CLI are thin wrappers.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Duplicate detection via content hash. Duplicates are skipped with a brief toast notification ("Already imported: filename.wav"). No prompt, no silent skip.
- **D-02:** USB recorder detection (Zoom F3 and similar) shows an import prompt dialog listing new files found on the device. User selects which files to import. Not auto-import.
- **D-03:** Import progress shown as an inline progress bar in the file list or status bar area. Non-blocking, stays out of the way.
- **D-04:** Folder/batch import supported from day one. User can drop a folder or select a directory and all supported audio files inside are queued for import.
- **D-05:** Phase 1 UI is a simple file list with import functionality. Table/list of imported jams showing filename, date, duration, format. Import button and drag-drop zone below.
- **D-06:** Navigation uses a top tab bar (Library | Settings). Lightweight pattern that scales as views are added in Phase 2+. No sidebar.
- **D-07:** Settings page is essential-only: watch folder path, audio storage location, import behavior (duplicate handling). Includes an About section with links to andrewlb.com and the project git repo.
- **D-08:** Settings UI is a first-class feature, not an afterthought.
- **D-09:** Watch one configured folder (default ~/wallflower) plus auto-detect mounted USB recorder volumes. Two import paths: folder watcher and device detection.
- **D-10:** Sync folder detection: on first launch or settings change, detect if watch folder is inside Dropbox/iCloud. Show a one-time warning recommending a non-synced path. Still allow the user to proceed.
- **D-11:** File debounce: wait 5 seconds after file write stabilizes before importing. Avoids partial imports from slow copies or sync downloads.
- **D-12:** Frontend communicates with backend via Tauri invoke() IPC commands. Type-safe, no HTTP overhead, native to Tauri architecture.
- **D-13:** CLI uses git-style subcommand structure: `wallflower import <path>`, `wallflower list`, `wallflower status`, etc. Built with clap.
- **D-14:** CLI operates standalone against the SQLite database. No need for the app to be running. Concurrent access handled via SQLite WAL mode.
- **D-15:** Full API skeleton stubbed out in Phase 1. All planned endpoints return 501 Not Implemented.

### Claude's Discretion
- Import debounce timing can be tuned based on technical constraints (user said 5 seconds is a good default)
- Internal file organization within ~/Library/Application Support/wallflower (DB location, audio storage subdirs)
- Error handling patterns and logging strategy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOR-01 | Import audio files (WAV, FLAC, MP3) via atomic copy-first import with temp-then-rename | Atomic write pattern using tempfile + fs::rename in same directory; SHA256 content hashing via sha2 crate for duplicate detection |
| STOR-02 | Store metadata in SQLite at ~/Library/Application Support/wallflower | rusqlite 0.39.x with bundled feature; Tauri AppHandle provides app_data_dir() for platform-correct paths |
| STOR-03 | Watch configurable folder (default ~/wallflower) for new audio files and auto-import | notify 8.x with FSEvents backend on macOS; debounce with 5-second stabilization window |
| STOR-04 | Detect connected USB audio recorders (Zoom F3) and prompt to import | DiskArbitration framework via diskarbitration-sys crate for volume mount notifications; identify Zoom F3 by vendor/product metadata |
| STOR-05 | Process 32-bit float WAV files, downsample to 24-bit for DAW compatibility | symphonia for reading all formats; hound for WAV writing; bit-depth conversion is a Phase 1 stub (actual implementation in export phase) |
| STOR-06 | SQLite database is a single portable file that can be backed up by copying | WAL mode with PRAGMA journal_mode=WAL; single .db file in app data directory |
| STOR-07 | Atomic file operations (temp-then-rename) to prevent corruption in sync folders | Write to .tmp file in same directory, fsync, then rename; tempfile crate or manual std::fs pattern |
| INFRA-01 | Backend exposes a RESTful API for all functionality | axum 0.8.x HTTP server embedded in Tauri process; serves API for external access while Tauri IPC handles frontend |
| INFRA-02 | CLI tool provides access to all backend operations | Standalone clap 4.x binary in separate workspace member sharing wallflower-core library |
| INFRA-03 | Comprehensive test coverage | Rust: cargo test with unit + integration tests; Frontend: vitest + React Testing Library; E2E: Tauri's WebDriver support |
| INFRA-04 | README updated at end of every phase | Documentation task at phase completion |
| INFRA-05 | Release generated at end of each milestone | cargo tauri build produces .dmg; GitHub release |
| INFRA-06 | agents.md maintained at repo top level | Documentation file tracking feedback and skills |
| INFRA-07 | MIT license, no GPL in core, LGPL acceptable | All recommended crates are MIT/Apache-2.0 dual licensed; verify each dependency |
| INFRA-08 | Documentation accessible for open source contributors | README + CONTRIBUTING.md + inline code documentation |
| INFRA-09 | Native macOS app built with Tauri v2 | Tauri 2.10.x with Next.js 16.x static export; WKWebView rendering |

</phase_requirements>

## Standard Stack

### Core (Rust Backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri | 2.10.x | Desktop app framework | Native macOS window via WKWebView, IPC command system, app lifecycle management |
| tauri-build | 2.5.x | Build tooling | Generates Tauri glue code at compile time |
| @tauri-apps/cli | 2.10.x | Dev/build CLI | `cargo tauri dev` and `cargo tauri build` commands |
| @tauri-apps/api | 2.x | Frontend JS bridge | `invoke()` function for calling Rust commands from React |
| rusqlite | 0.39.x | SQLite database | Bundles SQLite into binary, WAL mode for concurrent CLI access. Note: CLAUDE.md says 0.32.x but current is 0.39.x |
| refinery | 0.9.x | SQLite migrations | Embedded migrations with `embed_migrations!` macro, rusqlite feature flag |
| notify | 8.x | Filesystem watching | FSEvents backend on macOS. Note: CLAUDE.md says 7.x but current stable is 8.2.0 |
| clap | 4.6.x | CLI argument parsing | Git-style subcommands for standalone CLI binary |
| axum | 0.8.x | HTTP API server | RESTful API for external/CLI access; embedded in Tauri process |
| tokio | 1.x | Async runtime | Required by axum; powers async file I/O and background tasks |
| serde / serde_json | 1.x | Serialization | JSON API responses, config files, Tauri IPC serialization |
| sha2 | 0.10.x | Content hashing | SHA256 file hashing for duplicate detection (D-01) |
| symphonia | 0.5.x | Audio file decoding | Read WAV/FLAC/MP3 metadata (duration, sample rate, bit depth) without full decode |
| hound | 3.5.x | WAV file writing | Used for any WAV output operations |
| uuid | 1.x | Unique identifiers | Jam/file IDs in database |
| tracing | 0.1.x | Structured logging | Async-aware logging throughout backend |
| tower-http | 0.6.x | HTTP middleware | CORS for API access from CLI/external tools |
| thiserror | 2.x | Error types | Idiomatic error handling for Tauri commands |
| tempfile | 3.x | Temporary files | Atomic write pattern: create temp in target dir, write, rename |

### Core (Frontend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.x | React framework | Static export mode for Tauri webview. Current stable is 16.2.4 |
| react | 19.x | UI framework | Current stable 19.2.5 |
| typescript | 5.x | Type safety | Non-negotiable for project this size |
| tailwindcss | 4.x | Styling | Current stable 4.2.2; rapid UI development |
| shadcn | 4.x | Component library | Pre-built accessible components (Button, Table, Dialog, etc.) per UI-SPEC |
| zustand | 5.x | Client state | Lightweight store for UI state, import progress, settings |
| @tanstack/react-query | 5.x | Server state | Caching and refetching for Tauri IPC calls |
| sonner | 2.x | Toast notifications | Required by UI-SPEC for import feedback toasts |
| lucide-react | latest | Icons | shadcn default icon library per UI-SPEC |

### macOS-Specific (Rust)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| diskarbitration-sys | latest | USB volume detection | Detect Zoom F3 and other USB mass storage recorders mounting (STOR-04) |
| core-foundation | latest | macOS framework bindings | Required by DiskArbitration for CFRunLoop integration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| refinery | rusqlite_migration | rusqlite_migration is simpler (SQL strings in code, no files), but refinery is more established and CLAUDE.md specifies it |
| notify 8.x | kqueue direct | notify abstracts platform differences; direct kqueue gives more control but more code |
| tempfile crate | manual std::fs temp | tempfile handles cleanup on drop and ensures same-filesystem creation |
| diskarbitration-sys | polling /Volumes | DiskArbitration is event-driven (instant detection); polling adds latency and CPU |
| axum (embedded) | Tauri IPC only | axum needed for CLI/external access per INFRA-01; IPC alone would leave CLI without API |

**Installation (Rust):**
```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install protobuf compiler (needed for future gRPC, not Phase 1)
brew install protobuf

# Install Tauri CLI
cargo install tauri-cli
```

**Installation (Frontend):**
```bash
npm create tauri-app@latest wallflower -- --template react-ts
# Then configure for Next.js static export
```

## Architecture Patterns

### Recommended Project Structure

```
wallflower/
├── Cargo.toml                    # Workspace root
├── package.json                  # Frontend package.json
├── next.config.mjs               # Next.js config (output: 'export')
├── tsconfig.json
├── tailwind.config.ts
├── src/                          # Next.js frontend source
│   ├── app/                      # App router pages
│   │   ├── layout.tsx            # Root layout with tab navigation
│   │   ├── page.tsx              # Library tab (default)
│   │   └── settings/
│   │       └── page.tsx          # Settings tab
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn components
│   │   ├── file-list.tsx
│   │   ├── import-drop-zone.tsx
│   │   ├── device-import-dialog.tsx
│   │   └── sync-folder-warning.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-jams.ts           # Query hook for jam list
│   │   ├── use-import.ts         # Import mutation hook
│   │   └── use-settings.ts       # Settings query/mutation
│   ├── lib/                      # Utilities
│   │   ├── tauri.ts              # Typed invoke wrappers
│   │   └── types.ts              # Shared TypeScript types
│   └── stores/                   # Zustand stores
│       └── app-store.ts          # UI state (active tab, import progress)
├── crates/
│   ├── wallflower-core/          # Shared library crate
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── db/               # Database module
│   │       │   ├── mod.rs
│   │       │   ├── schema.rs     # Table definitions
│   │       │   └── migrations/   # SQL migration files
│   │       ├── import/           # Import pipeline
│   │       │   ├── mod.rs
│   │       │   ├── hasher.rs     # SHA256 content hashing
│   │       │   └── metadata.rs   # Audio metadata extraction
│   │       ├── watcher/          # Folder watcher
│   │       │   ├── mod.rs
│   │       │   └── debounce.rs   # 5-second debounce logic
│   │       ├── device/           # USB device detection
│   │       │   └── mod.rs
│   │       ├── settings/         # App configuration
│   │       │   └── mod.rs
│   │       └── error.rs          # Error types
│   ├── wallflower-app/           # Tauri app binary (src-tauri equivalent)
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   ├── icons/
│   │   ├── src/
│   │   │   ├── main.rs           # Desktop entry point
│   │   │   ├── lib.rs            # Tauri setup + mobile entry point
│   │   │   └── commands/         # Tauri IPC command handlers
│   │   │       ├── mod.rs
│   │   │       ├── import.rs
│   │   │       ├── jams.rs
│   │   │       └── settings.rs
│   │   └── build.rs
│   └── wallflower-cli/           # Standalone CLI binary
│       ├── Cargo.toml
│       └── src/
│           └── main.rs           # clap-driven CLI
├── migrations/                   # Shared SQL migration files
│   └── V1__initial_schema.sql
└── out/                          # Next.js static export output
```

### Pattern 1: Tauri IPC Commands

**What:** Frontend calls Rust backend via type-safe invoke() commands
**When to use:** All frontend-to-backend communication

```rust
// crates/wallflower-app/src/commands/jams.rs
use wallflower_core::db::JamRecord;

#[tauri::command]
pub async fn list_jams(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<JamRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    wallflower_core::db::list_jams(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_files(
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> Result<Vec<ImportResult>, String> {
    wallflower_core::import::import_files(&state.db, &state.config, paths)
        .await
        .map_err(|e| e.to_string())
}
```

```typescript
// src/lib/tauri.ts
import { invoke } from '@tauri-apps/api/core';

export async function listJams(): Promise<JamRecord[]> {
  return invoke('list_jams');
}

export async function importFiles(paths: string[]): Promise<ImportResult[]> {
  return invoke('import_files', { paths });
}
```

### Pattern 2: Atomic File Import Pipeline

**What:** Import audio files safely using temp-then-rename
**When to use:** Every file import operation (STOR-01, STOR-07)

```rust
// crates/wallflower-core/src/import/mod.rs
use sha2::{Sha256, Digest};
use std::io::{BufReader, Read};
use tempfile::NamedTempFile;

pub fn import_file(db: &Connection, config: &Config, source: &Path) -> Result<ImportResult> {
    // 1. Compute content hash for duplicate detection
    let hash = compute_sha256(source)?;

    // 2. Check for duplicate
    if let Some(existing) = db::find_by_hash(db, &hash)? {
        return Ok(ImportResult::Duplicate(existing.filename));
    }

    // 3. Extract metadata (duration, format, sample rate)
    let metadata = metadata::extract(source)?;

    // 4. Atomic copy: temp file in target directory, then rename
    let target_dir = config.storage_dir();
    let target_name = generate_filename(source, &metadata);
    let target_path = target_dir.join(&target_name);

    let mut temp = NamedTempFile::new_in(&target_dir)?;
    std::io::copy(&mut File::open(source)?, temp.as_file_mut())?;
    temp.as_file_mut().sync_all()?;  // fsync before rename
    temp.persist(&target_path)?;     // atomic rename

    // 5. Insert into database
    let jam = db::insert_jam(db, &target_name, &hash, &metadata)?;

    Ok(ImportResult::Imported(jam))
}

fn compute_sha256(path: &Path) -> Result<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(8192, file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
```

### Pattern 3: Cargo Workspace with Shared Core

**What:** Multiple binaries sharing a library crate
**When to use:** This exact project structure

```toml
# Root Cargo.toml
[workspace]
members = [
    "crates/wallflower-core",
    "crates/wallflower-app",
    "crates/wallflower-cli",
]
resolver = "2"

[workspace.dependencies]
rusqlite = { version = "0.39", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"
thiserror = "2"
```

### Pattern 4: SQLite Schema with WAL Mode

**What:** Initial database schema for jam storage
**When to use:** Database initialization

```sql
-- migrations/V1__initial_schema.sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE jams (
    id TEXT PRIMARY KEY,           -- UUID
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    format TEXT NOT NULL,          -- 'wav', 'flac', 'mp3'
    duration_seconds REAL,
    sample_rate INTEGER,
    bit_depth INTEGER,
    channels INTEGER,
    file_size_bytes INTEGER NOT NULL,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT               -- file creation time if available
);

CREATE INDEX idx_jams_content_hash ON jams(content_hash);
CREATE INDEX idx_jams_imported_at ON jams(imported_at);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default settings
INSERT INTO settings (key, value) VALUES
    ('watch_folder', '~/wallflower'),
    ('storage_dir', ''),           -- empty = use app data dir
    ('duplicate_handling', 'skip');
```

### Pattern 5: Next.js Static Export for Tauri

**What:** Configure Next.js to produce static files for Tauri WKWebView
**When to use:** Frontend build configuration

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

```json
// crates/wallflower-app/tauri.conf.json (relevant sections)
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../../out"
  },
  "app": {
    "title": "Wallflower",
    "windows": [
      {
        "title": "Wallflower",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  }
}
```

### Anti-Patterns to Avoid

- **Putting business logic in Tauri commands:** Commands should be thin wrappers that call wallflower-core functions. Logic in commands cannot be reused by CLI.
- **Using Tauri file system plugin instead of std::fs:** The plugin is for sandboxed mobile apps. On desktop macOS, use standard Rust filesystem APIs directly.
- **Storing audio files in app data directory by default:** Audio files should be in a user-accessible location (~/wallflower or configured path). Only the database goes in ~/Library/Application Support/wallflower.
- **Running SQLite in async mode:** For a single-user desktop app, rusqlite's synchronous API is simpler and correct. Wrapping in spawn_blocking is fine for non-blocking Tauri commands.
- **Hardcoding paths:** Use Tauri's `app_handle.path().app_data_dir()` for platform-correct app data paths. Use expanduser for ~ in watch folder config.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Manual temp file + rename | `tempfile` crate with `persist()` | Handles cleanup on drop, ensures same-filesystem creation, provides NamedTempFile for debugging |
| Content hashing | Custom hash function | `sha2` crate with BufReader streaming | Constant memory regardless of file size, well-audited implementation |
| Audio metadata | Manual WAV/FLAC header parsing | `symphonia` with probe() | Handles all container formats, codec detection, metadata extraction in one call |
| SQLite migrations | Manual CREATE TABLE on first run | `refinery` with `embed_migrations!` | Versioned migrations, rollback tracking, compile-time embedding |
| CLI argument parsing | Manual arg parsing | `clap` with derive macro | Subcommands, help generation, shell completions, validation |
| macOS volume detection | Polling /Volumes directory | `diskarbitration-sys` | Event-driven, instant notification, no CPU overhead from polling |
| UI components | Custom button/dialog/table | shadcn (Button, Table, Dialog, etc.) | Accessible, tested, consistent with UI-SPEC component inventory |
| Toast notifications | Custom notification system | sonner (via shadcn) | Animation, stacking, auto-dismiss, accessible |

**Key insight:** Phase 1 establishes patterns used by all subsequent phases. Using established libraries now means Phase 2-6 inherit correct behavior for free. Hand-rolling any of these creates maintenance debt that compounds across 5 more phases.

## Common Pitfalls

### Pitfall 1: Tauri src-tauri Path Assumptions
**What goes wrong:** Tauri CLI assumes `src-tauri/` directory by default. A Cargo workspace with `crates/wallflower-app/` breaks the default path resolution.
**Why it happens:** `cargo tauri dev` looks for `src-tauri/tauri.conf.json` by default.
**How to avoid:** Either use `TAURI_APP_PATH` environment variable or symlink, or keep the Tauri crate named `src-tauri` within the workspace. Alternatively, pass `--config` to override.
**Warning signs:** "Could not find tauri.conf.json" errors during `cargo tauri dev`.

### Pitfall 2: Next.js Static Export Incompatibilities
**What goes wrong:** Using Next.js features that require a server (API routes, server components with data fetching, next/image optimization).
**Why it happens:** `output: 'export'` generates static HTML/JS/CSS only -- no Node.js server at runtime.
**How to avoid:** Use only client components with `'use client'` directive. All data fetching goes through Tauri invoke(). Set `images.unoptimized: true`.
**Warning signs:** Build warnings about "unsupported features with static export", blank pages in Tauri webview.

### Pitfall 3: SQLite Concurrent Access Without WAL
**What goes wrong:** CLI and app both access the database -- without WAL mode, readers block writers and vice versa.
**Why it happens:** Default SQLite journal mode uses rollback journal which locks the entire database on writes.
**How to avoid:** Set `PRAGMA journal_mode=WAL` at connection open time in wallflower-core. WAL allows concurrent readers with one writer.
**Warning signs:** "database is locked" errors when using CLI while app is running.

### Pitfall 4: Cross-Filesystem Rename Failure
**What goes wrong:** `fs::rename()` fails when source and destination are on different filesystems (e.g., importing from USB drive).
**Why it happens:** rename() is an atomic operation within a single filesystem. Cross-device moves require copy + delete.
**How to avoid:** The atomic pattern is: (1) copy to temp file in *target directory*, (2) rename temp to final name. The copy crosses filesystems; the rename is always same-filesystem.
**Warning signs:** "Invalid cross-device link" error on import from external drives.

### Pitfall 5: SHA256 Hashing Large Files Into Memory
**What goes wrong:** Reading entire 2GB audio file into memory before hashing causes OOM or huge memory spike.
**Why it happens:** Naive `std::fs::read()` + hash approach.
**How to avoid:** Stream hash with BufReader and 8KB chunks (see code example above). Memory usage stays constant regardless of file size.
**Warning signs:** Memory usage spikes proportional to file size during import.

### Pitfall 6: DiskArbitration Requires CFRunLoop
**What goes wrong:** DiskArbitration callbacks never fire.
**Why it happens:** DiskArbitration relies on macOS CFRunLoop for event dispatch. A Rust-only thread without a run loop won't receive callbacks.
**How to avoid:** Run DiskArbitration monitoring on a dedicated thread with its own CFRunLoop, or integrate with tokio by running CFRunLoopRunInMode periodically.
**Warning signs:** USB devices plug in but no events are received in Rust code.

### Pitfall 7: Tauri Commands Cannot Be pub in lib.rs
**What goes wrong:** Compilation error when trying to make Tauri commands public in the root lib.rs.
**Why it happens:** Tauri's `generate_handler!` macro generates glue code that conflicts with pub visibility in the entry point file.
**How to avoid:** Define commands in separate modules (e.g., `src/commands/import.rs`) and mark them `pub` there. Import into lib.rs for handler registration.
**Warning signs:** Cryptic macro expansion errors during compilation.

## Code Examples

### Tauri App State Setup

```rust
// crates/wallflower-app/src/lib.rs
use std::sync::Mutex;
use wallflower_core::db::Database;
use wallflower_core::settings::Config;

pub struct AppState {
    pub db: Mutex<Database>,
    pub config: Mutex<Config>,
}

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .expect("failed to get app data dir");

    let db = Database::open(&app_data_dir.join("wallflower.db"))
        .expect("failed to open database");

    let config = Config::load(&db).expect("failed to load config");

    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(db),
            config: Mutex::new(config),
        })
        .invoke_handler(tauri::generate_handler![
            commands::jams::list_jams,
            commands::jams::get_jam,
            commands::import::import_files,
            commands::import::import_directory,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::status::get_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### CLI Binary Structure

```rust
// crates/wallflower-cli/src/main.rs
use clap::{Parser, Subcommand};
use wallflower_core::db::Database;

#[derive(Parser)]
#[command(name = "wallflower", about = "Jam and sample manager CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Import audio files into the library
    Import {
        /// Path to file or directory
        path: String,
    },
    /// List all jams in the library
    List {
        /// Output format (table, json)
        #[arg(short, long, default_value = "table")]
        format: String,
    },
    /// Show application status
    Status,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let db = Database::open_default()?;

    match cli.command {
        Commands::Import { path } => {
            let results = wallflower_core::import::import_path(&db, &path)?;
            for r in results {
                println!("{}", r);
            }
        }
        Commands::List { format } => {
            let jams = wallflower_core::db::list_jams(&db.conn)?;
            // render based on format
        }
        Commands::Status => {
            let status = wallflower_core::status::get_status(&db.conn)?;
            println!("{}", status);
        }
    }
    Ok(())
}
```

### Folder Watcher with Debounce

```rust
// crates/wallflower-core/src/watcher/mod.rs
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use std::collections::HashMap;

pub fn start_watcher(
    watch_path: &Path,
    on_stable_file: impl Fn(&Path) + Send + 'static,
) -> Result<RecommendedWatcher> {
    let (tx, rx) = mpsc::channel();
    let debounce_duration = Duration::from_secs(5);

    let mut watcher = RecommendedWatcher::new(
        move |event: Result<Event, _>| {
            if let Ok(event) = event {
                let _ = tx.send(event);
            }
        },
        notify::Config::default(),
    )?;

    watcher.watch(watch_path, RecursiveMode::Recursive)?;

    // Debounce thread
    std::thread::spawn(move || {
        let mut pending: HashMap<PathBuf, Instant> = HashMap::new();
        loop {
            // Check for new events (non-blocking with timeout)
            while let Ok(event) = rx.try_recv() {
                if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                    for path in event.paths {
                        if is_audio_file(&path) {
                            pending.insert(path, Instant::now());
                        }
                    }
                }
            }
            // Check for stabilized files
            let now = Instant::now();
            pending.retain(|path, last_modified| {
                if now.duration_since(*last_modified) >= debounce_duration {
                    on_stable_file(path);
                    false // remove from pending
                } else {
                    true  // keep waiting
                }
            });
            std::thread::sleep(Duration::from_millis(500));
        }
    });

    Ok(watcher)
}
```

### Sync Folder Detection

```rust
// crates/wallflower-core/src/settings/mod.rs
pub fn is_in_sync_folder(path: &Path) -> Option<&'static str> {
    let path_str = path.to_string_lossy();
    let home = dirs::home_dir().unwrap_or_default();

    // Check for Dropbox
    if path_str.contains("/Dropbox/") || path.starts_with(home.join("Dropbox")) {
        return Some("Dropbox");
    }

    // Check for iCloud Drive
    if path_str.contains("/Library/Mobile Documents/") ||
       path_str.contains("/iCloud Drive/") {
        return Some("iCloud");
    }

    // Check for OneDrive
    if path_str.contains("/OneDrive/") || path.starts_with(home.join("OneDrive")) {
        return Some("OneDrive");
    }

    // Check for Google Drive
    if path_str.contains("/Google Drive/") || path_str.contains("/GoogleDrive/") {
        return Some("Google Drive");
    }

    None
}
```

### React Query + Tauri Invoke Pattern

```typescript
// src/hooks/use-jams.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { JamRecord, ImportResult } from '@/lib/types';

export function useJams() {
  return useQuery({
    queryKey: ['jams'],
    queryFn: () => invoke<JamRecord[]>('list_jams'),
  });
}

export function useImportFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paths: string[]) =>
      invoke<ImportResult[]>('import_files', { paths }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jams'] });
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| notify 7.x | notify 8.x (stable 8.2.0) | 2025 | CLAUDE.md references 7.x but current is 8.x; API changes in event handling |
| rusqlite 0.32.x | rusqlite 0.39.x | 2026 | CLAUDE.md references 0.32.x; current is 0.39.x; API is backward compatible |
| refinery 0.8.x | refinery 0.9.x | 2025 | Minor version bump; check for breaking changes in migration runner |
| Next.js 15.x | Next.js 16.x | 2026 | CLAUDE.md references 15.x; current stable is 16.2.4; static export unchanged |
| create-tauri-app v3 | create-tauri-app v4 | 2025 | Template structure may differ from older guides |
| Tauri 2.0 | Tauri 2.10.x | 2026 | Mature v2 release; IPC API stable |

**Version discrepancies from CLAUDE.md:**
- notify: CLAUDE.md says 7.x, actual latest is 8.2.0 -- use 8.x
- rusqlite: CLAUDE.md says 0.32.x, actual latest is 0.39.x -- use 0.39.x
- refinery: CLAUDE.md says 0.8.x, actual latest is 0.9.x -- use 0.9.x
- Next.js: CLAUDE.md says 15.x, actual latest is 16.2.4 -- use 16.x
- symphonia: CLAUDE.md says 0.6.x, actual latest stable is 0.5.5 (0.6.0 is alpha) -- use 0.5.x

## Open Questions

1. **Tauri workspace path configuration**
   - What we know: Tauri CLI expects `src-tauri/` by default. We want `crates/wallflower-app/`.
   - What's unclear: Whether `TAURI_APP_PATH` env var works reliably with `cargo tauri dev` in a workspace.
   - Recommendation: Test during scaffolding. If problematic, keep `src-tauri/` naming convention. The workspace structure still works with `src-tauri/` as a member name.

2. **DiskArbitration crate maturity**
   - What we know: `diskarbitration-sys` and `diskarbitration-rs` exist on GitHub. Neither has significant download counts.
   - What's unclear: Whether these crates are maintained and work with current Rust/macOS versions.
   - Recommendation: Plan a spike task to validate. Fallback: use `notify` to watch `/Volumes/` for new mount points (simpler but polling-based with slight latency).

3. **Tauri + axum co-hosting**
   - What we know: Tauri manages its own event loop. axum needs a tokio runtime.
   - What's unclear: Best pattern for running axum HTTP server alongside Tauri's process.
   - Recommendation: Use `tauri::async_runtime::spawn` to start the axum server on a background task within the Tauri process. Both share the tokio runtime.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust/cargo | All Rust code | -- | not installed | Must install via rustup |
| Node.js | Frontend build | Yes | v24.6.0 | -- |
| npm | Frontend deps | Yes | 11.5.1 | -- |
| Python 3 | ML sidecar (Phase 4+) | Yes | 3.14.3 | -- |
| Xcode CLT | Rust compilation on macOS | Yes | Xcode.app installed | -- |
| SQLite | Database (bundled in rusqlite) | Yes (system) | 3.51.0 | rusqlite bundles its own |
| protoc | gRPC codegen (Phase 4+) | -- | not installed | Not needed for Phase 1; install before Phase 4 |
| rustup/cargo | Rust toolchain management | -- | not installed | Must install: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |

**Missing dependencies with no fallback:**
- **Rust toolchain (rustup, cargo, rustc):** BLOCKING for Phase 1. Must be installed before any work begins. Installation: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

**Missing dependencies with fallback:**
- protoc: Not needed until Phase 4 (gRPC for Python sidecar). Can defer installation.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Rust) | cargo test (built-in) |
| Framework (Frontend) | vitest + @testing-library/react |
| Config file (Rust) | None needed -- cargo test works out of box |
| Config file (Frontend) | vitest.config.ts -- Wave 0 |
| Quick run command | `cargo test -p wallflower-core && npm test` |
| Full suite command | `cargo test --workspace && npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | Atomic import of WAV/FLAC/MP3 | integration | `cargo test -p wallflower-core --test import` | -- Wave 0 |
| STOR-02 | SQLite in correct app data path | unit | `cargo test -p wallflower-core db::tests` | -- Wave 0 |
| STOR-03 | Folder watcher triggers import | integration | `cargo test -p wallflower-core --test watcher` | -- Wave 0 |
| STOR-04 | USB device detection prompts import | manual | Manual -- requires physical USB device | -- |
| STOR-05 | 32-bit float WAV processing | unit | `cargo test -p wallflower-core import::metadata::tests` | -- Wave 0 |
| STOR-06 | DB is single portable file | unit | `cargo test -p wallflower-core db::tests::portable` | -- Wave 0 |
| STOR-07 | Temp-then-rename atomic writes | unit | `cargo test -p wallflower-core import::tests::atomic` | -- Wave 0 |
| INFRA-01 | RESTful API endpoints | integration | `cargo test -p wallflower-app --test api` | -- Wave 0 |
| INFRA-02 | CLI commands work standalone | integration | `cargo test -p wallflower-cli --test cli` | -- Wave 0 |
| INFRA-03 | Test coverage exists | meta | `cargo test --workspace` | -- Wave 0 |
| INFRA-04 | README updated | manual | Manual review | -- |
| INFRA-05 | Release generated | manual | `cargo tauri build` | -- |
| INFRA-06 | agents.md exists | manual | File existence check | -- |
| INFRA-07 | MIT license, no GPL | manual | `cargo deny check licenses` (if cargo-deny installed) | -- |
| INFRA-08 | Documentation accessible | manual | Manual review | -- |
| INFRA-09 | Native macOS app launches | e2e | `cargo tauri build && open target/release/bundle/macos/Wallflower.app` | -- |

### Sampling Rate
- **Per task commit:** `cargo test -p wallflower-core`
- **Per wave merge:** `cargo test --workspace && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- frontend test config
- [ ] `crates/wallflower-core/tests/` -- integration test directory
- [ ] `crates/wallflower-app/tests/` -- API integration tests
- [ ] `crates/wallflower-cli/tests/` -- CLI integration tests
- [ ] Frontend test setup: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] Rust test fixtures: sample WAV/FLAC/MP3 files for import testing (small files, < 1KB each)

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Tauri v2 native macOS app with Rust backend + React/Next.js frontend (static export in webview) + Python sidecar (Phase 4+)
- **Database:** SQLite -- single file, portable, fast queries for metadata
- **Recording priority:** Active recording preempts ALL other processing (Phase 3+, but architecture should not prevent this)
- **File safety:** Atomic writes, write-ahead patterns for recordings, sync-folder awareness
- **Licensing:** MIT for project code. No GPL dependencies in core. LGPL acceptable via dynamic linking.
- **Testing:** Full test coverage across all components. UAT at each phase.
- **Documentation:** README updated each phase. Release at each milestone. agents.md for captured feedback/skills.
- **GSD Workflow:** Do not make direct repo edits outside a GSD workflow unless explicitly asked to bypass.
- **Conventions:** Not yet established -- Phase 1 establishes them.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Next.js setup](https://v2.tauri.app/start/frontend/nextjs/) -- static export configuration, build commands
- [Tauri v2 IPC commands](https://v2.tauri.app/develop/calling-rust/) -- command definition, invoke(), state management, async patterns, error handling
- [Tauri v2 project structure](https://v2.tauri.app/start/project-structure/) -- default layout, workspace considerations
- [Tauri v2 create project](https://v2.tauri.app/start/create-project/) -- `npm create tauri-app@latest`
- [notify crate docs](https://docs.rs/notify) -- filesystem watcher API
- [refinery GitHub](https://github.com/rust-db/refinery) -- migration toolkit with rusqlite support
- [Rust Cookbook - SHA256 hashing](https://rust-lang-nursery.github.io/rust-cookbook/cryptography/hashing.html) -- streaming hash pattern
- [Apple DiskArbitration docs](https://developer.apple.com/documentation/diskarbitration) -- volume mount notification API

### Secondary (MEDIUM confidence)
- [diskarbitration-rs](https://github.com/roblabla/diskarbitration-rs) -- Rust bindings for DiskArbitration (low download count, needs validation)
- [diskarbitration-sys](https://github.com/herabit/disk-arbitration-sys) -- Raw bindings (alternative option)
- npm registry version checks -- verified all frontend package versions via `npm view`

### Tertiary (LOW confidence)
- [Tauri v2 + workspace discussions](https://github.com/orgs/tauri-apps/discussions/7592) -- community patterns for multi-binary workspaces (needs spike validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All crates verified on crates.io/npm, versions confirmed current
- Architecture: HIGH -- Tauri v2 patterns well-documented, workspace pattern is standard Cargo
- Pitfalls: HIGH -- Known issues from official docs and community experience
- USB detection: MEDIUM -- DiskArbitration Rust bindings exist but need validation
- Workspace + Tauri CLI: MEDIUM -- Non-default path needs testing during scaffolding

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days -- stable ecosystem, Tauri 2.x mature)
