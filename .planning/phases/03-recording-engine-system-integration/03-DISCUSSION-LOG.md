# Phase 3: Recording Engine & System Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 03-recording-engine-system-integration
**Areas discussed:** Recording UX & controls, Crash safety & dropout recovery, Menubar & global hotkeys, Live metadata & recording workflow

---

## Recording UX & Controls

### Recording Controls Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Extend transport bar | Add record button to existing bottom transport bar. When recording, bar transforms to show recording state. | ✓ |
| Separate recording panel | Recording gets its own dedicated panel above the transport bar. More space for levels. | |
| Full-screen recording mode | Dedicated full-screen view with large levels, big controls. | |

**User's choice:** Extend transport bar
**Notes:** One unified bar for both playback and recording. Consistent with Phase 2's persistent bottom transport bar.

### Audio Device Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-select default | Use system default input device. Show device in transport bar. Change in Settings. | ✓ |
| Device picker on record | Show dropdown to pick input device each time user hits record. | |
| Remember last used | Remember last audio device, fall back to default if disconnected. | |

**User's choice:** Auto-select default
**Notes:** No prompt before each recording. Keep it simple.

### Silence Auto-Pause Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Visual marker only | Recording continues, silent sections get visual markers. Threshold configurable. | ✓ |
| Pause and resume automatically | Recording pauses when silence detected, resumes when audio returns. | |
| Notify but keep recording | Show notification after prolonged silence, recording continues. | |

**User's choice:** Visual marker only
**Notes:** Avoids false pauses from quiet musical passages.

### Playback During Recording

| Option | Description | Selected |
|--------|-------------|----------|
| No playback during recording | Disable playback while recording. Transport bar shows recording controls only. | ✓ |
| Allow playback of other jams | User can browse and play other jams while recording. Complex audio routing. | |
| You decide | Let Claude determine based on technical constraints. | |

**User's choice:** No playback during recording
**Notes:** Prevents audio routing conflicts and keeps recording engine as sole priority.

---

## Crash Safety & Dropout Recovery

### Audio Interface Disconnect Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Save and stop | Immediately finalize WAV file, notify user. Must manually restart. | |
| Pause and wait for reconnect | Keep session open, resume if device reconnects within timeout. | ✓ |
| Save segment, auto-start new | Save current file, start new recording on reconnect. Link both to same jam. | |

**User's choice:** Pause and wait for reconnect
**Notes:** Handles USB hub / cable jiggle scenario. Gap marker inserted for the disconnected period.

### Crash Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-recover silently | Detect incomplete WAVs on startup, repair header, import. Toast notification. | ✓ |
| Prompt before recovering | Show dialog on startup asking whether to recover or discard. | |
| Recovery in Settings | Manual "Recover recordings" button in Settings. | |

**User's choice:** Auto-recover silently
**Notes:** No user action needed. Worst case is a few seconds of missing audio at the end.

### Write Strategy

**User's choice:** Skipped (Claude's discretion)
**Notes:** REC-02 already specifies periodic WAV header updates with fsync every 5-10 seconds. User indicated this is a technical detail Claude should handle.

---

## Menubar & Global Hotkeys

### System Tray Icon

| Option | Description | Selected |
|--------|-------------|----------|
| Status icon + quick actions | Icon changes state. Click opens menu: status, Start/Stop, Open, Quit. | ✓ |
| Rich status popover | Popover window with live levels, device info, controls. | |
| Icon only, no menu | Just visual state indicator, all interaction in main window or hotkeys. | |

**User's choice:** Status icon + quick actions
**Notes:** Minimal but functional. Icon shows idle vs recording state.

### Global Hotkeys Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Record toggle only | One global hotkey for start/stop (Cmd+Shift+R). | ✓ |
| Record + mark | Start/stop plus bookmark marker hotkey. Two global shortcuts. | |
| Full control set | Start/stop, pause/resume, drop marker, open app. 4+ global shortcuts. | |

**User's choice:** Record toggle only
**Notes:** Minimal conflict risk with other apps. One shortcut to learn.

### Hotkey Customization

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable in Settings | Default Cmd+Shift+R, user can change. | ✓ |
| Fixed shortcut | Hardcoded Cmd+Shift+R. | |
| You decide | Claude determines based on Tauri API capabilities. | |

**User's choice:** Configurable in Settings
**Notes:** Musicians may have conflicting shortcuts in DAWs.

---

## Live Metadata & Recording Workflow

### Main Window During Recording

| Option | Description | Selected |
|--------|-------------|----------|
| Recording overlay on jam detail | New jam created, detail view opens with live waveform + metadata editor. | ✓ |
| Minimal recording HUD | Small overlay on current view. Browse library while recording. | |
| Dedicated recording view | Purpose-built screen with large levels, big timer, quick metadata. | |

**User's choice:** Recording overlay on jam detail
**Notes:** Same layout as viewing any jam but with live waveform and recording indicator.

### Navigation During Recording

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, freely browse | Recording continues in background. User can browse library. | |
| Locked to recording view | User stays on recording jam detail. Cannot navigate away. | ✓ |
| You decide | Claude determines based on state management complexity. | |

**User's choice:** Locked to recording view
**Notes:** Recording is the sole focus. Simpler state management.

### Stop-Recording Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | "Stop recording? (duration captured)" with Stop and Cancel. | ✓ |
| Long-press to stop | Hold stop button 1-2 seconds. No dialog. | |
| Double-click to stop | First click shows "click again" state, second click stops. | |

**User's choice:** Modal dialog
**Notes:** Clear, hard to accidentally stop. Dark theme modal.

---

## Claude's Discretion

- WAV write strategy (periodic header updates with fsync per REC-02)
- Dropout reconnection timeout duration
- Gap marker implementation details
- fsync frequency tuning

## Deferred Ideas

None — discussion stayed within phase scope
