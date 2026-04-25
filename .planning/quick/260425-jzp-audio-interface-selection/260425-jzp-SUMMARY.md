---
phase: quick
plan: 260425-jzp
subsystem: recording
tags: [cpal, audio-device, channel-mapping, tauri-commands, settings-ui]

requires:
  - phase: 03-recording
    provides: RecordingEngine, device.rs, settings/mod.rs, recording Tauri commands

provides:
  - Audio device selection by name with fallback to system default
  - Channel count configuration per device
  - Physical-to-output channel routing matrix
  - Persistent audio interface preferences in SQLite settings
  - AudioDeviceSettings UI component in Settings page

affects: [recording, settings, audio-capture]

tech-stack:
  added: []
  patterns:
    - "Channel remapping in audio callback via interleaved sample extraction"
    - "Device detail enumeration with supported_input_configs() for channel/rate ranges"

key-files:
  created:
    - src/components/settings/AudioDeviceSettings.tsx
  modified:
    - crates/wallflower-core/src/recording/device.rs
    - crates/wallflower-core/src/recording/mod.rs
    - crates/wallflower-core/src/settings/mod.rs
    - crates/wallflower-app/src/commands/recording.rs
    - crates/wallflower-app/src/commands/settings.rs
    - crates/wallflower-app/src/lib.rs
    - src/lib/types.ts
    - src/lib/tauri.ts
    - src/components/settings/SettingsPage.tsx

key-decisions:
  - "Channel remapping happens in the audio data callback, not at the cpal config level -- stream uses full device channel count and we extract mapped channels per frame"
  - "Device fallback: if named device not found, fall back to system default with tracing::warn rather than erroring"
  - "Supported sample rates intersected with common rates [44100, 48000, 88200, 96000, 176400, 192000] rather than exposing raw ranges"

patterns-established:
  - "AudioDeviceSettings is self-contained: loads own data, manages own state, calls updateSettings directly"
  - "Settings null-to-clear pattern: JSON null value clears the setting (sets to None/null in config)"

requirements-completed: [QUICK-audio-interface-selection]

duration: 7min
completed: 2026-04-25
---

# Quick Task 260425-jzp: Audio Interface Selection Summary

**Audio device selection with channel mapping for multi-channel interfaces (Scarlett, Zoom, etc.), persisted in SQLite and configurable from Settings UI**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-25T12:28:00Z
- **Completed:** 2026-04-25T12:35:53Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Musicians can select any available audio input device from Settings instead of always using system default
- Channel count and physical-to-output channel routing is fully configurable per device
- Preferences persist across app restarts via SQLite settings table
- Recording engine uses the selected device and channel mapping, falling back gracefully if device unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend -- device selection, channel mapping, and settings persistence** - `f92713a` (feat)
2. **Task 2: Tauri commands and frontend wiring** - `1a2ab04` (feat)
3. **Task 3: Frontend -- Audio device settings UI** - `755bf55` (feat)

## Files Created/Modified

- `crates/wallflower-core/src/recording/device.rs` - InputDeviceDetail struct, get_cpal_device_by_name(), list_input_devices_detailed()
- `crates/wallflower-core/src/recording/mod.rs` - ChannelMapping struct, start() with device_name and channel_mapping params
- `crates/wallflower-core/src/settings/mod.rs` - recording_device_name, recording_channels, recording_channel_map in AppConfig
- `crates/wallflower-app/src/commands/recording.rs` - list_audio_devices_detailed command, start_recording reads device prefs
- `crates/wallflower-app/src/commands/settings.rs` - New fields in SettingsResponse + update_settings handling
- `crates/wallflower-app/src/lib.rs` - Register list_audio_devices_detailed in invoke_handler
- `src/lib/types.ts` - InputDeviceDetail interface, AppSettings extended with audio device fields
- `src/lib/tauri.ts` - listAudioDevicesDetailed() wrapper function
- `src/components/settings/AudioDeviceSettings.tsx` - Self-contained audio interface settings component
- `src/components/settings/SettingsPage.tsx` - Audio Interface card integrated between Recording and Export

## Decisions Made

- Channel remapping in the audio data callback rather than at cpal config level, because cpal needs to receive all physical channels and we selectively extract the mapped ones per frame
- Device lookup falls back to system default with a warning rather than failing, so recordings continue even if a previously-selected device is unplugged
- Supported sample rates are intersected with common studio rates rather than exposing raw min/max ranges from cpal, for a cleaner UI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Audio interface selection is complete and ready for use
- Manual testing recommended: select a non-default device, configure channels, start recording, verify correct device/channel capture

---
*Quick task: 260425-jzp-audio-interface-selection*
*Completed: 2026-04-25*
