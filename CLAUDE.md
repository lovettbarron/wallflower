<!-- GSD:project-start source:PROJECT.md -->
## Project

**Wallflower**

Wallflower is a local-first jam and sample manager for musicians who want to focus on creating music, not managing files. It records, imports, analyzes, and organizes musical explorations — using local AI to automatically detect structure, separate sources, and tag metadata — so musicians can quickly find and extract the interesting moments from long jam sessions for use in a DAW or sampler.

**Core Value:** A musician can go from "I just finished a 2-hour jam" to "here's the interesting 8-bar synth loop in Bb minor at 120bpm" with minimal effort, staying in creative flow rather than doing file management.

### Constraints

- **Tech stack**: Tauri v2 native macOS app with Rust backend (audio I/O, API, recording) + React/Next.js frontend (static export in webview, waveform UI, spatial explorer) + Python sidecar (ML models — demucs, analysis)
- **Database**: SQLite — single file, portable, fast queries for metadata
- **AI/ML**: All models run locally. Models downloaded at runtime, cached in user data directory, versioned for update-safe reuse. Model interface abstracted for forward compatibility.
- **Recording priority**: Active recording preempts ALL other processing. Task scheduler must support pause/resume of ML workloads.
- **File safety**: Atomic writes, write-ahead patterns for recordings, sync-folder awareness. Incremental writes for long recordings to prevent total data loss.
- **Licensing**: MIT for project code. No GPL dependencies in core. LGPL acceptable via dynamic linking. System tools like FFmpeg acceptable.
- **Testing**: Full test coverage across all components. UAT at each phase.
- **Documentation**: README updated each phase. Release at each milestone. agents.md for captured feedback/skills.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Rust Backend (Core Service)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **axum** | 0.8.x | HTTP/WebSocket API server | Most popular Rust web framework (2026), backed by Tokio team. Tower middleware ecosystem gives auth, compression, tracing for free. API-driven backend per project requirements. | HIGH |
| **tokio** | 1.x | Async runtime | Standard async runtime for Rust. axum, tonic, and most ecosystem crates depend on it. No real alternative. | HIGH |
| **cpal** | 0.17.x | Audio I/O (recording & playback) | Low-level cross-platform audio I/O in pure Rust. 8.7M+ downloads. Supports multi-channel capture, CoreAudio on macOS. Dedicated high-priority audio thread. Only real option for Rust audio I/O. | HIGH |
| **symphonia** | 0.6.x | Audio file decoding (WAV, FLAC, MP3) | Pure Rust multimedia decoder. Supports WAV, FLAC, MP3, OGG, AAC, ALAC. Performance within 15% of FFmpeg. Covers all import formats needed. | HIGH |
| **hound** | 3.5.x | WAV file writing | Purpose-built WAV encoder/decoder. Use for writing recorded audio to disk. Symphonia is better for reading diverse formats, hound is simpler for WAV writes. | HIGH |
| **rusqlite** | 0.32.x | SQLite database | Bundles SQLite into binary (no system dependency). Synchronous API is fine for a single-user desktop app -- async adds complexity without benefit here. 62M+ downloads. See rationale below. | HIGH |
| **tonic** | 0.14.x | gRPC server (Python sidecar IPC) | Production-ready gRPC with async/await. Protobuf codegen via prost. Language-agnostic: Python sidecar uses grpcio. | HIGH |
| **prost** | 0.13.x | Protobuf codegen | Standard protobuf for Rust, used by tonic. | HIGH |
| **notify** | 7.x | Filesystem watching | Cross-platform FS notification. 62M+ downloads. Used by cargo-watch, deno, rust-analyzer. macOS FSEvents backend for efficiency. Watch ~/wallflower and /Volumes for device mounts. | HIGH |
| **clap** | 4.x | CLI argument parsing | Standard for Rust CLIs. Needed for API-driven backend with CLI debugging per project requirements. | HIGH |
| **serde** / **serde_json** | 1.x | Serialization | De facto standard for Rust serialization. JSON API responses, config files. | HIGH |
| **tower-http** | 0.6.x | HTTP middleware | CORS, compression, tracing layers for axum. | HIGH |
| **tracing** | 0.1.x | Structured logging | Async-aware structured logging. Ecosystem standard with tokio/axum. | HIGH |
| **uuid** | 1.x | Unique identifiers | For jam/sample/export IDs. | HIGH |
### Frontend (React Web UI)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Next.js** | 15.x | React framework | Static export mode (`output: 'export'`) for local serving. File-based routing, good DX. Project already specifies Next.js. | HIGH |
| **React** | 19.x | UI framework | Project specifies React. v19 is current stable. | HIGH |
| **wavesurfer.js** | 7.11.x | Waveform display & scrubbing | De facto standard for audio waveform visualization. Regions plugin for section marking/bookmarking. Active development. | HIGH |
| **@wavesurfer/react** | 1.0.x | React integration for wavesurfer | Official React wrapper with hooks (useWavesurfer). Handles lifecycle and plugin memoization. | HIGH |
| **react-force-graph** | (2D) | Spatial explorer / similarity map | Force-directed graph visualization using d3-force + Canvas/WebGL. Supports zoom/pan, node dragging, clustering. Perfect for musical similarity spatial map. | MEDIUM |
| **d3** | 7.x | Data visualization utilities | Scales, color mappings, force simulation customization for spatial explorer. react-force-graph uses d3-force internally. | HIGH |
| **TypeScript** | 5.x | Type safety | Non-negotiable for a project this size. | HIGH |
| **Tailwind CSS** | 4.x | Styling | Rapid UI development, consistent design. Standard choice for Next.js projects. | HIGH |
| **zustand** | 5.x | Client state management | Lightweight, minimal boilerplate. Better than Redux for single-user local apps. Handles audio player state, filter state, UI state. | MEDIUM |
| **@tanstack/react-query** | 5.x | Server state / API data | Caching, refetching, optimistic updates for Rust backend API calls. Handles background processing status polling. | HIGH |
### Python ML Sidecar
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **demucs-mlx** | latest | Source separation | MLX port of HTDemucs optimized for Apple Silicon. 73x realtime on M4 -- separates 7-min song in ~12 seconds. Bit-exact with upstream PyTorch. Custom Metal kernels. Far superior to PyTorch MPS backend. | HIGH |
| **essentia** | 2.1-beta6 | Key, chord, tempo, tonal analysis | C++ library with Python bindings. Pre-trained TensorFlow models for tempo (TempoCNN), key, mood, genre. Comprehensive MIR feature set. More accurate than librosa for tonal features. | HIGH |
| **librosa** | 0.10.x | Audio loading, feature extraction | Standard Python audio library. Use for loading audio, computing spectrograms, onset detection. Essentia handles higher-level analysis. | MEDIUM |
| **grpcio** | 1.x | gRPC client (IPC with Rust) | Official Google gRPC Python library. Matches tonic on Rust side. Protobuf message passing for analysis requests/results. | HIGH |
| **mlx** | 0.x | Apple Silicon ML framework | Required by demucs-mlx. Apple's framework for ML on Apple Silicon, uses unified memory. | HIGH |
| **numpy** | 2.x | Numerical computing | Foundation for all audio/ML processing. | HIGH |
| **soundfile** | 0.13.x | Audio file I/O | For reading/writing audio in Python. PySoundFile wraps libsndfile. | HIGH |
### Infrastructure & Tooling
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Tauri** | 2.x | Desktop window (optional) | Wraps Next.js static export in native macOS window using WebKit. 96% smaller than Electron. Rust backend runs independently as a service; Tauri just provides the native window chrome. Consider for v2 -- browser works fine for v1. | MEDIUM |
| **protobuf** | 3.x | IPC schema definition | Language-neutral schema for Rust-Python communication. Shared .proto files generate code for both sides. | HIGH |
| **uv** | latest | Python package management | Fast Python package manager. Manages sidecar dependencies and virtual environment. | HIGH |
| **refinery** | 0.8.x | SQLite migrations (Rust) | Migration management for rusqlite. Embedded migrations compile into binary. | MEDIUM |
## Why NOT These Alternatives
### Database
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| SQLite ORM | **rusqlite** (direct) | Diesel | Diesel adds compile-time overhead, schema DSL complexity. For a single-user local app with straightforward queries, raw SQL via rusqlite is simpler and faster to iterate. Use refinery for migrations. |
| SQLite ORM | **rusqlite** | SeaORM | Async ORM adds unnecessary complexity for a desktop app. rusqlite's synchronous API is a feature, not a limitation, when you have one user. |
| SQLite ORM | **rusqlite** | SQLx | SQLx requires a running database at compile time for query checking. Adds CI complexity for marginal benefit in a local app. |
### Audio
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Audio I/O | **cpal** | rodio | Rodio is built on cpal but focuses on playback. cpal gives direct access to input devices for recording. Use cpal for capture, optionally rodio for simple playback. |
| Audio decode | **symphonia** | FFmpeg bindings | Symphonia is pure Rust, no system dependency. FFmpeg bindings (via ffmpeg-next) require FFmpeg installed, GPL concerns with some codecs. |
| WAV write | **hound** | symphonia | Symphonia is decode-focused. Hound is purpose-built for WAV encoding with clean API. |
### Frontend
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Waveform | **wavesurfer.js** | peaks.js | wavesurfer.js has larger community, better React integration, more active development. peaks.js is BBC-maintained but less flexible for custom UI. |
| Spatial viz | **react-force-graph** | D3 direct | react-force-graph handles Canvas/WebGL rendering, zoom/pan, interaction. Raw D3 force simulation requires significant boilerplate for React integration. |
| State mgmt | **zustand** | Redux Toolkit | Redux is overkill for single-user local app. Zustand has 1/10th the boilerplate. |
| Desktop wrapper | **Tauri** (later) | Electron | Electron bundles Chromium (150MB+). Tauri uses native WebKit (2-3MB). Since we already have a Rust backend, Tauri's Rust core is natural. |
### ML / Source Separation
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Source separation | **demucs-mlx** | PyTorch demucs | PyTorch MPS backend doesn't work with Demucs (complex tensor issues). demucs-mlx is 2.6x faster and purpose-built for Apple Silicon. |
| Source separation | **demucs-mlx** | demucs ONNX | ONNX conversion works but MLX is faster on Apple Silicon (custom Metal kernels vs generic CoreML EP). |
| Audio analysis | **essentia** | librosa only | Librosa lacks pre-trained models for key/chord detection. Essentia ships TensorFlow models (TempoCNN, key classifiers). Use both: librosa for loading, essentia for analysis. |
### IPC
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Rust-Python IPC | **gRPC (tonic + grpcio)** | Unix sockets (raw) | gRPC provides schema validation, streaming, codegen. Raw sockets require custom serialization protocol. gRPC streaming is ideal for progress reporting during long analysis jobs. |
| Rust-Python IPC | **gRPC** | REST/HTTP | gRPC has bidirectional streaming (progress updates), binary protobuf (efficient for metadata), and strong typing. HTTP/JSON works but gRPC is better for a tightly-coupled sidecar. |
| Rust-Python IPC | **gRPC** | ZeroMQ | ZeroMQ lacks schema/codegen. gRPC's .proto files serve as living documentation of the IPC contract. |
## Architecture Notes
### Rust Backend as Independent Service
- Headless operation (CLI mode, background recording)
- Independent lifecycle from the UI
- API-first design that supports future clients (mobile, different UIs)
- Tauri can optionally wrap the frontend later without changing the backend
### Frontend Delivery (v1)
### Python Sidecar Lifecycle
### Audio Data Flow for IPC
## Installation
# Rust backend
# Build dependencies
# Python sidecar
# Frontend
## Version Verification Sources
- cpal 0.17.3: [crates.io/crates/cpal](https://crates.io/crates/cpal)
- symphonia 0.6.x: [lib.rs/crates/symphonia](https://lib.rs/crates/symphonia)
- hound 3.5.1: [docs.rs/crate/hound/latest](https://docs.rs/crate/hound/latest)
- axum 0.8.x: [tokio.rs/blog/2025-01-01-announcing-axum-0-8-0](https://tokio.rs/blog/2025-01-01-announcing-axum-0-8-0)
- tonic 0.14.x: [crates.io/crates/tonic](https://crates.io/crates/tonic)
- rusqlite 0.32.x: [crates.io/crates/rusqlite](https://crates.io/crates/rusqlite) (version from 2026 comparison article)
- notify 7.x: [crates.io/crates/notify](https://crates.io/crates/notify)
- wavesurfer.js 7.11.x: [npmjs.com/package/wavesurfer.js](https://www.npmjs.com/package/wavesurfer.js)
- @wavesurfer/react 1.0.x: [npmjs.com/package/@wavesurfer/react](https://www.npmjs.com/package/@wavesurfer/react)
- react-force-graph: [github.com/vasturiano/react-force-graph](https://github.com/vasturiano/react-force-graph)
- demucs-mlx: [github.com/ssmall256/demucs-mlx](https://github.com/ssmall256/demucs-mlx/)
- essentia 2.1-beta6: [essentia.upf.edu](https://essentia.upf.edu/)
- Tauri 2.0: [v2.tauri.app](https://v2.tauri.app/)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
