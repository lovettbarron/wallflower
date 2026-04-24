# Phase 7: Sample Browser & Extract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 07-sample-browser-extract
**Areas discussed:** Sample list layout, Inline preview, Filter & search UX, Export from browser

---

## Sample List Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Dense table | Rows with sortable columns, compact, like Ableton's browser | ✓ |
| Card grid | Cards with mini waveform thumbnail, more visual, fewer items visible | |
| List rows | Each row shows name, badges, play button, like Spotify's track list | |

**User's choice:** Dense table
**Notes:** Aligns with how Ableton's browser works — compact and scannable.

| Option | Description | Selected |
|--------|-------------|----------|
| Flat mixed list | All types in one list with Type column and color-coded badges | ✓ |
| Grouped by type | Three collapsible sections: Bookmarks, Loops, Sections | |
| Tabbed by type | Sub-tabs within Explore: All / Bookmarks / Loops / Sections | |

**User's choice:** Flat mixed list

| Option | Description | Selected |
|--------|-------------|----------|
| Essential 6 | Play | Name | Type | Source Jam | Key | BPM | Duration | ✓ |
| Essential + tags | Same plus Tags column with chip badges | |
| Minimal 4 | Play | Name | Key | BPM | |

**User's choice:** Essential 6 columns

| Option | Description | Selected |
|--------|-------------|----------|
| Self-contained | Clicking selects for preview, link on source jam to navigate | ✓ |
| Click navigates to jam | Clicking row takes you to jam detail view | |

**User's choice:** Self-contained browser

| Option | Description | Selected |
|--------|-------------|----------|
| Color dot on name | Small colored dot matching bookmark's assigned color | ✓ |
| No color indicator | Keep table uniform | |
| Full row tint | Subtle row background tint | |

**User's choice:** Color dot on name

| Option | Description | Selected |
|--------|-------------|----------|
| Helpful prompt | Friendly message with link to Library tab | ✓ |
| You decide | Claude picks empty state design | |

**User's choice:** Helpful prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, as badges | Repeat count as "×3" badge, evolving indicator icon | ✓ |
| No, just name and duration | Keep it simple | |

**User's choice:** Yes, as badges

---

## Inline Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom preview panel | Persistent panel at bottom, waveform + play/pause + scrubbing | ✓ |
| Inline row expand | Clicking row expands in-place with waveform below | |
| Play button only | Just play/stop toggle, audio through TransportBar | |

**User's choice:** Bottom preview panel
**Notes:** Similar to stem mixer slide-up from Phase 5.

| Option | Description | Selected |
|--------|-------------|----------|
| Full wavesurfer waveform | Reuse WaveformDetail, interactive scrubbing, zoom | ✓ |
| Simple progress bar | Just playback progress bar with time | |
| Static waveform image | Pre-rendered thumbnail, no interactivity | |

**User's choice:** Full wavesurfer waveform

| Option | Description | Selected |
|--------|-------------|----------|
| Play triggers preview | Clicking play selects row AND starts playback | ✓ |
| Separate behaviors | Play does inline playback, click selects for panel | |

**User's choice:** Play button triggers preview

---

## Filter & Search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Adapted FilterBar | Reuse chip-based FilterBar with sample dimensions | |
| Sidebar filters | Left sidebar with stacked controls, DAW browser style | ✓ |
| Search-first | Prominent search bar, filters behind toggle | |

**User's choice:** Sidebar filters
**Notes:** Differentiates Explore tab from Library tab's chip-based filters.

| Option | Description | Selected |
|--------|-------------|----------|
| Full set | Type, Key, Tempo range, Duration range, Source jam, Tags | ✓ |
| Core + expandable | Type, Key, Tempo visible; others collapsed behind "More" | |
| Minimal | Just Type toggles and free-text search | |

**User's choice:** Full filter set

| Option | Description | Selected |
|--------|-------------|----------|
| Top of sidebar | Search bar at top of filter sidebar | ✓ |
| Above the table | Full-width search above table | |
| No text search | Rely on sidebar filters only | |

**User's choice:** Top of sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, toggle button | Toggle arrow, collapsed shows filter count icon | ✓ |
| Always visible | Fixed width sidebar | |
| You decide | Claude picks approach | |

**User's choice:** Collapsible with toggle

---

## Export from Browser

| Option | Description | Selected |
|--------|-------------|----------|
| Preview panel export button | Export Audio / Export Stems in bottom panel | ✓ |
| Row context menu | Right-click or three-dot menu per row | |
| Both panel + context menu | Export available in both locations | |

**User's choice:** Preview panel export button

| Option | Description | Selected |
|--------|-------------|----------|
| Export directly | Sections/loops export without creating bookmark first | ✓ |
| Create bookmark first | Auto-create bookmark, then export | |
| Prompt to bookmark | Ask user each time | |

**User's choice:** Export directly

| Option | Description | Selected |
|--------|-------------|----------|
| Available for all types | Any sample can trigger separation | ✓ |
| Bookmarks only | Stem export only for bookmarks | |

**User's choice:** Available for all types

---

## Claude's Discretion

- Backend API design for cross-jam sample aggregation
- SQLite query optimization for cross-jam filtering
- Sidebar width, responsive behavior, table row height
- Preview panel height and animation
- Sort default order
- Keyboard shortcuts for table navigation

## Deferred Ideas

None — discussion stayed within phase scope
