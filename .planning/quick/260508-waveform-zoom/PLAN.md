---
slug: waveform-zoom
status: in-progress
created: 2026-05-08
---

# Waveform Zoom

Add zoom functionality to the detail waveform for precise bookmark selection.

## Tasks

1. WaveformDetail: Add wheel zoom handler (Ctrl+scroll / pinch), expose viewport position callback, add `zoomToRange` support
2. WaveformOverview: Wire viewport indicator, allow click-to-seek while zoomed
3. JamDetail: Manage zoom state, pass viewport between components, wire double-click on bookmarks/loops to zoom
4. Bookmark single-click plays, double-click zooms (repurpose from edit)
