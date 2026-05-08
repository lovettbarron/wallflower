---
slug: waveform-zoom
status: complete
created: 2026-05-08
---

# Waveform Zoom — Summary

## What changed

Added zoom functionality to the detail waveform for precise bookmark/loop selection.

### Features
- **Pinch/Ctrl+scroll zoom** on the detail waveform — zooms centered on cursor position
- **Overview viewport indicator** — when zoomed, the overview waveform dims areas outside the visible range and draws a border around the viewport
- **Double-click to zoom** — double-clicking a bookmark region, section marker, or loop bracket auto-zooms to that range (with 10% padding)
- **Single-click plays** — single-clicking a bookmark on the waveform now plays it (seek + active loop + play)
- **Reset zoom** — button appears when zoomed, also Escape key resets zoom
- **Section/loop markers stay synced** — overlays scroll with the waveform via CSS transform, positioned across the full scrollable width

### Files modified
- `WaveformDetail.tsx` — Added zoom state, wheel handler, viewport tracking, overlay sync, zoomToRange/resetZoom via forwardRef
- `WaveformOverview.tsx` — Enhanced viewport indicator (dim outside + border)
- `JamDetail.tsx` — Wired viewport between overview/detail, changed bookmark click=play, double-click=zoom
- `SectionMarkers.tsx` — Added `onSectionDoubleClick` prop
- `LoopBrackets.tsx` — Added `onLoopDoubleClick` prop
