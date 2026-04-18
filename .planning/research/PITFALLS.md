# Pitfalls Research

**Domain:** Local-first audio jam/sample manager with ML analysis (Rust + React + Python)
**Researched:** 2026-04-18
**Confidence:** HIGH (multiple pitfalls verified with official docs and community reports)

## Critical Pitfalls

### Pitfall 1: WAV Header Corruption on Crash During Recording

**What goes wrong:**
WAV files store their total data length in the RIFF header at the beginning of the file. If the application crashes, loses power, or the audio interface disconnects mid-recording, the header length fields are left at zero or an outdated value. The audio data is present in the file but the file appears corrupted or empty to any standard reader.

**Why it happens:**
The WAV format requires the total file size to be written in the header, which is only finalized when the file is closed. Developers write WAV files naively (open, write header with placeholder, append samples, update header on close) and never handle the "close never happened" case.

**How to avoid:**
- Use a headerless raw PCM format during active recording (e.g., `.raw` or `.pcm` with a sidecar JSON containing sample rate, bit depth, channel count). Convert to WAV only after recording completes cleanly.
- Alternatively, periodically flush and update the WAV header every N seconds (e.g., every 5-10 seconds) so that a crash loses at most that window of data. This requires seeking back to the header, updating the size fields, then seeking to the end to continue writing.
- Implement a "recovery" pass on startup that scans for `.raw` files without matching `.wav` files and offers to recover them.
- Use `fsync`/`fdatasync` after header updates to ensure data reaches disk.

**Warning signs:**
- No test for the "kill process during recording" scenario
- WAV header only written once at file close
- No recovery logic on application startup
- Recording tests that only cover clean stop/start cycles

**Phase to address:**
Phase 1 (Recording Foundation). This is the single most important reliability feature. A musician who loses a 2-hour jam will never trust the tool again.

---

### Pitfall 2: SQLite Database Corruption in Cloud Sync Folders

**What goes wrong:**
SQLite's official documentation explicitly warns: "Do not use SQLite on a network filesystem." Cloud sync tools (Dropbox, iCloud Drive) do not understand SQLite's file locking protocol. If the sync tool reads the database file while SQLite has it open in WAL mode, or if the sync tool writes a stale copy back while the app has the file open, the database corrupts silently. The WAL file and shared memory file (`-wal`, `-shm`) can get out of sync with the main database file when synced independently.

**Why it happens:**
Developers put the entire application data directory in `~/Dropbox` or `~/iCloud` for convenience, not realizing that SQLite requires POSIX locking semantics that cloud sync filesystems do not provide. The corruption is silent -- the app may work fine for weeks before a sync conflict destroys the database.

**How to avoid:**
- Store the SQLite database outside the sync folder. Use `~/Library/Application Support/wallflower/` or a similar OS-standard location.
- If the user's wallflower folder is inside a cloud sync folder, only store audio files and exported stems there. The database stays local.
- Implement database backup/export as a portable JSON or SQLite dump that CAN be synced safely (it is a static snapshot, not a live database).
- On startup, detect if the database path is inside a known cloud sync folder and warn the user.

**Warning signs:**
- Database path is configurable without sync-folder detection
- No documentation warning against placing DB in synced folders
- Users reporting "database is locked" errors intermittently
- Metadata disappearing or reverting to old values

**Phase to address:**
Phase 1 (Storage Architecture). The database location decision must be made before any data is stored. Changing it later means migration headaches.

---

### Pitfall 3: Demucs OOM on Long Recordings

**What goes wrong:**
Demucs memory usage scales super-linearly with audio duration. A 1-hour file consumes ~7 GB RAM; a 4-hour file exceeds 34 GB. On an M4 Mac Mini with 64 GB unified memory, a 2-hour stereo jam could consume 15-20 GB, and if the user has other apps open or multiple analyses queued, the system starts swapping or the Python process gets OOM-killed. The analysis produces no output and must restart from scratch.

**Why it happens:**
Developers pass the entire audio file to Demucs without chunking, or use Demucs's built-in segment parameter without understanding its memory implications. The default segment length may still be too large for available memory.

**How to avoid:**
- Always chunk audio before passing to Demucs. Use the overlap-add strategy from torchaudio's Hybrid Demucs tutorial: split into segments (e.g., 30-60 seconds), overlap by 1 second on each side with linear fade, process each segment independently, then combine.
- Monitor memory usage during processing and reduce segment size dynamically if pressure increases.
- Process at most one segment at a time, writing intermediate results to disk. This allows resuming after a crash without reprocessing the entire file.
- Set a hard memory budget (e.g., 8 GB for the Python sidecar) and choose segment sizes that fit within it.

**Warning signs:**
- No segment/chunk parameter in the Demucs invocation
- Processing works on 5-minute test files but never tested on 60+ minute files
- Python process memory grows monotonically during analysis
- No intermediate result checkpointing

**Phase to address:**
Phase with ML/Source Separation. Must be designed from the start of ML integration, not bolted on after "it works on short files."

---

### Pitfall 4: Browser Memory Exhaustion Loading Large Waveforms

**What goes wrong:**
wavesurfer.js decodes the entire audio file in the browser using Web Audio API. A 2-hour stereo WAV at 48kHz/32-bit is ~2.2 GB. The browser attempts to decode this into memory as Float32 PCM, requiring ~2.2 GB of JS heap. Chrome/Safari will either hang, crash the tab, or trigger an out-of-memory error. The user sees a blank waveform or a frozen UI.

**Why it happens:**
wavesurfer.js works perfectly for 3-5 minute songs, which is its primary use case. Developers prototype with short files and only discover the problem when real 60-120 minute jams are loaded.

**How to avoid:**
- Pre-compute waveform peaks on the Rust backend during import/recording. Use a tool like `audiowaveform` (BBC) or compute peaks directly in Rust by reading the audio in chunks and calculating min/max per pixel-bucket.
- Serve peaks as a compact binary or JSON file. wavesurfer.js supports loading pre-decoded peaks, bypassing Web Audio decoding entirely.
- Use the `MediaElement` backend in wavesurfer.js for playback (streams via HTML5 `<audio>` tag, no full decode).
- Implement a tiered zoom: low-resolution overview peaks for the full file, higher-resolution peaks loaded on demand for the visible viewport.

**Warning signs:**
- Waveform rendering uses `AudioContext.decodeAudioData()` on the full file
- No backend endpoint for serving pre-computed peaks
- Testing only with files under 10 minutes
- Browser DevTools shows multi-GB memory usage when opening a jam

**Phase to address:**
Phase with UI/Waveform display. The peaks pipeline must be built before the waveform UI, not after.

---

### Pitfall 5: Recording Priority Scheduler Race Conditions

**What goes wrong:**
When recording starts, ML processing must pause immediately. But "pause" is not atomic: a Demucs segment might be mid-computation, IPC messages might be in flight, the Python process might be holding a database write lock, or a file might be half-written. If the scheduler just kills the Python process, you get corrupted intermediate results, orphaned temp files, and a database left in a dirty state. If it waits for the current operation to finish, recording might start with a delay, missing the first seconds of audio.

**Why it happens:**
Developers implement priority as a simple boolean flag ("is_recording") checked at coarse intervals, without designing for the actual state machine of ML task lifecycle (queued -> running -> checkpointing -> complete). The recording path and the ML path share resources (disk I/O, database, CPU) in ways that create implicit coupling.

**How to avoid:**
- Design ML tasks as a state machine with explicit checkpointing. Each segment processed gets its result written to disk before starting the next segment. "Pause" means "finish the current segment checkpoint and stop."
- Use cooperative cancellation: the ML sidecar checks a "should_pause" flag between segments (not mid-segment). Segment processing time becomes your maximum pause latency, so keep segments short (10-30 seconds of audio).
- Recording starts immediately on a dedicated high-priority thread/process, independent of the ML scheduler. The scheduler sends a pause signal but does not block recording on ML acknowledgment.
- Never share the database write connection between the recording process and the ML sidecar. Use separate connections, or better, have the Rust backend be the sole writer and the Python sidecar communicate results via IPC.

**Warning signs:**
- ML pause is implemented as `process.kill()` or `SIGTERM` without cleanup
- No test for "start recording while ML is mid-segment"
- Recording has any dependency on ML process state
- Shared mutable state between recording and ML paths

**Phase to address:**
Phase with Task Scheduler / Recording. Must be designed when recording and ML are first integrated, not retrofitted.

---

### Pitfall 6: Rust-Python IPC Serialization Overhead for Audio Buffers

**What goes wrong:**
Naive IPC between Rust and Python (e.g., JSON over stdin/stdout, or REST API with base64-encoded audio) serializes and deserializes multi-megabyte audio buffers on every call. A 30-second stereo segment at 48kHz/32-bit is ~11 MB. JSON-encoding this as a float array balloons it to 50-100 MB. The serialization alone takes longer than the ML inference, and memory doubles (one copy in Rust, one in Python).

**Why it happens:**
Developers start with the simplest possible IPC (JSON over HTTP or stdio) because it is easy to debug, then never optimize it. The overhead is invisible with small test files but dominates with real audio.

**How to avoid:**
- Use file-based handoff for audio: Rust writes the audio segment to a temporary WAV/raw file, passes the file path to Python via a lightweight message (JSON over Unix socket or stdin). Python reads the file directly with `soundfile` or `torchaudio`. This is simple, debuggable, and zero-copy from a memory perspective (each process only holds one copy).
- For higher performance later: use shared memory (`mmap`) with a ring buffer. Rust writes audio data to a shared memory region, Python reads it directly via `numpy` backed by `mmap`. Libraries like `shared_memory` (Python) and `shared_memory` crate (Rust) support this.
- Avoid gRPC/protobuf for the audio payload itself -- the protobuf encoding of large byte arrays still copies. Use gRPC only for control messages and pass audio via shared memory or files.

**Warning signs:**
- Audio data is base64-encoded or JSON-serialized
- IPC latency grows linearly with audio segment size
- Memory profiling shows 2-3 copies of the same audio buffer
- Python sidecar startup time dominates short segment processing

**Phase to address:**
Phase with ML Integration / IPC design. The IPC contract should be designed before the first ML feature ships.

---

### Pitfall 7: Audio Interface Dropout Destroys Recording Continuity

**What goes wrong:**
USB audio interfaces (and even the Zoom F3 when connected as an interface) can disconnect momentarily due to USB bus resets, macOS audio server restarts, or cable issues. CPAL's error callback fires `StreamError::DeviceNotAvailable`. If the application treats this as a fatal error and stops recording, the musician loses everything recorded so far (if the file is not properly finalized) or loses the rest of the session. If the application tries to reconnect immediately, it may get a different device configuration (different sample rate, buffer size) and corrupt the recording.

**Why it happens:**
Audio device disconnection is an edge case that developers rarely test. CPAL provides error callbacks but the "what do you do next" logic is entirely up to the application.

**How to avoid:**
- On device disconnection: immediately finalize the current recording file (update WAV header or convert raw PCM). Do not try to append to the same file after reconnection.
- Start a new recording file with a naming convention that links it to the original session (e.g., `session_001_part2.wav`).
- Attempt to reconnect to the same device (by name/ID) with the same configuration. If successful, start recording to the new part file.
- In the UI, show a clear "Recording interrupted -- reconnecting" state. Keep the recording session metadata (start time, tags, notes) active.
- On playback/import, automatically detect multi-part recordings and present them as a single session with a gap marker.

**Warning signs:**
- No error callback handler in the audio stream setup
- Tests only run with stable audio devices
- No multi-part recording concept in the data model
- Disconnection immediately shows an error dialog and stops

**Phase to address:**
Phase 1 (Recording Foundation). This must be handled from day one, as interface dropouts are common in real studio/rehearsal environments.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single WAV file per recording (no chunking/raw format) | Simpler file handling | Total data loss on crash, no crash recovery | Never for recordings >5 minutes |
| JSON-over-HTTP for Rust-Python IPC | Easy to debug, quick to implement | 5-10x overhead on audio transfer, blocks UI during large transfers | Early prototyping only, replace before ML features ship |
| Loading full audio in browser for waveform | Simple wavesurfer.js setup | Browser crashes on files >20 minutes | Never for a jam manager targeting 120-minute files |
| Single SQLite connection shared across processes | No need to design IPC for DB access | SQLITE_BUSY errors, potential corruption under concurrent writes | Never with multi-process architecture |
| Hardcoded Demucs model without chunking | Works for short demos | OOM kills on real recordings, no resume capability | Only in initial spike/proof-of-concept |
| Storing everything in user-chosen folder | User controls file location | SQLite corruption if folder is cloud-synced | Only for audio files, never for the database |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CPAL (Rust audio) | Assuming callback buffer sizes are fixed; allocating in the audio callback | Pre-allocate ring buffer; accept variable callback sizes; never allocate, lock, or do I/O in the callback |
| wavesurfer.js | Using `decodeAudioData` on full file | Pre-compute peaks server-side; use `MediaElement` backend for playback |
| Demucs (Python) | Passing entire file without segment parameter | Use torchaudio chunked processing with overlap-add; set explicit segment length |
| SQLite WAL mode | Expecting multiple processes to write concurrently | Use WAL mode but funnel ALL writes through the Rust backend; Python sidecar sends results via IPC, never writes DB directly |
| Dropbox/iCloud | Storing SQLite DB in sync folder | Store DB in `~/Library/Application Support/`; only sync audio files and exports |
| ONNX Runtime + CoreML | Assuming ONNX models automatically use Neural Engine | Must explicitly convert models to CoreML format for Neural Engine; ONNX Runtime's CoreML EP has operator coverage gaps |
| Zoom F3 files | Assuming standard 16/24-bit WAV | Zoom F3 outputs 32-bit float WAV; must handle float-to-int conversion explicitly when downsampling |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Decoding audio in browser | Tab freezes, "page unresponsive" dialog | Pre-computed peaks, streaming playback | Files > 15-20 minutes |
| Unbounded WAL file growth | Disk space exhaustion, slow queries | Periodic checkpointing, ensure reader gaps | When ML sidecar holds long-running read transactions during analysis |
| Python process cold start | 3-5 second delay loading PyTorch + models | Keep Python sidecar running as a long-lived process; lazy-load models on first use | Every time ML is needed if sidecar is spawned per-task |
| Full-file source separation | 15+ minutes processing, 7+ GB RAM for 1 hour | Chunked processing with 30-60 second segments | Files > 10-15 minutes |
| Synchronous model download on first launch | App appears frozen/broken for 5-10 minutes | Background download with progress UI; features light up as models become available | First launch, or after clearing cache |
| Re-analyzing unchanged files | Wasted CPU/time on app restart | Content-hash audio files; skip analysis if hash matches existing DB record | After importing large back-catalog |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocking UI during model download | User thinks app is broken on first launch, force-quits | Show explicit download progress; make recording available immediately (no ML needed to record) |
| Silent ML failure | User waits for analysis that will never complete | Show per-file analysis status; surface errors with retry button; log errors for debugging |
| No progress indication for long analysis | User doesn't know if 45-minute analysis is stuck or just slow | Show segment-level progress (e.g., "Analyzing segment 3/24") |
| Requiring all models before any features work | First launch is a 10+ minute wait | Progressive feature enablement: recording works immediately, then metadata analysis, then source separation as models download |
| Showing raw file paths instead of session names | Musician sees "2024-01-15_jam_zoom_f3_tr12.wav" instead of something meaningful | Auto-generate session names from date/time; let user rename; show metadata prominently |
| Complex audio format settings | Musician doesn't know what "48kHz 32-bit float" means | Sensible defaults; hide advanced settings; explain in musician terms ("studio quality", "smaller files") |

## "Looks Done But Isn't" Checklist

- [ ] **Recording:** Often missing crash recovery -- verify by killing the process mid-recording and checking if audio is recoverable
- [ ] **Recording:** Often missing interface dropout recovery -- verify by unplugging USB audio device mid-recording
- [ ] **Source separation:** Often missing chunked processing -- verify by running on a 60+ minute file and monitoring memory
- [ ] **Waveform display:** Often missing pre-computed peaks -- verify by opening a 60-minute file and checking browser memory usage
- [ ] **Model download:** Often missing retry/resume on network failure -- verify by interrupting download mid-stream
- [ ] **Database:** Often missing WAL checkpoint management -- verify by running analysis on 10 files and checking WAL file size
- [ ] **File import:** Often missing duplicate detection -- verify by importing the same file twice
- [ ] **Export:** Often missing metadata embedding -- verify that exported WAV/AIFF contains tempo/key tags readable by Ableton
- [ ] **Priority scheduler:** Often missing clean pause/resume -- verify by starting recording while ML is mid-analysis and checking intermediate results are not corrupted

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WAV header corruption | LOW | Scan raw PCM data, reconstruct header from sidecar metadata (sample rate, channels, bit depth), re-wrap as WAV |
| SQLite corruption from sync | HIGH | Restore from last backup; if no backup, attempt `.recover` command in sqlite3 CLI; rebuild from audio files + re-analysis |
| Demucs OOM mid-analysis | MEDIUM | Restart with smaller segment size; re-process from last completed segment if checkpointing was implemented |
| Lost recording from crash | UNRECOVERABLE | If no incremental writes or raw PCM file exists, the audio is gone. This is why crash safety is critical pitfall #1. |
| Browser tab crash from large waveform | LOW | Refresh page; implement peaks pipeline to prevent recurrence |
| Corrupted intermediate ML results | LOW | Delete intermediate files, re-queue analysis; design for idempotent re-processing |
| Audio interface dropout | MEDIUM | If multi-part recording implemented: stitch parts. If not: partial recording saved up to last flush point. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WAV header corruption on crash | Phase 1: Recording Foundation | Kill-test: `kill -9` the process during a 10-minute recording; verify file is recoverable |
| SQLite in sync folder | Phase 1: Storage Architecture | Store DB in app support dir; detect sync folders on startup; unit test path detection |
| Demucs OOM on long files | ML Integration Phase | Memory-profiled test on 60-minute file; peak RSS stays under 8 GB |
| Browser waveform memory | UI/Waveform Phase | Open 120-minute file in browser; tab RSS stays under 500 MB |
| Recording priority races | Recording + ML Integration Phase | Start recording during active analysis; verify recording starts within 100ms and analysis resumes after |
| IPC serialization overhead | ML Integration Phase | Benchmark: 30-second audio segment IPC roundtrip < 100ms |
| Audio interface dropout | Phase 1: Recording Foundation | Unplug USB audio during recording; verify partial recording saved and new part started on reconnect |
| Model download blocking | ML Integration Phase | First launch with no cached models; verify recording is available within 5 seconds of app start |
| WAL file growth | Storage Architecture Phase | Run 50 sequential analyses; verify WAL file stays under 100 MB via periodic checkpointing |
| Full-file source separation | ML Integration Phase | Process 120-minute file; verify chunked with intermediate results on disk |

## Sources

- [SQLite: How To Corrupt An SQLite Database File](https://sqlite.org/howtocorrupt.html)
- [SQLite: Write-Ahead Logging](https://sqlite.org/wal.html)
- [SQLite: Using SQLite Over a Network, Caveats and Considerations](https://sqlite.org/useovernet.html)
- [SQLite concurrent writes and "database is locked" errors](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- [Demucs GitHub Issue #498: Too high memory usage with long audio](https://github.com/facebookresearch/demucs/issues/498)
- [Demucs GitHub Issue #231: CUDA out of memory with long tracks](https://github.com/facebookresearch/demucs/issues/231)
- [Torchaudio: Music Source Separation with Hybrid Demucs](https://docs.pytorch.org/audio/stable/tutorials/hybrid_demucs_tutorial.html)
- [wavesurfer.js Issue #1563: Large audio files loading too slow](https://github.com/katspaugh/wavesurfer.js/issues/1563)
- [wavesurfer.js FAQ: Pre-decoded peaks for large files](https://wavesurfer.xyz/faq/)
- [CPAL GitHub: Buffer underrun handling](https://github.com/RustAudio/cpal/issues/460)
- [RustAudio/cpal releases and changelog](https://github.com/RustAudio/cpal/releases)
- [ONNX Runtime CoreML Execution Provider](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html)
- [Atuin Issue #2356: SQLite database corruption on network filesystem](https://github.com/atuinsh/atuin/issues/2356)
- [wavfix: Repair broken WAV files](https://github.com/agfline/wavfix)
- [Centricular: Audio source separation in GStreamer with Demucs](https://centricular.com/devlog/2025-12/demucs/)
- [Abusing SQLite to Handle Concurrency (SkyPilot)](https://blog.skypilot.co/abusing-sqlite-to-handle-concurrency/)

---
*Pitfalls research for: Wallflower -- local-first audio jam/sample manager*
*Researched: 2026-04-18*
