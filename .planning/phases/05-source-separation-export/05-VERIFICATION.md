---
status: gaps_found
phase: 05-source-separation-export
verified_at: 2026-04-20
---

# Phase 05 Verification (Partial — Pre-Verifier)

## Execution Status

All 5 plans executed and merged. Verification checkpoint reached.

## Known Gaps

### GAP-1: Waveform drag-to-select bookmark not working

**Severity:** must-have (core Phase 5 interaction)
**Component:** `src/components/waveform/WaveformDetail.tsx`
**Description:** Dragging across the waveform to create a bookmark region does not produce any visible result. The RegionsPlugin's `enableDragSelection` is called but the drag gesture appears to be consumed or ignored.

**What was tried:**
- Memoized the plugins array to prevent wavesurfer recreation on every render (committed as `e01edd7`)
- Added proper cleanup for `enableDragSelection` return value
- These fixes did not resolve the issue

**Investigation notes:**
- wavesurfer.js 7.12.6, @wavesurfer/react 1.x
- RegionsPlugin is created via `useMemo`, passed to `useWavesurfer` via memoized array
- `enableDragSelection` is called after `isReady` becomes true
- `interact: true` is set on wavesurfer (enables click-to-seek)
- The `region-created` handler removes the temp region and calls `onBookmarkDragEnd` to show BookmarkPopover
- Possible causes: pointer event conflict between wavesurfer's interaction handler and RegionsPlugin's drag handler; WKWebView pointer event differences; wavesurfer `interact` mode consuming drag gestures

**Required fix:** Drag across waveform must create a visible selection region that triggers the BookmarkPopover on release.

## Must-Have Checklist

- [x] Bookmark CRUD (backend + frontend)
- [ ] Drag-to-select bookmark creation on waveform ← GAP-1
- [x] Bookmark list with context menu
- [x] Audio export (time-slice WAV + JSON sidecar)
- [x] Stem separation (demucs-mlx via gRPC)
- [x] Stem mixer panel
- [x] Export settings
