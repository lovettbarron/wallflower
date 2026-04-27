# Wallflower

A local-first jam and sample manager for musicians who want to focus on creating music, not managing files. Wallflower records, imports, analyzes, and organizes musical explorations -- using local AI to automatically detect structure, separate sources, and tag metadata -- so you can quickly go from "I just finished a 2-hour jam" to "here's the interesting 8-bar synth loop in Bb minor at 120bpm" with minimal effort.

![Wallflower — jam detail view with waveform, bookmarks, and transport bar](docs/wallflower-demo.png)

## Download

**[Wallflower v0.2.0](https://github.com/lovettbarron/wallflower/releases/tag/v0.2.0)** -- macOS (Apple Silicon). Code-signed and notarized.

## Status

**v0.2.0 released** -- All 7 phases complete. Import, playback, recording, ML analysis, source separation, spatial explorer, accessibility, sample browser, and export.

## Features

### Sample Browser & Extract (Phase 7)
- Browse all bookmarks, loops, and detected sections across recordings in a searchable list
- Filter by key, tempo, duration range, tags, and source recording
- DAW-style sample browser with collapsible sidebar and sortable table
- Type-coded badges for bookmarks, loops, and sections
- Inline preview panel with waveform, constrained playback, and metadata
- Export samples or stems directly from the browser
- Keyboard navigation with arrow keys, Enter to select, Escape to close preview
- Delete recordings from the library with confirmation dialog

### Spatial Explorer & Accessibility (Phase 6)
- Spatial similarity explorer with force-directed graph visualization
- Accessibility retrofit: keyboard navigation, screen reader support, ARIA labels
- Skip-to-content link for keyboard users
- Auto-launch on login with first-launch dialog
- Section and loop overlays on waveform with click-to-play
- Audio interface selection with channel routing and live level meters

### Source Separation & Export (Phase 5)
- Bookmark regions on the waveform with drag-to-select and snap-to-section
- Bookmark management: list, edit, delete, color coding, context menu
- Export bookmarked audio as time-sliced WAV with JSON metadata sidecar
- Source separation via demucs-mlx (Apple Silicon optimized, 4-stem or 6-stem)
- Stem mixer panel with per-stem solo/mute and synchronized Web Audio playback
- Export all or selected stems to configurable folder
- Export settings: folder, format/bit-depth, model selection, memory limit
- Separation pauses during active recording (recording priority)
- Chunked processing with progress streaming and cancel support

### Analysis (Phase 4)
- Automatic tempo detection (BPM) via essentia TempoCNN
- Key/scale detection with confidence scoring
- Section boundary detection for structural analysis
- Loop detection for repeating patterns
- Beat grid alignment
- Manual override for tempo and key
- Background analysis queue with priority scheduling
- Python ML sidecar (gRPC) with lazy startup and health monitoring

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
- All files stored in user-accessible `~/wallflower/` (audio, exports -- easy to rsync/sync)
- Auto-import from watched folder (default `~/wallflower`) with 5-second debounce
- Exports folder excluded from auto-import
- USB audio recorder detection (Zoom F3 and similar devices)
- SQLite database with WAL mode for concurrent access
- Native macOS app (Tauri v2) with React frontend
- Standalone CLI for scripting and debugging
- HTTP API server for programmatic access

## Installation

### Pre-built (recommended)

Download the latest DMG from the [Releases page](https://github.com/lovettbarron/wallflower/releases). Open it and drag Wallflower to Applications. Requires macOS 13.0+ on Apple Silicon.

### Build from Source

**Prerequisites:** macOS, Rust toolchain ([rustup.rs](https://rustup.rs)), Node.js 20+, protobuf (`brew install protobuf`)

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
- ~~**Phase 4:** Audio analysis (key, tempo, sections) via Python ML sidecar~~ Done
- ~~**Phase 5:** Source separation (demucs-mlx on Apple Silicon)~~ Done
- ~~**Phase 6:** Spatial explorer, accessibility, distribution~~ Done
- ~~**Phase 7:** Sample browser & extract~~ Done

## License

MIT

## Links

- [andrewlb.com](https://andrewlb.com)
- [Project Repository](https://github.com/lovettbarron/wallflower)
