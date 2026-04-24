---
phase: 05-source-separation-export
verified: 2026-04-24T15:50:43Z
status: human_needed
score: 4/4
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "Waveform drag-to-select bookmark creation"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Drag across the waveform to create a bookmark region"
    expected: "A translucent overlay appears during drag, BookmarkPopover opens on release with name/color/notes fields"
    why_human: "Previous GAP-1 was exactly this interaction. Fixed via custom pointer events replacing RegionsPlugin enableDragSelection. Needs visual confirmation in WKWebView."
  - test: "Trigger stem separation and verify StemMixer panel shows after completion"
    expected: "Progress bar shows chunk-by-chunk progress, then mixer slides up with 4 stem rows, solo/mute controls, play/pause, Export All/Export Selected buttons"
    why_human: "Multi-component workflow involving gRPC streaming, Tauri events, and Web Audio API playback -- cannot verify integration without running app"
  - test: "Export audio from bookmark context menu"
    expected: "WAV file appears in ~/wallflower/exports/{jam}/{bookmark}.wav with JSON sidecar alongside"
    why_human: "File I/O and path resolution need runtime verification"
  - test: "Verify stem audio loads and plays in StemMixer"
    expected: "Canvas mini-waveforms render for each stem, play button produces audible synchronized output, solo/mute toggles work during playback"
    why_human: "Web Audio API synchronized playback with GainNode routing requires runtime audio hardware"
---

# Phase 5: Source Separation & Export Verification Report

**Phase Goal:** Users can isolate instruments from recordings, bookmark interesting sections, and export stems ready for use in Ableton
**Verified:** 2026-04-24T15:50:43Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (drag-to-select fix)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can bookmark a section and export it as a time-sliced audio file or as source-separated stems | VERIFIED | Bookmark CRUD backend (mod.rs, 536 lines), export_time_slice writer (255 lines), separate_stems Tauri command, StemMixer panel, BookmarkPopover, BookmarkList, BookmarkContextMenu all exist and are wired |
| 2 | Source separation completes on long recordings without exceeding memory limits | VERIFIED | calculate_segment_seconds (clamped 5-30s), memory_limit_gb read from settings, segment_seconds passed to gRPC SeparateRequest, Python SeparationAnalyzer chunks audio at segment_samples size with overlap-add crossfade |
| 3 | Exported files appear in a folder Ableton can access and are self-contained for sharing | VERIFIED | export_root setting (default ~/wallflower/exports, tilde-expanded), resolve_export_path builds {root}/{jam}/{bookmark}.wav, generate_sidecar writes JSON with wallflower_version, source_jam, bookmark, analysis, export fields |
| 4 | 32-bit float recordings are downsampled to 24-bit on export | VERIFIED | writer.rs lines 44-71: Float 32 -> 24-bit int conversion via hound with proper scaling (8388607.0 positive, 8388608.0 negative), atomic write via temp-then-rename |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `migrations/V5__bookmarks_exports.sql` | Bookmarks, exports, stem_cache tables | VERIFIED | 46 lines, 3 CREATE TABLE, PRAGMA user_version = 5 |
| `crates/wallflower-core/src/bookmarks/mod.rs` | Bookmark CRUD operations | VERIFIED | 536 lines, 10 pub functions (create, read, update, delete, export records, stem cache) |
| `crates/wallflower-core/src/bookmarks/schema.rs` | Type definitions | VERIFIED | 65 lines, BookmarkRecord, CreateBookmark, UpdateBookmark, ExportRecord, StemCacheRecord |
| `crates/wallflower-core/src/export/writer.rs` | WAV time-slice writer | VERIFIED | 255 lines, export_time_slice with 32f->24i, 32f->16i, 32f passthrough |
| `crates/wallflower-core/src/export/sidecar.rs` | JSON sidecar generation | VERIFIED | 132 lines, ExportSidecar struct, generate_sidecar with atomic write |
| `crates/wallflower-core/src/export/sanitize.rs` | Filename sanitization | VERIFIED | 110 lines, sanitize_filename, resolve_export_path, resolve_stems_dir |
| `crates/wallflower-core/src/export/mod.rs` | Segment calculator | VERIFIED | 52 lines, calculate_segment_seconds, pub mod sanitize/sidecar/writer |
| `proto/wallflower_analysis.proto` | SeparateStems RPC | VERIFIED | 140 lines, rpc SeparateStems, SeparateRequest, SeparationProgress, SeparationStatus, StemFile |
| `sidecar/.../analyzers/separation.py` | SeparationAnalyzer | VERIFIED | 257 lines, calculate_chunks, linear_crossfade, separate, cancel |
| `sidecar/.../server.py` | SeparateStems handler | VERIFIED | 351 lines, SeparateStems method at line 171 |
| `sidecar/tests/test_separation.py` | Separation tests | VERIFIED | 155 lines, 8 tests passing |
| `crates/wallflower-app/.../bookmarks.rs` | Tauri bookmark CRUD | VERIFIED | 57 lines, 4 commands, invalidate_stem_cache on time change |
| `crates/wallflower-app/.../export.rs` | Tauri export/separation | VERIFIED | 606 lines, export_audio, separate_stems, export_stems, cancel_separation, reveal_in_finder |
| `src/lib/types.ts` | TypeScript types | VERIFIED | BookmarkRecord, CreateBookmarkInput, SeparationProgressEvent, BOOKMARK_COLORS, STEM_COLORS |
| `src/lib/tauri.ts` | Invoke wrappers | VERIFIED | 8 functions: createBookmark, getBookmarks, updateBookmark, deleteBookmark, exportAudio, separateStems, exportStems, cancelSeparation |
| `src/lib/stores/bookmarks.ts` | Bookmark zustand store | VERIFIED | 72 lines, useBookmarkStore with CRUD, getNextColor, getNextName |
| `src/lib/stores/separation.ts` | Separation store | VERIFIED | 136 lines, useSeparationStore with startSeparation, exportAllStems, exportSelectedStems |
| `src/components/bookmarks/BookmarkPopover.tsx` | Create/edit popover | VERIFIED | 136 lines, name input, color palette, notes field, save/discard |
| `src/components/bookmarks/BookmarkList.tsx` | Bookmark list | VERIFIED | 148 lines, empty state, bookmark rows, context menu trigger |
| `src/components/bookmarks/BookmarkContextMenu.tsx` | Context menu | VERIFIED | 95 lines, Export audio, Export stems, Edit, Delete with confirmation |
| `src/components/stems/StemMixer.tsx` | Mixer panel | VERIFIED | 336 lines, Sheet bottom, StemRow renders, AudioContext playback, Export All/Selected |
| `src/components/stems/StemRow.tsx` | Individual stem row | VERIFIED | 152 lines, canvas waveform, solo/mute buttons, dim state |
| `src/components/stems/SeparationProgress.tsx` | Progress bar | VERIFIED | 83 lines, chunk count, percentage, pause-for-recording, cancel |
| `src/components/waveform/WaveformDetail.tsx` | Drag-to-select bookmarks | VERIFIED | 380 lines, custom pointer events for drag, RegionsPlugin for existing bookmarks, snap-to-boundary |
| `src/components/waveform/WaveformOverview.tsx` | Bookmark indicators | VERIFIED | Canvas-drawn indicators, 8 bookmark references |
| `src/components/library/JamDetail.tsx` | Integration hub | VERIFIED | BookmarkList (2 refs), useBookmarkStore (8 refs), StemMixer (2 refs), separation-progress event (2 refs) |
| `src/components/settings/SettingsPage.tsx` | Export settings | VERIFIED | Export Folder, Default Format, bit depth, Source Separation Model, Memory Limit |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| export.rs | writer.rs | export_time_slice call | WIRED | 1 call in export_audio command |
| export.rs | mod.rs | calculate_segment_seconds | WIRED | 2 references, reads memory_limit_gb from DB settings |
| export.rs | sidecar gRPC | SeparateStems RPC | WIRED | segment_seconds passed at line 291 |
| export.rs | sidecar.rs | generate_sidecar | WIRED | 2 references in export_audio and export_stems |
| export.rs | scheduler | may_proceed | WIRED | 2 references for recording priority |
| bookmarks.rs | V5 migration | rusqlite queries | WIRED | CRUD against bookmarks table |
| bookmarks.rs | stem_cache | invalidate_stem_cache | WIRED | Called on time range update |
| tauri.ts | bookmarks.rs | Tauri invoke | WIRED | 8 invoke wrapper functions |
| WaveformDetail | bookmarks | props from JamDetail | WIRED | JamDetail passes bookmarks via useBookmarkStore |
| BookmarkContextMenu | tauri.ts | parent handler callbacks | WIRED | Export audio, Export stems menu items |
| StemMixer | separation.ts | useSeparationStore | WIRED | 11 store selector references |
| StemMixer | Web Audio API | AudioContext | WIRED | AudioBufferSourceNode with loop, GainNode per stem, requestAnimationFrame |
| JamDetail | StemMixer | Sheet component | WIRED | 2 references, rendered as bottom Sheet |
| server.py | proto | SeparateStems handler | WIRED | Line 171, passes segment_seconds to analyzer (line 209) |
| separation.py | demucs-mlx | import | WIRED | Lazy import in separate() method |
| lib.rs | bookmarks/export | pub mod | WIRED | Both modules registered |
| commands/mod.rs | bookmarks/export | pub mod | WIRED | Both modules registered |
| lib.rs (app) | all commands | invoke_handler | WIRED | 9 commands registered (lines 494-502) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| BookmarkList | bookmarks | useBookmarkStore -> Tauri invoke -> rusqlite | Real DB query | FLOWING |
| StemMixer | stems | useSeparationStore -> separateStems -> gRPC -> demucs-mlx | Real ML processing | FLOWING |
| SeparationProgress | progress | Tauri separation-progress event -> useSeparationStore | Real gRPC stream | FLOWING |
| SettingsPage | settings | useSettings -> Tauri get_settings -> DB | Real DB query | FLOWING |
| WaveformOverview | bookmarks | props from JamDetail -> useBookmarkStore -> DB | Real DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Bookmark CRUD tests | cargo test -p wallflower-core bookmark | 7 passed, 0 failed | PASS |
| Export pipeline tests | cargo test -p wallflower-core export | 14 passed, 0 failed | PASS |
| Python separation tests | pytest tests/test_separation.py (via SUMMARY) | 8 passed | PASS (via SUMMARY) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-04 | 05-02 | Source separation using demucs-mlx on Apple Silicon | SATISFIED | SeparationAnalyzer wraps demucs-mlx, gRPC SeparateStems RPC, Tauri separate_stems command |
| AI-10 | 05-02 | Demucs processes long recordings in chunks with overlap-add | SATISFIED | calculate_chunks with overlap, linear_crossfade, calculate_segment_seconds for memory-aware chunking |
| EXP-01 | 05-04 | User can bookmark sections of a recording | SATISFIED | WaveformDetail drag-to-select, BookmarkPopover, BookmarkList, bookmark CRUD |
| EXP-02 | 05-01, 05-03 | User can export bookmarked sections as audio files | SATISFIED | export_time_slice writer, Tauri export_audio command, JSON sidecar |
| EXP-03 | 05-02, 05-03, 05-05 | User can export bookmarked sections as source-separated stems | SATISFIED | separate_stems command, StemMixer, export_stems command |
| EXP-04 | 05-01, 05-05 | Exports placed in configurable folder Ableton can access | SATISFIED | export_root setting with folder picker, resolve_export_path, Settings page |
| EXP-05 | 05-01 | Exported files self-contained and shareable | SATISFIED | JSON sidecar with wallflower_version, source_jam, bookmark, analysis, export metadata |
| EXP-06 | 05-01 | 32-bit float recordings downsampled to 24-bit on export | SATISFIED | writer.rs Float 32->24-bit int conversion with proper scaling |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODOs, FIXMEs, placeholders, stubs, or empty implementations in any key file |

### Human Verification Required

### 1. Drag-to-select bookmark creation on waveform

**Test:** Drag across the waveform to select a region
**Expected:** A translucent orange overlay appears during drag, BookmarkPopover opens on release with name input, color palette, and notes field
**Why human:** This was the specific gap from the previous verification (GAP-1). The fix replaced RegionsPlugin's enableDragSelection with custom pointer events and set interact:false. Needs visual confirmation in WKWebView.

### 2. Stem separation and mixer workflow

**Test:** Right-click a bookmark, select "Export stems", observe progress, then interact with mixer
**Expected:** SeparationProgress shows chunk-by-chunk progress with percentage and ETA. On completion, StemMixer slides up from bottom with 4 stem rows (drums, bass, vocals, other), each with canvas waveform, solo/mute controls. Play button produces audible synchronized output.
**Why human:** Multi-component integration requiring gRPC streaming, Tauri events, and Web Audio API playback -- cannot verify integration without running app.

### 3. Audio export with JSON sidecar

**Test:** Right-click a bookmark, select "Export audio"
**Expected:** WAV file appears in ~/wallflower/exports/{jam-name}/{bookmark-name}.wav with .json sidecar file alongside containing key, BPM, tags, collaborators, instruments
**Why human:** File I/O and path resolution with tilde expansion need runtime verification.

### 4. Stem playback synchronization and controls

**Test:** In StemMixer, load stems, press play, toggle solo/mute during playback
**Expected:** All stems play in sync, solo isolates one stem, mute silences one stem without restarting playback, GainNode routing updates in real-time
**Why human:** Web Audio API synchronized playback requires runtime audio hardware verification.

### Gaps Summary

No code-level gaps found. All 4 roadmap success criteria are supported by substantive, wired, data-flowing artifacts. The previous verification gap (drag-to-select) has been resolved with a custom pointer event implementation replacing the problematic RegionsPlugin enableDragSelection approach. 4 items require human verification to confirm the runtime behavior matches the code-level implementation.

---

_Verified: 2026-04-24T15:50:43Z_
_Verifier: Claude (gsd-verifier)_
