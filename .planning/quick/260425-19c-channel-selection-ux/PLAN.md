---
slug: channel-selection-ux
description: Improve audio device channel selection — sensible defaults, channel count options, per-channel level meters
status: planning
---

# Channel Selection UX Improvements

## Task 1: Frontend — Default to stereo & sensible channel counts
**File:** `src/components/settings/AudioDeviceSettings.tsx`

- `handleDeviceChange`: default to `Math.min(2, device.channelCount)` instead of `device.channelCount`
- Generate channel count options: common values (1, 2, 4, 6, 8, 12, 16, 24, 32) filtered to `<= device.channelCount`, plus device max if not in list
- Identity map only for the default channel count, not device max

## Task 2: Backend — Per-channel level monitoring command
**File:** `crates/wallflower-core/src/recording/device.rs`

- Add `monitor_device_levels(device_name, duration_ms)` function that:
  - Opens a temporary cpal input stream on the named device (or default)
  - Captures ~100ms of audio
  - Computes per-channel RMS (dB) from the captured frames
  - Returns `Vec<f32>` of per-channel levels
  - Cleans up the stream on return

**File:** `crates/wallflower-app/src/commands/recording.rs`
- Add `monitor_input_levels` Tauri command exposing the above
- Register in invoke_handler

## Task 3: Frontend — Per-channel level meter visualization
**File:** `src/components/settings/AudioDeviceSettings.tsx`

- Add level monitoring state: `channelLevels: number[] | null`
- When a device is selected, start polling `monitorInputLevels` at ~10fps via `setInterval`
- Stop polling when device deselected or component unmounts
- Render horizontal bar meters next to each channel in the routing matrix
- Color: green for signal, dim for silence (< -60dB)

**File:** `src/lib/tauri.ts`
- Add `monitorInputLevels(deviceName)` binding

**File:** `src/lib/types.ts`
- No new types needed (levels are just number[])
