# Phase 3: Recording Engine & System Integration - Research

**Researched:** 2026-04-19
**Domain:** Audio recording (cpal), crash-safe WAV writing (hound), Tauri v2 system tray & global shortcuts, priority scheduling
**Confidence:** HIGH

## Summary

Phase 3 adds real-time audio recording to Wallflower using cpal for audio capture and hound for WAV writing, with crash safety via periodic `flush()` calls that update the WAV header. The Tauri v2 system tray (built-in, no plugin needed) provides menubar status, and `tauri-plugin-global-shortcut` provides the global hotkey for recording toggle. Device disconnect handling requires custom monitoring since cpal does not expose a device hot-plug API -- the error callback on the input stream fires `StreamError::DeviceNotAvailable` when CoreAudio detects removal, and reconnection must be polled.

The recording architecture is a dedicated high-priority thread running the cpal input stream callback, writing samples to a `hound::WavWriter` wrapped in `Arc<Mutex<>>`. A separate flush timer calls `writer.flush()` every 5-10 seconds to update the WAV header, ensuring crash recoverability. On startup, incomplete WAV files (missing finalization) are detected and imported since `flush()` guarantees they are decodable up to the last checkpoint.

**Primary recommendation:** Build the recording engine as a `RecordingEngine` struct in `wallflower-core` that owns the cpal stream and hound writer, exposes start/stop/status methods, and communicates state changes via channels (crossbeam or tokio mpsc) to the Tauri app layer for UI updates and tray icon synchronization.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Recording controls extend the existing bottom transport bar. Record button added; when recording, bar transforms to show recording state (elapsed time, input levels, red accent, device info). One unified bar.
- **D-02:** Audio device selection uses system default input device automatically. Active device shown in transport bar. Users change device in Settings. No prompt before each recording.
- **D-03:** Silence detection marks silent sections visually in the waveform rather than pausing the recording. Silence threshold configurable in Settings.
- **D-04:** Playback is disabled while recording is active. Transport bar shows recording controls only.
- **D-05:** When a USB audio interface disconnects mid-recording, the session stays open and waits for reconnection. Same device reconnects within timeout -> recording resumes with gap marker. Timeout expires -> file saved and closed.
- **D-06:** On app startup, incomplete WAV files (missing final header) are automatically detected, repaired, and imported. Toast notification informs user.
- **D-07:** System tray icon shows recording state (idle vs recording icon). Click opens menu with: status/elapsed time, Start/Stop Recording, Open Wallflower, Quit.
- **D-08:** One global hotkey: Cmd+Shift+R for start/stop recording toggle. Only global shortcut.
- **D-09:** Global hotkey configurable in Settings.
- **D-10:** When recording starts, new jam created in DB, jam detail view opens automatically with live-updating waveform and full metadata editor below.
- **D-11:** While recording, user is locked to recording jam's detail view. Cannot browse or navigate away.
- **D-12:** Stop-recording confirmation uses modal dialog with Stop and Cancel. Keep Recording is auto-focused.
- **D-13:** All background processing pauses when recording starts, resumes when recording stops. Recording thread at elevated priority.

### Claude's Discretion
- WAV write strategy (REC-02 specifies periodic header updates with fsync every 5-10 seconds)
- Dropout reconnection timeout duration
- Gap marker implementation in the WAV file (silence padding vs metadata marker)
- fsync frequency tuning based on performance testing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REC-01 | Record audio from any connected audio interface with 1-4 channel support (default stereo) | cpal 0.17.x handles multi-channel capture via `SupportedStreamConfig`. Channel count from device config. |
| REC-02 | Incremental WAV writes with periodic header updates and fsync every 5-10 seconds | hound `WavWriter::flush()` updates WAV header to make file valid up to that point. Combine with `File::sync_data()`. |
| REC-03 | Graceful recovery from audio interface dropout without corrupting file | cpal error callback fires `StreamError::DeviceNotAvailable`. Flush before marking gap. Poll for device return. |
| REC-04 | Configurable silence threshold; mark silent sections visually | Compute RMS in audio callback, emit silence events when below threshold. Store as metadata, not WAV modification. |
| REC-05 | Edit metadata while recording, with live-save | Existing Phase 2 metadata editor + Tauri commands. Recording on separate thread, no contention. |
| REC-06 | Recording status clearly indicated at all times | Transport bar transformation (UI-SPEC), tray icon state, Tauri events for state sync. |
| REC-07 | Confirmation dialog before stopping recording | StopRecordingDialog component (UI-SPEC). Frontend-only, triggers Tauri command on confirm. |
| REC-08 | All AI/ML processing pauses during recording | Priority scheduler: broadcast channel or atomic flag checked by task runners before starting work. |
| REC-09 | Architecture supports expansion to 8 or 16 channels | cpal supports arbitrary channel counts. hound WavSpec accepts any channel count. Design recording engine with dynamic channel count from device config. |
| INFRA-10 | Menubar/system tray icon with recording status and quick actions | Tauri v2 built-in `TrayIconBuilder` with `tray-icon` feature. Native NSMenu on macOS. |
| INFRA-12 | Global keyboard shortcuts work when app not focused | `tauri-plugin-global-shortcut` v2.x. Register Cmd+Shift+R in Rust setup. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cpal | 0.17.3 | Audio input capture (CoreAudio on macOS) | Only real option for cross-platform Rust audio I/O. 8.7M+ downloads. Callback-driven, real-time safe. Already specified in CLAUDE.md. |
| hound | 3.5.1 | WAV file writing with crash-safe flush | Purpose-built WAV encoder with `flush()` that updates headers for checkpoint recovery. Already in wallflower-core Cargo.toml. |
| tauri (tray-icon feature) | 2.10.3 | System tray icon and native menu | Built into Tauri v2 core -- no separate plugin. TrayIconBuilder API with dynamic icon/menu updates. Already installed at 2.10.3. |
| tauri-plugin-global-shortcut | 2.x | Global keyboard shortcuts | Official Tauri plugin for system-wide hotkeys. Registers via Rust-side Builder with handler callback. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crossbeam-channel | 0.5.x | Lock-free channels for audio thread communication | Audio callback thread -> main thread state updates. Lower latency than std mpsc. |
| audio_thread_priority | latest | Elevate recording thread to real-time priority | Set QoS_CLASS_USER_INTERACTIVE on macOS for the cpal callback thread. Optional but recommended. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| hound flush() | Raw WAV header writes | hound already handles RIFF chunk sizes correctly; hand-rolling risks off-by-one in data chunk length |
| crossbeam-channel | tokio::sync::mpsc | Audio callback must be lock-free; tokio channels require async context. crossbeam is sync and wait-free for try_send. |
| Manual CoreAudio device monitoring | cpal device enumeration polling | cpal doesn't expose hot-plug callbacks. Polling `host.input_devices()` every 1-2s is simple and sufficient. |

**Installation:**
```bash
# In crates/wallflower-app/Cargo.toml
cargo add tauri-plugin-global-shortcut --target 'cfg(target_os = "macos")'

# In crates/wallflower-core/Cargo.toml
cargo add cpal crossbeam-channel
# (hound already present)
```

## Architecture Patterns

### Recommended Module Structure
```
crates/wallflower-core/src/
  recording/
    mod.rs           # RecordingEngine struct, start/stop/status
    writer.rs        # CrashSafeWriter wrapping hound::WavWriter with periodic flush
    device.rs        # Device enumeration, default device selection, disconnect detection
    silence.rs       # RMS-based silence detection with configurable threshold
    scheduler.rs     # Priority scheduler: pause/resume background tasks

crates/wallflower-app/src/
  commands/
    recording.rs     # Tauri commands: start_recording, stop_recording, get_recording_status
  tray.rs            # System tray setup, icon state management, menu construction
```

### Pattern 1: Audio Callback -> Channel -> State Machine

**What:** The cpal input stream callback runs on a high-priority audio thread. It must do minimal work: write samples to the WAV file and send level/status data via a lock-free channel. A separate "recording manager" task on the main async runtime processes these messages, updates state, and emits Tauri events to the frontend.

**When to use:** Always for real-time audio recording. The audio callback must never block.

**Example:**
```rust
use std::sync::{Arc, Mutex};
use crossbeam_channel::Sender;

pub enum RecordingEvent {
    LevelUpdate { rms_db: f32 },
    SilenceStart { offset_samples: u64 },
    SilenceEnd { offset_samples: u64 },
    DeviceError(String),
    SamplesWritten { total_samples: u64 },
}

struct AudioCallbackState {
    writer: Arc<Mutex<Option<hound::WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    event_tx: Sender<RecordingEvent>,
    silence_threshold_rms: f32,
    samples_written: u64,
    in_silence: bool,
}

// In the cpal input callback (runs on audio thread):
fn write_input_data<T: cpal::Sample + hound::Sample>(
    data: &[T],
    state: &mut AudioCallbackState,
) {
    // Write samples to WAV (hound uses BufWriter internally)
    if let Ok(mut guard) = state.writer.try_lock() {
        if let Some(writer) = guard.as_mut() {
            for &sample in data {
                let _ = writer.write_sample(sample);
            }
        }
    }

    // Compute RMS for level metering and silence detection
    // Send via try_send (non-blocking, drops if channel full)
    let _ = state.event_tx.try_send(RecordingEvent::LevelUpdate { rms_db: -20.0 });
}
```

### Pattern 2: Crash-Safe WAV Writer with Periodic Flush

**What:** A wrapper around `hound::WavWriter` that runs a timer to call `flush()` every N seconds, ensuring the WAV file is always decodable up to the last flush point.

**When to use:** For REC-02 crash safety.

**Example:**
```rust
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub struct CrashSafeWriter {
    writer: Arc<Mutex<Option<hound::WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    flush_interval: Duration,
}

impl CrashSafeWriter {
    /// Spawn a background thread that periodically flushes the WAV writer.
    /// The flush updates the RIFF/data chunk headers so the file is valid
    /// even if the process crashes after the flush.
    pub fn start_flush_timer(&self) {
        let writer = self.writer.clone();
        let interval = self.flush_interval;
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(interval);
                if let Ok(mut guard) = writer.lock() {
                    if let Some(w) = guard.as_mut() {
                        if let Err(e) = w.flush() {
                            tracing::error!("WAV flush failed: {e}");
                        }
                        // Also fsync the underlying file for durability
                        // (hound flushes BufWriter but doesn't fsync)
                    } else {
                        break; // Writer was taken (recording stopped)
                    }
                }
            }
        });
    }
}
```

### Pattern 3: Device Disconnect Detection via Error Callback + Polling

**What:** cpal does not provide a hot-plug API (issue #373 remains open). Device disconnection is detected via the stream error callback (`StreamError::DeviceNotAvailable` on CoreAudio). Reconnection is detected by polling `host.input_devices()` on a timer.

**When to use:** For D-05 (device disconnect/reconnect during recording).

**Example:**
```rust
// Error callback passed to build_input_stream
let err_fn = {
    let event_tx = event_tx.clone();
    move |err: cpal::StreamError| {
        match err {
            cpal::StreamError::DeviceNotAvailable => {
                let _ = event_tx.try_send(RecordingEvent::DeviceError(
                    "Device disconnected".into()
                ));
            }
            cpal::StreamError::BackendSpecific { err } => {
                tracing::error!("Audio backend error: {err}");
            }
        }
    }
};

// Reconnection polling (runs on async runtime, not audio thread)
async fn poll_for_device_reconnect(
    device_name: &str,
    timeout: Duration,
) -> Option<cpal::Device> {
    let start = Instant::now();
    let host = cpal::default_host();
    loop {
        if let Some(devices) = host.input_devices().ok() {
            for device in devices {
                if device.name().ok().as_deref() == Some(device_name) {
                    return Some(device);
                }
            }
        }
        if start.elapsed() > timeout {
            return None;
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}
```

### Pattern 4: Priority Scheduler (Recording Preemption)

**What:** A global flag (AtomicBool or broadcast channel) that background task runners check before starting work. When recording starts, the flag is set; background tasks yield or skip their next work unit.

**When to use:** For REC-08 / D-13.

**Example:**
```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct PriorityScheduler {
    recording_active: Arc<AtomicBool>,
}

impl PriorityScheduler {
    pub fn is_recording(&self) -> bool {
        self.recording_active.load(Ordering::Relaxed)
    }

    pub fn set_recording(&self, active: bool) {
        self.recording_active.store(active, Ordering::Release);
    }

    /// Background tasks call this before starting a work unit.
    /// Returns false if recording is active (task should yield).
    pub fn may_proceed(&self) -> bool {
        !self.is_recording()
    }
}
```

### Anti-Patterns to Avoid

- **Blocking in the audio callback:** Never lock a contended mutex, allocate memory, or do I/O in the cpal callback beyond the WAV write (which uses BufWriter and is effectively a memcpy most of the time). Use `try_lock()` and `try_send()`.
- **Flushing in the audio callback:** The periodic flush must happen on a separate thread, not in the audio callback. `flush()` does file I/O and potentially blocks.
- **Storing recording state only in the frontend:** Recording state (active/stopped/error) must live in the Rust backend as the source of truth. The frontend mirrors it via Tauri events.
- **Using async channels for audio data:** The audio callback is synchronous and time-critical. Use `crossbeam_channel` (sync, wait-free try_send), not `tokio::sync::mpsc`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAV file writing | Custom RIFF/WAV header encoder | hound 3.5.x | WAV format has subtle rules (padding bytes, chunk alignment, RIFF size limits). hound handles all of this correctly. |
| WAV crash recovery | Custom header repair code | hound `flush()` + standard WAV decoders | If `flush()` was called, the file IS valid. symphonia/hound can read it. Only need to detect "not finalized" (check if data chunk size matches file size). |
| System tray | Custom NSMenu via objc crate | Tauri TrayIconBuilder | Tauri wraps native tray APIs with clean Rust interface. Dynamic menu/icon updates are built-in. |
| Global shortcuts | Raw CGEventTap / IOKit | tauri-plugin-global-shortcut | The plugin handles registration, conflict detection, and cleanup. Cross-platform compatible. |
| Thread priority | Raw pthread calls | audio_thread_priority crate or cpal's built-in thread management | cpal already creates the audio callback on a high-priority thread via CoreAudio. Additional priority elevation is optional. |

**Key insight:** cpal already handles the hardest part (CoreAudio integration, sample format negotiation, callback thread management). The recording engine is primarily about orchestrating cpal + hound + state management, not low-level audio programming.

## Common Pitfalls

### Pitfall 1: Mutex Contention in Audio Callback
**What goes wrong:** The audio callback tries to lock a mutex held by the flush timer, causing audio dropouts (glitches, buffer underruns).
**Why it happens:** Both the audio callback and flush timer need access to the WavWriter.
**How to avoid:** Use `try_lock()` in the audio callback. If the lock is held (flush in progress), buffer samples in a small ring buffer and write on the next callback. Alternatively, use a double-buffer approach where the audio callback writes to a lock-free buffer and a separate writer thread drains it.
**Warning signs:** Periodic audio glitches correlated with flush interval.

### Pitfall 2: WAV File Size Limit
**What goes wrong:** WAV files have a 4GB limit (32-bit RIFF chunk size). A 2-hour stereo 32-bit float recording at 48kHz = ~2.6GB, so within limits, but 4-channel or longer recordings may exceed.
**Why it happens:** Standard WAV uses 32-bit unsigned integer for chunk sizes.
**How to avoid:** Monitor file size during recording. Warn user when approaching 3.5GB. Consider RF64 (64-bit WAV) for future expansion but standard WAV is fine for v1 given the channel/duration constraints.
**Warning signs:** File size > 3GB with channels > 2.

### Pitfall 3: Sample Format Mismatch
**What goes wrong:** Recording produces silence or noise because the cpal sample format doesn't match the hound write format.
**Why it happens:** cpal negotiates the format with CoreAudio (often f32 on macOS). hound needs to be configured with matching format.
**How to avoid:** Use `wav_spec_from_config()` pattern from cpal examples -- derive the hound WavSpec directly from cpal's `SupportedStreamConfig`. Always record in the device's native format, convert on export.
**Warning signs:** Silent or noisy recordings, sample format assertion failures.

### Pitfall 4: Device Reconnection Creates New Device ID
**What goes wrong:** After USB disconnect/reconnect, cpal may assign a different device ID or name. The reconnection polling fails to match.
**Why it happens:** CoreAudio assigns device IDs dynamically; USB re-enumeration may change them.
**How to avoid:** Match reconnected devices by name (human-readable, e.g., "Zoom F3") rather than internal device ID. Also match by channel count and sample rate as a secondary check.
**Warning signs:** Device reconnects but polling doesn't detect it.

### Pitfall 5: Missing fsync After flush()
**What goes wrong:** hound `flush()` updates the WAV header in the BufWriter but does NOT call `fsync()` on the underlying file. On crash, OS write cache may not have persisted the header update.
**Why it happens:** hound's `flush()` flushes the BufWriter to the OS, but OS may defer the actual disk write.
**How to avoid:** After calling `writer.flush()`, also call `file.sync_data()` on the underlying `File` handle. This requires either wrapping hound's writer or using `into_inner()` periodically (complex). A pragmatic approach: call `libc::fsync(fd)` on the file descriptor obtained at open time.
**Warning signs:** Recovered files truncated despite flush being called.

### Pitfall 6: Tauri Tray Icon Not Updating on macOS
**What goes wrong:** System tray icon or menu doesn't update when recording state changes.
**Why it happens:** Tray updates must happen on the main thread. If called from an async task or background thread without proper dispatch, updates may be silently dropped.
**How to avoid:** Use `app_handle.tray_icon_by_id()` to get the tray handle, then update via `set_icon()`, `set_menu()`. Tauri handles thread dispatch internally when using the AppHandle, but verify updates are visible.
**Warning signs:** Tray icon stuck in idle state during recording.

## Code Examples

### Setting Up the System Tray (Rust/Tauri)

```rust
// Source: Tauri v2 official docs (https://v2.tauri.app/learn/system-tray/)
use tauri::tray::TrayIconBuilder;
use tauri::menu::{Menu, MenuItem};
use tauri::image::Image;

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let start_i = MenuItem::with_id(app, "start_recording", "Start Recording", true, None::<&str>)?;
    let open_i = MenuItem::with_id(app, "open", "Open Wallflower", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Wallflower", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&start_i, &open_i, &quit_i])?;

    let _tray = TrayIconBuilder::new()
        .icon(Image::from_path("icons/tray-idle.png")?)
        .menu(&menu)
        .menu_on_left_click(true)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "start_recording" => { /* trigger recording start */ }
                "open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
```

### Registering the Global Shortcut (Rust/Tauri)

```rust
// Source: Tauri global-shortcut plugin docs (https://v2.tauri.app/plugin/global-shortcut/)
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn setup_global_shortcut(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut = Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyR);

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, sc, event| {
                if sc == &shortcut && event.state() == ShortcutState::Pressed {
                    // Toggle recording via app state
                }
            })
            .build(),
    )?;

    app.global_shortcut().register(shortcut)?;

    Ok(())
}
```

### Capabilities Configuration for Global Shortcut

```json
{
  "permissions": [
    "global-shortcut:allow-is-registered",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-register-all",
    "global-shortcut:allow-unregister-all"
  ]
}
```

### Required Cargo.toml Feature for Tray Icon

```toml
# In crates/wallflower-app/Cargo.toml
tauri = { version = "2", features = ["protocol-asset", "tray-icon", "image-png"] }
```

### Crash Recovery on Startup

```rust
// Detect incomplete WAV files in the storage directory
fn recover_incomplete_recordings(storage_dir: &Path) -> Vec<RecoveredRecording> {
    let mut recovered = vec![];

    for entry in std::fs::read_dir(storage_dir).into_iter().flatten() {
        let Ok(entry) = entry else { continue };
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("wav") {
            continue;
        }

        // Try to open with hound -- if it fails with "unexpected EOF"
        // but we can read some data, it's a crash-recovered file
        match hound::WavReader::open(&path) {
            Ok(reader) => {
                // File is valid -- may have been flushed but not finalized.
                // Check if it's already imported (by content hash).
                let duration = reader.duration() as f64 / reader.spec().sample_rate as f64;
                // If not in DB, it's a recovered recording
                recovered.push(RecoveredRecording { path, duration });
            }
            Err(hound::Error::FormatError(_)) => {
                // Truly corrupted -- skip
            }
            Err(_) => {
                // Other error -- skip
            }
        }
    }

    recovered
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cpal 0.15 synchronous API | cpal 0.17 callback-driven with error callbacks | 2024 | Error callbacks enable device disconnect detection |
| Manual WAV header writing | hound flush() for checkpointing | hound 3.5+ | Crash-safe recording without custom header code |
| Tauri v1 SystemTray plugin | Tauri v2 built-in TrayIconBuilder | Tauri v2 (2024) | No separate plugin needed for tray; it's part of tauri core with `tray-icon` feature |
| Tauri v1 global shortcuts (built-in) | Tauri v2 separate plugin (tauri-plugin-global-shortcut) | Tauri v2 (2024) | Must install plugin separately; permissions required in capabilities |

**Important version notes:**
- The project already has `hound = "3.5"` in wallflower-core's Cargo.toml -- no version change needed.
- cpal is NOT yet in any Cargo.toml -- must be added (0.17.x).
- Tauri is at 2.10.3 in the lock file. The `tray-icon` feature just needs to be added to the existing dependency.
- `tauri-plugin-global-shortcut` must be added as a new dependency.

## Open Questions

1. **fsync after hound flush**
   - What we know: hound `flush()` writes header to BufWriter and flushes BufWriter, but does not call `fsync()` on the file descriptor.
   - What's unclear: Whether macOS's CoreStorage/APFS write-through behavior makes fsync unnecessary for SSDs, or if explicit fsync is needed for crash durability.
   - Recommendation: Call `fsync()` via `libc::fsync()` using the file descriptor. The overhead (~1ms on SSD) is negligible at 5-10 second intervals. Better safe than sorry for music recordings.

2. **Gap marker format for device disconnection (D-05)**
   - What we know: Options are (a) write silence samples for the gap duration, or (b) store gap metadata in the database, not in the WAV file.
   - What's unclear: How to determine gap duration since we don't know the real-time offset when the device was disconnected.
   - Recommendation: Write silence padding for the gap (based on wall-clock time elapsed during disconnection). Store gap start/end timestamps in a `recording_gaps` DB table for UI rendering. This keeps the WAV file as a continuous audio stream while providing gap metadata for the waveform display.

3. **Reconnection timeout duration**
   - What we know: Must be long enough for USB re-enumeration (~3-5 seconds typical) but not so long the user waits forever.
   - Recommendation: 30-second default timeout. Configurable in Settings for users with flaky USB setups. After timeout, save and close the recording.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tauri v2 | App shell, tray, shortcuts | Yes | 2.10.3 | -- |
| Rust/Cargo | Backend build | Yes | (installed) | -- |
| CoreAudio | cpal audio I/O on macOS | Yes | System | -- |
| Node.js/npm | Frontend build | Yes | (installed) | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust built-in test framework (`#[cfg(test)]`) + cargo test |
| Config file | None -- uses default cargo test runner |
| Quick run command | `cargo test -p wallflower-core --lib` |
| Full suite command | `cargo test --workspace` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REC-01 | Record stereo audio from input device | integration (requires audio device) | manual-only: requires audio hardware | N/A |
| REC-02 | Periodic WAV flush creates valid intermediate file | unit | `cargo test -p wallflower-core recording::writer::tests -x` | Wave 0 |
| REC-03 | Device error callback triggers disconnect state | unit | `cargo test -p wallflower-core recording::device::tests -x` | Wave 0 |
| REC-04 | Silence detection below threshold | unit | `cargo test -p wallflower-core recording::silence::tests -x` | Wave 0 |
| REC-05 | Metadata editable during recording | integration (manual) | manual-only: requires running app | N/A |
| REC-06 | Recording status visible in transport | integration (manual) | manual-only: requires UI | N/A |
| REC-07 | Stop confirmation dialog appears | integration (manual) | manual-only: requires UI | N/A |
| REC-08 | Background tasks pause during recording | unit | `cargo test -p wallflower-core recording::scheduler::tests -x` | Wave 0 |
| REC-09 | Supports 1-4 channels in WavSpec | unit | `cargo test -p wallflower-core recording::writer::test_multichannel -x` | Wave 0 |
| INFRA-10 | System tray shows recording status | integration (manual) | manual-only: requires macOS tray | N/A |
| INFRA-12 | Global shortcut toggles recording | integration (manual) | manual-only: requires window focus test | N/A |

### Sampling Rate
- **Per task commit:** `cargo test -p wallflower-core --lib`
- **Per wave merge:** `cargo test --workspace`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `crates/wallflower-core/src/recording/mod.rs` -- recording engine module
- [ ] `crates/wallflower-core/src/recording/writer.rs` -- crash-safe writer with flush tests
- [ ] `crates/wallflower-core/src/recording/device.rs` -- device enumeration tests
- [ ] `crates/wallflower-core/src/recording/silence.rs` -- silence detection tests
- [ ] `crates/wallflower-core/src/recording/scheduler.rs` -- priority scheduler tests

## Sources

### Primary (HIGH confidence)
- [hound WavWriter docs](https://docs.rs/hound/latest/hound/struct.WavWriter.html) -- flush() API, crash safety semantics
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- TrayIconBuilder API, menu events, icon updates
- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- registration API, permissions, handler setup
- [cpal record_wav.rs example](https://github.com/RustAudio/cpal/blob/master/examples/record_wav.rs) -- canonical recording pattern with hound
- [cpal docs.rs](https://docs.rs/cpal/latest/cpal/) -- StreamError enum, device enumeration

### Secondary (MEDIUM confidence)
- [cpal issue #373](https://github.com/RustAudio/cpal/issues/373) -- Device hot-plug API not available (confirmed still open)
- [audio_thread_priority crate](https://docs.rs/audio_thread_priority/latest/audio_thread_priority/) -- real-time thread priority on macOS

### Tertiary (LOW confidence)
- CoreAudio device reconnection behavior after USB re-enumeration -- based on general knowledge of macOS audio subsystem, not verified with specific tests

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- cpal, hound, Tauri tray/shortcuts are the established solutions with official documentation verified
- Architecture: HIGH -- recording engine pattern (callback -> channel -> state machine) is well-established in audio programming
- Pitfalls: HIGH -- mutex contention, flush/fsync gap, device ID instability are all documented issues in the cpal/audio programming community
- Device hot-plug: MEDIUM -- cpal error callback behavior for CoreAudio device removal is documented but reconnection polling is a custom solution

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable libraries, low churn)
