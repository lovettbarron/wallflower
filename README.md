# Wallflower

A local-first jam and sample manager for musicians who want to focus on creating music, not managing files. Wallflower records, imports, analyzes, and organizes musical explorations -- using local AI to automatically detect structure, separate sources, and tag metadata -- so you can quickly go from "I just finished a 2-hour jam" to "here's the interesting 8-bar synth loop in Bb minor at 120bpm" with minimal effort.

## Status

**Phase 3 complete** -- Recording engine with system integration. Phases 1-3 ship a fully functional record/import/browse/playback workflow.

## Features

### Recording (Phase 3)
- One-click recording from library view or global hotkey (Cmd+Shift+R)
- Crash-safe WAV writing with periodic flush/fsync -- recoverable on crash
- Live waveform visualization and input level meter during recording
- Silence detection with visual overlays on the recording waveform
- System tray icon with recording status and quick actions
- Device disconnect detection with automatic reconnection
- Edit metadata (tags, collaborators, instruments, notes, photos) while recording
- Recording settings: configurable silence threshold (-60dB to -20dB)
- Stop recording navigates to jam detail for immediate review

### Playback & Metadata (Phase 2)
- Timeline browser with date-grouped jam cards and waveform previews
- Dual waveform view: overview (full track) + detail (zoomed, scrollable)
- Audio playback with transport bar (play/pause, skip, scrub, time display)
- Editable jam title with auto-save
- Metadata editing: tags, collaborators, instruments, location, notes, patch notes
- Drag-and-drop photo attachment with thumbnails
- Autocomplete for tags, collaborators, and instruments
- Native macOS notifications via Tauri
- Design system: dark theme inspired by Mutable Instruments / Intellijel

### Foundation (Phase 1)
- Import WAV, FLAC, MP3 files with atomic copy-first operations (originals never modified)
- Duplicate detection via SHA-256 content hashing
- Auto-import from watched folder (default `~/wallflower`) with 5-second debounce
- USB audio recorder detection (Zoom F3 and similar devices)
- SQLite database with WAL mode for concurrent access
- Native macOS app (Tauri v2) with React frontend
- Standalone CLI for scripting and debugging
- HTTP API server for programmatic access

## Installation

### Prerequisites

- macOS (Apple Silicon recommended)
- Rust toolchain (install via [rustup.rs](https://rustup.rs))
- Node.js 20+ and npm

### Clone and Build

```bash
git clone https://github.com/lovettbarron/wallflower.git
cd wallflower
npm install
cargo build --workspace
```

### Run the App

```bash
# Development mode (Tauri app with hot reload)
cargo tauri dev

# Or run just the CLI
cargo run -p wallflower-cli -- help
```

## CLI Usage

```
wallflower import <path>     Import a file or directory
wallflower list              List all jams in the library
wallflower list --format json    Output as JSON
wallflower status            Show app status (jam count, watcher, storage)
wallflower settings          View all settings
wallflower settings <key>    View a specific setting
wallflower settings <key> <value>   Update a setting
wallflower devices           List connected audio recording devices
```

### Examples

```bash
# Import a recording from a Zoom F3
wallflower import /Volumes/ZOOM\ F3/STEREO/ZOOM0001.WAV

# Import an entire directory
wallflower import ~/Desktop/jam-session/

# Check what devices are connected
wallflower devices

# See library status
wallflower status
```

## Architecture

Wallflower is a Tauri v2 native macOS application with three Rust crates:

```
crates/
  wallflower-core/    Core library: database, import pipeline, settings,
                      folder watcher, device detection
  wallflower-app/     Tauri application: IPC commands, HTTP API, app state
  wallflower-cli/     CLI binary: git-style subcommands sharing wallflower-core
```

**Storage:** SQLite database at `~/Library/Application Support/wallflower/wallflower.db`. Audio files copied to `~/Library/Application Support/wallflower/audio/`.

**Frontend:** React/Next.js static export served in a Tauri WKWebView. Communicates with the Rust backend via Tauri IPC commands and an HTTP API on port 23516.

**Watch folder:** Default `~/wallflower`. New audio files are automatically imported after a 5-second debounce period.

## Development

```bash
# Run all tests
cargo test --workspace

# Run core library tests only
cargo test -p wallflower-core

# Run app in development mode
cargo tauri dev

# Build frontend static export
npm run build

# Release build
cargo build --release --workspace
```

## Roadmap

- ~~**Phase 1:** Foundation -- import, storage, CLI, Tauri shell~~ Done
- ~~**Phase 2:** Timeline UI, metadata editing, audio playback~~ Done
- ~~**Phase 3:** Recording with crash safety, silence detection~~ Done
- **Phase 4:** Audio analysis (key, tempo, sections) via Python ML sidecar
- **Phase 5:** Source separation (demucs-mlx on Apple Silicon)
- **Phase 6:** Spatial explorer, export to DAW, polish

## License

MIT

## Links

- [andrewlb.com](https://andrewlb.com)
- [Project Repository](https://github.com/lovettbarron/wallflower)
