---
status: complete
---

# Channel Selection UX Improvements

## Changes

### Backend (Rust)
- **`crates/wallflower-core/src/recording/device.rs`**: Added `monitor_device_levels()` — opens a temporary cpal input stream, captures ~100ms of audio, returns per-channel RMS in dB
- **`crates/wallflower-app/src/commands/recording.rs`**: Added `monitor_input_levels` Tauri command (async, uses `spawn_blocking`)
- **`crates/wallflower-app/src/lib.rs`**: Registered new command in invoke handler

### Frontend (TypeScript/React)
- **`src/lib/tauri.ts`**: Added `monitorInputLevels()` binding
- **`src/components/settings/AudioDeviceSettings.tsx`**:
  - Default to stereo (2ch) when selecting a new device instead of device max
  - Channel count dropdown uses common values (1, 2, 4, 6, 8, 12, 16, 24, 32) up to device max
  - Live per-channel level meters showing signal on all physical inputs
  - Level meters also shown inline in the channel routing matrix
  - Color-coded: green (normal), orange (>-18dB), red (>-6dB)
