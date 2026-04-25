---
phase: quick
plan: 260425-jzp
type: execute
wave: 1
depends_on: []
files_modified:
  - crates/wallflower-core/src/recording/device.rs
  - crates/wallflower-core/src/recording/mod.rs
  - crates/wallflower-core/src/settings/mod.rs
  - crates/wallflower-app/src/commands/recording.rs
  - crates/wallflower-app/src/commands/settings.rs
  - crates/wallflower-app/src/commands/mod.rs
  - crates/wallflower-app/src/lib.rs
  - src/lib/types.ts
  - src/lib/tauri.ts
  - src/components/settings/SettingsPage.tsx
  - src/components/settings/AudioDeviceSettings.tsx
autonomous: true
requirements: [QUICK-audio-interface-selection]

must_haves:
  truths:
    - "User can see a list of available audio input devices in Settings"
    - "User can select a preferred recording device"
    - "User can set how many channels to record"
    - "User can map physical input channels to recording slots"
    - "Recording uses the selected device instead of always the system default"
    - "Preferences persist across app restarts"
  artifacts:
    - path: "crates/wallflower-core/src/recording/device.rs"
      provides: "Device lookup by name, supported configs enumeration"
    - path: "crates/wallflower-core/src/settings/mod.rs"
      provides: "Audio device preference fields in AppConfig"
    - path: "crates/wallflower-core/src/recording/mod.rs"
      provides: "RecordingEngine.start() with device selection and channel mapping"
    - path: "src/components/settings/AudioDeviceSettings.tsx"
      provides: "Audio interface settings UI component"
  key_links:
    - from: "src/components/settings/AudioDeviceSettings.tsx"
      to: "list_audio_devices + get_settings + update_settings"
      via: "Tauri invoke"
    - from: "crates/wallflower-app/src/commands/recording.rs (start_recording)"
      to: "RecordingEngine.start()"
      via: "reads preferred device from AppConfig, passes to engine"
---

<objective>
Add audio interface selection for recording. Users should be able to pick which audio input device to record from (instead of always using the system default), configure the number of recording channels, and assign physical input channels to recording slots. Preferences persist in SQLite settings.

Purpose: Musicians with multi-channel audio interfaces (e.g., Zoom recorders, Focusrite Scarlett) need to select which device and channels to use for recording. Currently Wallflower always grabs the macOS default input device with its default config.

Output: Backend device selection + channel mapping in RecordingEngine, persisted preferences in settings, Settings page UI for device/channel configuration.
</objective>

<execution_context>
@/Users/andrewlovettbarron/.claude/get-shit-done/workflows/execute-plan.md
@/Users/andrewlovettbarron/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@crates/wallflower-core/src/recording/device.rs
@crates/wallflower-core/src/recording/mod.rs
@crates/wallflower-core/src/settings/mod.rs
@crates/wallflower-app/src/commands/recording.rs
@crates/wallflower-app/src/commands/settings.rs
@crates/wallflower-app/src/lib.rs
@src/lib/types.ts
@src/lib/tauri.ts
@src/components/settings/SettingsPage.tsx
@src/lib/stores/recording.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From crates/wallflower-core/src/recording/device.rs:
```rust
pub struct InputDeviceInfo {
    pub name: String,
    pub channel_count: u16,
    pub sample_rate: u32,
    pub is_default: bool,
}
pub fn list_input_devices() -> Vec<InputDeviceInfo>;
pub fn get_default_cpal_device() -> Option<cpal::Device>;
pub fn poll_for_device_reconnect(device_name: &str, timeout: Duration) -> Option<cpal::Device>;
```

From crates/wallflower-core/src/recording/mod.rs:
```rust
pub struct RecordingConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub silence_threshold_db: f32,
    pub flush_interval_secs: u64,
    pub reconnect_timeout_secs: u64,
}
pub struct RecordingEngine { ... }
impl RecordingEngine {
    pub fn new(config: RecordingConfig, event_tx: Sender<RecordingEvent>, scheduler: PriorityScheduler) -> Self;
    pub fn start(&self, storage_dir: &Path, jam_id: &str) -> anyhow::Result<()>;
    pub fn stop(&self) -> anyhow::Result<PathBuf>;
}
```

From crates/wallflower-core/src/settings/mod.rs:
```rust
pub struct AppConfig {
    pub watch_folder: PathBuf,
    pub storage_dir: PathBuf,
    pub duplicate_handling: String,
    pub silence_threshold_db: f32,
    pub export_root: PathBuf,
    pub export_format: String,
    pub export_bit_depth: i32,
    pub separation_model: String,
    pub separation_memory_limit_gb: i32,
}
pub fn load_config(conn: &Connection) -> Result<AppConfig>;
pub fn save_config(conn: &Connection, config: &AppConfig) -> Result<()>;
```

From crates/wallflower-app/src/commands/recording.rs:
```rust
pub async fn start_recording(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<StartRecordingResult, String>;
pub async fn list_audio_devices() -> Result<Vec<device::InputDeviceInfo>, String>;
```

Settings are stored via db::get_setting/set_setting key-value pairs in SQLite.
The existing update_settings command does partial updates from a JSON value.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend -- device selection, channel mapping, and settings persistence</name>
  <files>
    crates/wallflower-core/src/recording/device.rs,
    crates/wallflower-core/src/recording/mod.rs,
    crates/wallflower-core/src/settings/mod.rs
  </files>
  <action>
**device.rs -- Add device lookup and extended info:**

1. Add a new struct `InputDeviceDetail` that extends `InputDeviceInfo` with supported configurations:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceDetail {
    pub name: String,
    pub channel_count: u16,        // max channels from default config
    pub sample_rate: u32,          // default sample rate
    pub is_default: bool,
    pub supported_channel_counts: Vec<u16>,  // all supported channel counts
    pub supported_sample_rates: Vec<u32>,    // common supported sample rates
}
```

2. Add `get_cpal_device_by_name(name: &str) -> Option<cpal::Device>` -- iterates `host.input_devices()`, returns first match by name. Falls back to default device if name not found (with tracing::warn).

3. Add `get_device_detail(name: &str) -> Option<InputDeviceDetail>` -- gets the device by name, queries `supported_input_configs()` to extract the range of supported channel counts and sample rates. For supported_channel_counts, collect unique channel values from all supported configs. For supported_sample_rates, intersect with common rates [44100, 48000, 88200, 96000, 176400, 192000].

4. Add `list_input_devices_detailed() -> Vec<InputDeviceDetail>` -- like `list_input_devices()` but returns `InputDeviceDetail` with supported configs.

**mod.rs -- Accept device name and channel mapping in start():**

1. Add a `ChannelMapping` struct:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelMapping {
    /// Number of channels to write to the output WAV file
    pub output_channels: u16,
    /// Maps output channel index -> physical input channel index.
    /// Length must equal output_channels. Values are 0-based indices
    /// into the device's physical input channels.
    /// Example: [0, 1] = stereo from first two inputs
    /// Example: [2, 3] = stereo from inputs 3 and 4
    /// Example: [0] = mono from input 1
    pub channel_map: Vec<u16>,
}
```

2. Modify `RecordingEngine::start()` signature to:
```rust
pub fn start(
    &self,
    storage_dir: &Path,
    jam_id: &str,
    device_name: Option<&str>,
    channel_mapping: Option<&ChannelMapping>,
) -> anyhow::Result<()>
```

3. In `start()` implementation:
   - If `device_name` is Some, use `device::get_cpal_device_by_name(name)` instead of `device::get_default_cpal_device()`. If the named device isn't found, log a warning and fall back to default.
   - If `channel_mapping` is Some, use it to determine the WAV spec channels (`output_channels`) and remap samples in the data callback. The data callback receives interleaved samples from the device (N physical channels). For each frame, extract only the channels specified by `channel_map` and write those to the WAV writer. For example, if the device has 8 channels and channel_map is [2, 3], extract channels at indices 2 and 3 from each frame.
   - If `channel_mapping` is None, behave as before (write all channels from the device's default config).
   - The stream_config should use the device's full channel count (so we receive all physical channels), but the WavSpec should use `output_channels` from the mapping.
   - Update silence detection to use the mapped channel count (not the device's physical channel count) for frame calculations.

**settings/mod.rs -- Add audio device preference fields:**

1. Add three new fields to `AppConfig`:
```rust
/// Preferred recording input device name. None = system default.
pub recording_device_name: Option<String>,
/// Preferred number of recording channels. None = device default.
pub recording_channels: Option<u16>,
/// Channel mapping: JSON-encoded array of physical channel indices.
/// e.g. "[0, 1]" means output ch0 = physical ch0, output ch1 = physical ch1.
/// None = identity mapping (use first N channels).
pub recording_channel_map: Option<Vec<u16>>,
```

2. In `load_config()`, load these from settings table:
   - `recording_device_name`: `db::get_setting(conn, "recording_device_name")?` (String or None)
   - `recording_channels`: `db::get_setting(conn, "recording_channels")?.and_then(|v| v.parse::<u16>().ok())`
   - `recording_channel_map`: `db::get_setting(conn, "recording_channel_map")?.and_then(|v| serde_json::from_str::<Vec<u16>>(&v).ok())`

3. In `save_config()`, persist these fields:
   - For `recording_device_name`: store as string or empty string for None
   - For `recording_channels`: store as string
   - For `recording_channel_map`: store as JSON string via `serde_json::to_string()`

4. Update the `Default`-like behavior: when these settings keys are missing from the DB, they default to None (which means "use system default" / "use device default" / "identity mapping").

5. Update the test `test_ensure_storage_dir` and any other tests that construct `AppConfig` directly to include the new fields.
  </action>
  <verify>
    <automated>cd /Users/andrewlovettbarron/src/wallflower && cargo test -p wallflower-core -- --nocapture 2>&1 | tail -30</automated>
  </verify>
  <done>
    - `get_cpal_device_by_name()` resolves a device by name with fallback to default
    - `InputDeviceDetail` struct includes supported channel counts and sample rates
    - `RecordingEngine::start()` accepts optional device_name and channel_mapping
    - Channel remapping in the audio callback correctly extracts specified channels
    - AppConfig has recording_device_name, recording_channels, recording_channel_map fields
    - Settings load/save round-trips the new fields through SQLite
    - All existing wallflower-core tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Tauri commands and frontend wiring -- device preferences + recording integration</name>
  <files>
    crates/wallflower-app/src/commands/recording.rs,
    crates/wallflower-app/src/commands/settings.rs,
    crates/wallflower-app/src/commands/mod.rs,
    crates/wallflower-app/src/lib.rs,
    src/lib/types.ts,
    src/lib/tauri.ts
  </files>
  <action>
**commands/recording.rs -- Wire device preferences into start_recording:**

1. Add a new command `list_audio_devices_detailed` that returns `Vec<InputDeviceDetail>`:
```rust
#[tauri::command]
pub async fn list_audio_devices_detailed() -> Result<Vec<device::InputDeviceDetail>, String> {
    Ok(device::list_input_devices_detailed())
}
```

2. Modify `start_recording` to read device preferences from AppConfig and pass them to the engine:
   - Read `config.recording_device_name`, `config.recording_channels`, and `config.recording_channel_map` from state.config
   - Build a `ChannelMapping` if `recording_channels` and/or `recording_channel_map` are set:
     - If both are set, use them directly
     - If only `recording_channels` is set but no map, create an identity map `[0, 1, ..., n-1]`
     - If neither is set, pass None
   - Pass `device_name.as_deref()` and `channel_mapping.as_ref()` to `engine.0.start()`

**commands/settings.rs -- Handle new audio device settings fields:**

1. Add the new fields to `SettingsResponse`:
```rust
pub recording_device_name: Option<String>,
pub recording_channels: Option<u16>,
pub recording_channel_map: Option<Vec<u16>>,
```

2. Update the `From<&AppConfig>` impl to include the new fields.

3. In `update_settings`, handle the new fields from the JSON input:
   - `recordingDeviceName`: `settings.get("recordingDeviceName")` -- use `as_str()`, allow null to clear
   - `recordingChannels`: `settings.get("recordingChannels")` -- use `as_u64().map(|v| v as u16)`, allow null to clear
   - `recordingChannelMap`: `settings.get("recordingChannelMap")` -- parse as array of numbers, allow null to clear

**commands/mod.rs -- Register new command:**

Add `commands::recording::list_audio_devices_detailed` to the module exports (it's already a public function, just needs to be registered).

**lib.rs -- Register in invoke_handler:**

Add `commands::recording::list_audio_devices_detailed` to the `tauri::generate_handler![]` macro invocation, alongside the existing `list_audio_devices`.

**src/lib/types.ts -- Add TypeScript types:**

1. Add `InputDeviceDetail` interface:
```typescript
export interface InputDeviceDetail {
  name: string;
  channelCount: number;
  sampleRate: number;
  isDefault: boolean;
  supportedChannelCounts: number[];
  supportedSampleRates: number[];
}
```

2. Add `AudioDevicePreferences` interface:
```typescript
export interface AudioDevicePreferences {
  recordingDeviceName: string | null;
  recordingChannels: number | null;
  recordingChannelMap: number[] | null;
}
```

3. Update `AppSettings` interface to include the new fields:
```typescript
export interface AppSettings {
  // ... existing fields ...
  recordingDeviceName: string | null;
  recordingChannels: number | null;
  recordingChannelMap: number[] | null;
}
```

**src/lib/tauri.ts -- Add new wrapper function:**

1. Add `listAudioDevicesDetailed`:
```typescript
export async function listAudioDevicesDetailed(): Promise<InputDeviceDetail[]> {
  return invoke("list_audio_devices_detailed");
}
```

2. Add the `InputDeviceDetail` import to the import block from `./types`.
  </action>
  <verify>
    <automated>cd /Users/andrewlovettbarron/src/wallflower && cargo build -p wallflower-app 2>&1 | tail -20 && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `list_audio_devices_detailed` Tauri command returns devices with supported configs
    - `start_recording` reads device preferences from settings and passes to engine
    - Settings response includes new audio device fields
    - `update_settings` handles recordingDeviceName, recordingChannels, recordingChannelMap
    - TypeScript types match Rust response shapes
    - Tauri app compiles, TypeScript type-checks
  </done>
</task>

<task type="auto">
  <name>Task 3: Frontend -- Audio device settings UI in Settings page</name>
  <files>
    src/components/settings/AudioDeviceSettings.tsx,
    src/components/settings/SettingsPage.tsx
  </files>
  <action>
Create a new component `AudioDeviceSettings.tsx` and integrate it into SettingsPage.

**AudioDeviceSettings.tsx:**

Create a self-contained component that manages audio interface configuration. It should:

1. **State**: Use local state for devices list, selected device name, channel count, and channel map. Load initial values from settings on mount.

2. **On mount**: Call `listAudioDevicesDetailed()` to get available devices, and `getSettings()` to get current preferences. Populate the UI with current selections.

3. **Device selector** (dropdown/select):
   - List all available input devices from `listAudioDevicesDetailed()`
   - Show device name + channel count + sample rate for each option (e.g., "Scarlett 2i2 (2ch, 48kHz)")
   - Include a "System Default" option at the top (value = null/empty)
   - Mark the current system default device with "(default)" suffix
   - On change: update settings via `updateSettings({ recordingDeviceName: selectedName })`, then update the channel count options and reset channel map to identity

4. **Channel count picker** (dropdown/select):
   - Enabled only when a device is selected (not "System Default")
   - Options are the supported channel counts for the selected device (from `supportedChannelCounts`)
   - Also include the device's default/max channel count
   - On change: update settings via `updateSettings({ recordingChannels: count })`, then reset channel map to identity `[0, 1, ..., count-1]`

5. **Channel routing matrix**:
   - Displayed only when channel count is set and > 0
   - Show a row for each output recording slot (e.g., "Output 1", "Output 2")
   - Each row has a dropdown listing all physical input channels of the device (e.g., "Input 1", "Input 2", ..., "Input 8" for an 8-channel device)
   - Default: identity mapping (Output 1 = Input 1, Output 2 = Input 2, etc.)
   - On change: update settings via `updateSettings({ recordingChannelMap: newMap })`
   - Show a helpful description: "Assign which physical input channel feeds each recording slot."

6. **Refresh button**: Small button to re-scan devices (calls `listAudioDevicesDetailed()` again), useful when user plugs in a new device.

7. **Styling**: Match existing settings card patterns from SettingsPage.tsx:
   - Use same dark card background (#1D2129), border color (#323844)
   - Select elements use background #272C36, border #323844
   - Labels use text-sm text-foreground, descriptions use text-xs text-muted-foreground
   - Use consistent spacing (space-y-5 for sections)

8. **Error handling**: If device listing fails (no audio hardware in CI), show a muted message "No audio devices detected." Use toast from sonner for save errors.

**SettingsPage.tsx:**

1. Import `AudioDeviceSettings` from `./AudioDeviceSettings`
2. Add a new card section between the existing "Recording" card and the "Export" card:
```tsx
{/* Audio Interface settings card */}
<div className="mb-4 rounded-xl border p-5" style={{ background: "#1D2129", borderColor: "#323844" }}>
  <h2 className="mb-4 text-sm font-semibold text-foreground">Audio Interface</h2>
  <AudioDeviceSettings />
</div>
```

The AudioDeviceSettings component is fully self-contained -- it loads its own data and calls updateSettings directly. It does NOT need settings state lifted from SettingsPage because it manages its own lifecycle.
  </action>
  <verify>
    <automated>cd /Users/andrewlovettbarron/src/wallflower && npx tsc --noEmit 2>&1 | tail -20 && npx next build 2>&1 | tail -20</automated>
  </verify>
  <done>
    - AudioDeviceSettings component renders device dropdown with all available input devices
    - Selecting a device updates the recordingDeviceName setting
    - Channel count dropdown shows supported channel counts for the selected device
    - Channel routing matrix lets user assign physical inputs to recording slots
    - All preferences persist via updateSettings and survive page refresh
    - Settings page shows the new "Audio Interface" card between Recording and Export
    - TypeScript compiles, Next.js builds
  </done>
</task>

</tasks>

<verification>
1. `cargo test -p wallflower-core` -- all core tests pass including new settings fields
2. `cargo build -p wallflower-app` -- Tauri app compiles with new commands
3. `npx tsc --noEmit` -- TypeScript type-checks
4. Manual: Open Settings, see Audio Interface card, select a device, set channels, configure routing, restart app, verify settings persisted
5. Manual: Start a recording with a non-default device selected, verify audio is captured from the correct device/channels
</verification>

<success_criteria>
- User can select any available audio input device from Settings
- User can configure channel count and channel routing
- Preferences persist across app restarts (stored in SQLite settings table)
- Recording engine uses the selected device and channel mapping
- Falls back gracefully to system default if selected device is unavailable
- All existing tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/260425-jzp-audio-interface-selection/260425-jzp-SUMMARY.md`
</output>
