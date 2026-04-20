# Phase 5: Source Separation & Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 05-source-separation-export
**Areas discussed:** Bookmarking UX, Export workflow, Source separation UX, Chunked processing

---

## Bookmarking UX

### How should users create bookmarks?

| Option | Description | Selected |
|--------|-------------|----------|
| Click-drag regions | Click and drag on waveform to select time range, confirm as bookmark. Matches Ableton/Logic. | ✓ |
| Snap to sections | Tap section markers to bookmark, fine-tune edges after. Leverages Phase 4 analysis. | |
| In/out markers | Set in/out points independently like video editing. Two clicks define a region. | |

**User's choice:** Click-drag regions
**Notes:** None

### Should bookmarks snap to detected sections/loops?

| Option | Description | Selected |
|--------|-------------|----------|
| Snap-assist | Free drag default, edges snap to nearby section boundaries when close. Modifier key disables snap. | ✓ |
| Free drag only | No snapping behavior. Always exact boundaries. | |
| Snap by default | Always snap, modifier key for free drag. | |

**User's choice:** Snap-assist
**Notes:** None

### What metadata should a bookmark carry?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + color | User-editable name, color from palette. Lightweight. | |
| Name + color + notes | Above plus free-text notes field per bookmark. | ✓ |
| Full metadata | Name, color, notes, tags, instrument labels. Mini-jams. | |

**User's choice:** Name + color + notes
**Notes:** None

### How should bookmarks relate to Phase 4 section markers?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate layer above | Bookmarks as distinct colored region layer above section markers. Both visible. | ✓ |
| Same layer, different style | Share overlay space, use distinct visual treatments. | |
| Bookmarks replace sections | Bookmark takes visual priority over covered sections. | |

**User's choice:** Separate layer above
**Notes:** None

---

## Export Workflow

### How should the export flow work from a bookmark?

| Option | Description | Selected |
|--------|-------------|----------|
| Context menu on bookmark | Right-click/menu icon for export options. Quick, in-context. | ✓ |
| Export panel/sidebar | Dedicated panel listing all bookmarks with batch export. | |
| Export dialog per bookmark | Modal dialog with all options per export. | |

**User's choice:** Context menu on bookmark
**Notes:** None

### How should exported files be organized?

| Option | Description | Selected |
|--------|-------------|----------|
| Jam name / bookmark name | ~/wallflower/exports/[Jam]/[Bookmark].wav with stems subfolder. | ✓ |
| Flat with prefixes | All in exports/ with naming prefixes. | |
| Date-based folders | Groups by month. | |

**User's choice:** Jam name / bookmark name
**Notes:** None

### What export format options?

| Option | Description | Selected |
|--------|-------------|----------|
| WAV 24-bit default, configurable | Default WAV 24-bit, change in Settings. No per-export dialog. | ✓ |
| Per-export format choice | Format picker on each export. | |
| WAV 24-bit only | No options, always WAV 24-bit. | |

**User's choice:** WAV 24-bit default, configurable
**Notes:** None

### Self-contained export contents?

| Option | Description | Selected |
|--------|-------------|----------|
| Audio + metadata sidecar | Audio files plus JSON sidecar with jam metadata. | ✓ |
| Audio only | Just WAV/FLAC files. | |
| ZIP bundle | Audio + metadata packaged as .zip. | |

**User's choice:** Audio + metadata sidecar
**Notes:** None

---

## Source Separation UX

### When should source separation run?

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand per bookmark | Only when user clicks "Export stems." Processes bookmarked range only. | ✓ |
| Background on full jam | Queue full-jam separation after Phase 4 analysis. Pre-computed. | |
| Hybrid | First export runs full separation, cache for subsequent exports. | |

**User's choice:** On-demand per bookmark
**Notes:** None

### Should users preview/audition stems before exporting?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, inline audition | Stem mixer with solo/mute per stem after separation completes. | ✓ |
| No preview, direct export | Immediately write files. | |
| Preview optional via separate action | Separate "Separate" and "Export" actions. | |

**User's choice:** Yes, inline audition
**Notes:** None

### How should the stem mixer panel appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-up panel in jam detail | Slides up from bottom, replaces metadata temporarily. Waveform stays visible. | ✓ |
| Modal dialog | Full modal overlay. | |
| Sidebar panel | Right sidebar. | |

**User's choice:** Slide-up panel in jam detail
**Notes:** None

### Which demucs stems?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard 4-stem | htdemucs: drums, bass, vocals, other. | |
| 6-stem model | htdemucs_6s: adds guitar and piano. | |
| User-selectable model | Choose between 4-stem and 6-stem in Settings. | ✓ |

**User's choice:** User-selectable model
**Notes:** Leverages Phase 4 abstracted model interface (AI-08)

---

## Chunked Processing

### How should separation progress be reported?

| Option | Description | Selected |
|--------|-------------|----------|
| Chunk-aware progress bar | Overall %, chunk progress, time estimate, cancel button. | ✓ |
| Simple spinner | Spinner with "Separating..." text. | |
| Background with notification | Runs in background, toast when complete. | |

**User's choice:** Chunk-aware progress bar
**Notes:** None

### What happens if recording starts during separation?

| Option | Description | Selected |
|--------|-------------|----------|
| Pause and resume after | Pause via PriorityScheduler, resume from last chunk after recording. | ✓ |
| Cancel and re-queue | Cancel entirely, re-trigger manually after. | |
| Continue in background | Violates REC-08. | |

**User's choice:** Pause and resume after
**Notes:** Consistent with Phase 3/4 recording priority pattern

### Memory limit configuration?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect with override | Detect available memory, default ~4GB for separation, configurable in Settings. | ✓ |
| Fixed 8GB ceiling | Hard-coded maximum. | |
| Fully configurable | Chunk size, overlap, memory all exposed. | |

**User's choice:** Auto-detect with override
**Notes:** Ties into Phase 4 hardware profiles (D-20)

---

## Claude's Discretion

- gRPC service extension design
- SQLite schema for bookmarks and exports
- Chunk size and overlap-add strategy
- Stem caching strategy
- Bookmark color palette
- Snap-assist threshold and modifier key
- JSON sidecar format
- Export filename sanitization

## Deferred Ideas

None — discussion stayed within phase scope
