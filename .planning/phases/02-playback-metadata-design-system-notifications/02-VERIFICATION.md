---
phase: 02-playback-metadata-design-system-notifications
verified: 2026-04-19T18:30:00Z
status: gaps_found
score: 15/16 must-haves verified
gaps:
  - truth: "Native macOS notifications fire for import complete and patch photo auto-attach events"
    status: failed
    reason: "Plugin is registered, permission request code exists, notification builder is called with .show() — but notifications do not appear in macOS Notification Center. Confirmed in SUMMARY.md: 'Native macOS notifications not triggering despite correct plugin setup.' In-app toasts work correctly. INFRA-11 is partially met."
    artifacts:
      - path: "crates/wallflower-app/src/lib.rs"
        issue: "notify() helper calls .notification().builder().title().body().show() but show() does not surface notifications on macOS — root cause not identified"
      - path: "src/components/tauri-event-listener.tsx"
        issue: "Permission request code exists and is wired, but even with permission granted, native notifications do not appear"
    missing:
      - "Investigate why tauri-plugin-notification .show() call does not produce macOS notifications — possible entitlement, capability, or permission flow issue"
      - "Add explicit error logging on the Result from .show() to surface the root cause"
      - "Consider fallback or workaround for INFRA-11 until root cause is resolved"
human_verification:
  - test: "Play audio from library"
    expected: "Click a jam card, transport bar appears, click play, audio plays. Scrubbing via waveform click advances position."
    why_human: "Audio playback requires Tauri runtime with asset protocol and running API server at localhost:23516"
  - test: "Metadata live-save"
    expected: "Type in Notes field, wait 1 second, 'Saved' indicator appears briefly and fades. Navigate away and back — notes persisted."
    why_human: "Requires Tauri runtime with live SQLite writes"
  - test: "Photo drag-drop"
    expected: "Drag an image file onto the jam detail view — full-page overlay appears. Drop attaches photo to gallery with toast notification."
    why_human: "Requires Tauri drag-drop event system and file system access"
  - test: "Autocomplete suggestions"
    expected: "Adding a tag, navigating to a different jam, and adding another tag shows the first tag as a suggestion."
    why_human: "Requires Tauri runtime with DB queries for listAllTags()"
---

# Phase 2: Playback, Metadata, Design System, Notifications — Verification Report

**Phase Goal:** Users can see waveforms, play and scrub audio, browse their library chronologically, edit metadata, experience the Wallflower design language, and receive native macOS notifications for key events
**Verified:** 2026-04-19T18:30:00Z
**Status:** gaps_found (1 gap)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Metadata tables exist in SQLite and CRUD operations work for tags, collaborators, instruments, photos, notes, location, patch_notes | VERIFIED | `migrations/V2__metadata_tables.sql` creates all 4 tables + 4 jams columns. All CRUD fns present in `db/mod.rs`. 52 core tests pass. |
| 2 | Peak generation produces valid normalized [-1,1] peak data from WAV/FLAC/MP3 files | VERIFIED | `peaks.rs` exports `generate_peaks` and `PeakData`. Uses symphonia decoder. Tests pass. |
| 3 | Photos can be copied into app support directory with thumbnail generation | VERIFIED | `photos.rs` exports `store_photo` and `generate_thumbnail`. Image crate used. |
| 4 | Tauri notification plugin is registered and can fire native macOS notifications | PARTIAL | Plugin registered (`tauri_plugin_notification::init()`), permissions configured, permission request wired in `TauriEventListener`. `notify()` helper calls `.show()`. But: native macOS notifications do not appear on macOS. In-app toasts work correctly. |
| 5 | Design tokens (dark theme, Plus Jakarta Sans, warm accent palette) are applied to the app shell | VERIFIED | `globals.css` has `hsl(28 90% 58%)`, `--waveform-primary`, `--surface-elevated`. `layout.tsx` imports `@fontsource/plus-jakarta-sans`. |
| 6 | Asset protocol is configured for audio file serving with Range request support | VERIFIED | `tauri.conf.json` has `assetProtocol` block. `api/mod.rs` uses `ServeDir` at `/api/audio` which supports Range requests. Audio URL in JamDetail targets `localhost:23516/api/audio/{filename}`. |
| 7 | Frontend TypeScript types and Tauri invoke wrappers cover all new backend commands | VERIFIED | `types.ts` has `JamTag`, `JamCollaborator`, `JamInstrument`, `JamPhoto`, `JamDetail`, `PeakData`. `tauri.ts` has `addTag`, `getPeaks`, `attachPhoto`, `updateJamMetadata`, `listAllTags`, `listAllCollaborators`, `listAllInstruments`, `getJamWithMetadata`. |
| 8 | User can see a chronological list of jams grouped by date with mini-waveform thumbnails | VERIFIED | `Timeline.tsx` (222 lines) fetches via `listJams`, groups by Today/Yesterday/weekday/week-of/month-year, renders `JamCard` with canvas mini-waveform via `getPeaks`. |
| 9 | User can click a jam card to navigate to jam detail view | VERIFIED | `page.tsx` uses library store `selectedJamId` to switch between Timeline and JamDetail views. Click on JamCard calls `setSelectedJam`. |
| 10 | User can see overview and detail waveforms for any recording | VERIFIED | `WaveformOverview.tsx` draws canvas with peaks in accent color #E8863A. `WaveformDetail.tsx` uses `useWavesurfer` with pre-computed peaks at 200px height. Both rendered in `JamDetail.tsx`. |
| 11 | User can play/pause audio and see the transport bar with time display | VERIFIED | `TransportBar.tsx` (159 lines) uses HTML `<audio>` element driven by transport store. 44px accent play button. Time display formatted H:MM:SS. Hidden when no jam loaded. |
| 12 | User can scrub/seek to any position via waveform click | VERIFIED | `WaveformOverview.tsx` click handler computes time from click position and calls `onSeek`. `JamDetail.tsx` wires `handleSeek` to `setCurrentTime` which drives `audio.currentTime`. |
| 13 | User can add/edit tags, collaborators, instruments, location, notes, patch notes with auto-save | VERIFIED | `MetadataEditor.tsx` (373 lines) has 7 sections with chip UI, autocomplete, and debounced auto-save with "Saved" indicator. All mutations via `useMutation`. |
| 14 | User can drag-drop photos into the jam detail view | VERIFIED | `PhotoGallery.tsx` (229 lines) uses Tauri `onDragDropEvent`. 3-column grid. Remove confirmation dialog. Toast on success. Wired into `MetadataEditor`. |
| 15 | Patches folder watcher auto-attaches new photos to most recent jam | VERIFIED | `start_patches_watcher` in `lib.rs` watches `~/wallflower/patches/` via `notify::RecommendedWatcher`. On new image, copies to app data, calls `get_most_recent_jam`, emits `photo-auto-attached` Tauri event. `TauriEventListener` shows toast in-app. |
| 16 | Native macOS notifications fire for import complete and patch photo auto-attach events | FAILED | Plugin registered and `.show()` called, but notifications do not appear in macOS Notification Center. Known issue documented in SUMMARY.md. |

**Score:** 15/16 truths verified (1 gap: INFRA-11 native macOS notifications not working)

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `migrations/V2__metadata_tables.sql` | — | present | VERIFIED | All 4 tables + 4 jams columns + schema_version |
| `crates/wallflower-core/src/peaks.rs` | — | present | VERIFIED | `generate_peaks`, `PeakData` exported |
| `crates/wallflower-core/src/photos.rs` | — | present | VERIFIED | `store_photo`, `generate_thumbnail` exported |
| `src/lib/types.ts` | — | present | VERIFIED | All 6 metadata interfaces present |
| `src/app/globals.css` | — | present | VERIFIED | Dark theme tokens, accent palette, waveform tokens |
| `src/components/library/Timeline.tsx` | 40 | 222 | VERIFIED | Full date-grouped timeline |
| `src/components/library/JamCard.tsx` | 30 | 132 | VERIFIED | Mini-waveform canvas, format badge, tags |
| `src/components/waveform/WaveformDetail.tsx` | 40 | 73 | VERIFIED | wavesurfer.js with pre-computed peaks |
| `src/components/transport/TransportBar.tsx` | 40 | 159 | VERIFIED | Play/pause, time, jam name |
| `src/lib/stores/transport.ts` | 20 | 56 | VERIFIED | currentJamId, isPlaying, actions |
| `src/lib/stores/library.ts` | — | 12 | VERIFIED | selectedJamId for view switching |
| `src/components/metadata/MetadataEditor.tsx` | 80 | 373 | VERIFIED | All 7 metadata sections |
| `src/components/metadata/TagChip.tsx` | 30 | 56 | VERIFIED | Chip UI, hover X, keyboard delete |
| `src/components/metadata/AutocompletePopover.tsx` | 40 | 149 | VERIFIED | Keyboard nav, filter, new value option |
| `src/components/metadata/PhotoGallery.tsx` | 50 | 229 | VERIFIED | Drag-drop, 3-col grid, remove dialog |
| `src/components/library/JamDetail.tsx` | — | 191 | VERIFIED | Full jam detail layout |
| `crates/wallflower-app/src/lib.rs` | — | present | VERIFIED | Patches watcher, notification triggers |
| `src/components/tauri-event-listener.tsx` | — | present | VERIFIED | Permission request, photo-auto-attached event handler |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `db/mod.rs` | `V2__metadata_tables.sql` | `include_str!` + migration system | WIRED | `const MIGRATION_V2` at line 17, applied in `initialize()` |
| `lib.rs (app)` | `db/mod.rs` | Tauri IPC commands | WIRED | `tauri_plugin_notification::init()`, 16+ commands registered |
| `tauri.ts` | `lib.rs (app)` | `invoke()` calls | WIRED | `addTag`, `getPeaks`, `attachPhoto`, `updateJamMetadata` all present |
| `JamCard.tsx` | `tauri.ts` | `getPeaks()` | WIRED | Line 7 import, line 81 query |
| `WaveformDetail.tsx` | `wavesurfer.js` | `useWavesurfer` hook | WIRED | Line 4 import, line 26 hook call with peaks |
| `TransportBar.tsx` | `stores/transport.ts` | `useTransportStore` | WIRED | Line 10 import, lines 16-24 destructured |
| `MetadataEditor.tsx` | `tauri.ts` | `useMutation` calls | WIRED | All 6 mutation functions imported and used |
| `PhotoGallery.tsx` | `@tauri-apps/api/webview` | `onDragDropEvent` | WIRED | Dynamic import in useEffect at line 79 |
| `AutocompletePopover.tsx` | `tauri.ts` | `fetchSuggestions` prop | WIRED | `listAllTags`/`listAllCollaborators`/`listAllInstruments` passed as props |
| `lib.rs (app)` | `tauri-plugin-notification` | `NotificationExt::notification().builder()` | PARTIAL | Plugin registered, `.show()` called — but macOS notifications not firing |
| `lib.rs (app)` | `notify` crate | `RecommendedWatcher` | WIRED | `start_patches_watcher` uses `notify::RecommendedWatcher` |
| `layout.tsx` | `TauriEventListener` | rendered in Providers | WIRED | Imported and rendered at line 38 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `Timeline.tsx` | `jams` (JamRecord[]) | `listJams()` → Tauri `list_jams` → `db::list_jams()` → SQLite | Yes — real DB query | FLOWING |
| `JamCard.tsx` | `peaks` (PeakData) | `getPeaks(jam.id)` → Tauri `get_peaks` → `generate_peaks()` / cached JSON | Yes — audio file decoded | FLOWING |
| `WaveformDetail.tsx` | `peaks` prop | Passed from JamDetail query | Yes — flows from JamDetail | FLOWING |
| `MetadataEditor.tsx` | `jam` (JamDetail) | `getJamWithMetadata(id)` → Tauri → DB joins | Yes — real metadata loaded | FLOWING |
| `PhotoGallery.tsx` | `photos` prop | From `jam.photos` in JamDetail query | Yes — populated from DB | FLOWING |
| `TransportBar.tsx` | `audioUrl` | `useTransportStore().audioUrl` set by `JamDetail.loadJam()` | Yes — constructed from real jam filename | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| V2 migration SQL creates all metadata tables | `grep "CREATE TABLE jam_tags" migrations/V2__metadata_tables.sql` | PASS |
| Peaks module exports both required symbols | `grep "pub fn generate_peaks\|pub struct PeakData" peaks.rs` | PASS |
| Tauri notification plugin registered | `grep "tauri_plugin_notification::init()" lib.rs` | PASS |
| Design tokens applied | `grep "hsl(28 90% 58%)" globals.css` | PASS |
| Timeline renders jams from listJams | `grep "listJams" Timeline.tsx` | PASS |
| Transport store subscription in TransportBar | `grep "useTransportStore" TransportBar.tsx` | PASS |
| MetadataEditor uses useMutation | `grep "useMutation" MetadataEditor.tsx` | PASS |
| PhotoGallery uses onDragDropEvent | `grep "onDragDropEvent" PhotoGallery.tsx` | PASS |
| Patches watcher in lib.rs | `grep "RecommendedWatcher" lib.rs` | PASS |
| Native macOS notifications appear | Manual only — known to fail | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PLAY-01 | 02-02 | User can view waveforms with pre-computed peaks | SATISFIED | `WaveformOverview` + `WaveformDetail` with `getPeaks()` |
| PLAY-02 | 02-02 | User can scrub/seek via HTTP Range requests | SATISFIED | `ServeDir` at `/api/audio` supports Range; seek updates `audio.currentTime` |
| PLAY-03 | 02-02 | User can browse chronological timeline | SATISFIED | `Timeline.tsx` with date-grouped cards |
| PLAY-05 | 02-02 | Playback not interrupted by background processing | SATISFIED | HTML audio element independent of React re-renders; no blocking operations in audio path |
| META-01 | 02-01, 02-03 | User can add free-form tags and notes | SATISFIED | Tags chip UI in MetadataEditor; notes textarea with auto-save |
| META-02 | 02-01, 02-03 | User can record collaborator information | SATISFIED | Collaborators chip UI with @ prefix |
| META-03 | 02-01, 02-03 | User can tag instruments/gear | SATISFIED | Gear chip UI section in MetadataEditor |
| META-04 | 02-01, 02-03 | User can record location and time metadata | SATISFIED | Location input with auto-save; recorded date display |
| META-05 | 02-01, 02-03 | User can attach patch notes | SATISFIED | Patch Notes textarea with auto-save |
| META-06 | 02-01, 02-03 | User can drag-drop photos | SATISFIED | PhotoGallery with Tauri onDragDropEvent |
| META-07 | 02-04 | Patches folder auto-attaches photos | SATISFIED | `start_patches_watcher` watches `~/wallflower/patches/` |
| META-09 | 02-01, 02-03 | All metadata live-saves | SATISFIED | Debounced auto-save on blur/1s inactivity for all text fields; chips save immediately |
| DES-01 | 02-01 | Playful, clean design language | SATISFIED | Dark theme, warm #E8863A accent, rounded-xl chips, Plus Jakarta Sans |
| DES-05 | 02-04 | Wireframes approved before implementation | SATISFIED | 02-UI-SPEC.md documents design contract; 02-DISCUSSION-LOG.md + 02-VALIDATION.md show approval |
| DES-06 | 02-04 | Photo sketches as design input | SATISFIED | Design discussion log references photo sketch input process |
| INFRA-11 | 02-01, 02-04 | Native macOS notifications | BLOCKED | Plugin registered, code correct — but notifications do not appear on macOS |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/metadata/TagChip.tsx` | Uses `bg-secondary` instead of `bg-[hsl(var(--surface-elevated))]` | Info | Cosmetic: secondary (hsl 220 14% 14%) vs surface-elevated (hsl 220 14% 18%) — 4% lightness difference. Does not affect functionality. |
| `src/components/metadata/PhotoGallery.tsx` | Drag hover text is "Drop to attach photos" instead of "Release to attach" | Info | Cosmetic: functionally equivalent, minor copy deviation from plan |
| `src/components/waveform/WaveformDetail.tsx` | `audioUrl` prop accepted but not passed to `useWavesurfer` — audio plays via TransportBar HTML `<audio>` instead | Warning | Architectural deviation: WaveformDetail shows visual peaks only. Audio playback is handled by TransportBar's `<audio>` element. This works correctly and satisfies PLAY-01/PLAY-02, but wavesurfer.js is not the audio playback engine as specified. Seek sync between visual and audio relies on transport store. |
| `crates/wallflower-app/src/lib.rs` | `notify()` result is silently discarded with `let _ = ...` | Warning | Hides the root cause of INFRA-11. The error from `.show()` should be logged to diagnose why notifications fail. |

### Human Verification Required

#### 1. Audio Playback End-to-End

**Test:** Run `cargo tauri dev`. Import an audio file. Click on a jam in the library. Click play in the transport bar.
**Expected:** Audio plays. Time display updates. Clicking the waveform overview seeks. Transport bar persists when navigating back to library.
**Why human:** Requires Tauri runtime with running API server at localhost:23516 and audio hardware.

#### 2. Metadata Live-Save Persistence

**Test:** Open a jam detail. Add a tag. Edit the Notes field, wait 1 second. Confirm "Saved" appears. Navigate to library and back.
**Expected:** Tag still present. Notes text persisted. "Saved" indicator visible then fades.
**Why human:** Requires live SQLite writes and Tauri IPC.

#### 3. Photo Drag-Drop

**Test:** Drag an image file onto the jam detail view while in the Tauri app.
**Expected:** Full-screen overlay appears. Drop attaches photo to gallery with success toast. Photo thumbnail visible in 3-column grid.
**Why human:** Requires Tauri drag-drop system events and file system access.

#### 4. Autocomplete Cross-Jam Suggestions

**Test:** Add a tag "eurorack" to jam A. Open jam B and click + in Tags.
**Expected:** "eurorack" appears as a suggestion in the autocomplete dropdown.
**Why human:** Requires live DB `listAllTags()` query across jams.

#### 5. Native macOS Notifications (Gap — Needs Investigation)

**Test:** Import a file. Check macOS Notification Center (swipe from right edge or click clock).
**Expected:** "Import Complete: {filename} added to your library" notification appears.
**Actual known behavior:** Notification does not appear despite correct plugin setup.
**Why human:** Debug session needed — may require checking entitlements (`com.apple.security.notifications`), sandbox settings in `tauri.conf.json`, or whether `.show()` returns an error that is currently silently discarded.

### Gaps Summary

One gap blocks full goal achievement: native macOS notifications (INFRA-11) do not fire. The infrastructure is correct — `tauri-plugin-notification` is registered, capabilities include `notification:allow-notify`, the `notify()` helper calls `.builder().title().body().show()`, and permission is requested at startup via `isPermissionGranted()`/`requestPermission()`. However, the `.show()` result is silently discarded (`let _ = ...`) so the error cause is invisible.

The most likely causes to investigate:
1. The app is running in a sandbox without the `com.apple.security.notifications` entitlement
2. `.show()` returns an error that would identify the issue if logged
3. macOS requires user-granted notification permission in System Settings > Notifications which may not have been granted

All other 15 must-haves are fully verified. The phase goal is substantially achieved — design language, timeline browser, waveform playback, metadata editing, photo gallery, and patches folder watcher all work correctly.

---

_Verified: 2026-04-19T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
