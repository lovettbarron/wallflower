# Phase 2: Playback, Metadata, Design System & Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 02-playback-metadata-design-system-notifications
**Areas discussed:** Design system & visual language, Waveform viewer & playback, Timeline browser & library layout, Metadata editing experience

---

## Design System & Visual Language

### Design Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Lean Mutable Instruments | Warmer, more playful — rounded corners, organic shapes, generous whitespace, bold accent colors. Fits the creative/jam vibe. | ✓ |
| Lean Intellijel | More structured, grid-based, precise spacing. Clean and logical. Better for dense information display. | |
| Blend both | MI warmth for chrome/navigation, Intellijel structure for data-heavy views. | |

**User's choice:** Lean Mutable Instruments
**Notes:** None

### Color Mood

| Option | Description | Selected |
|--------|-------------|----------|
| Dark with warm accents | Dark background with warm accent colors (amber, coral, gold). Studio feel. | |
| Light with bold accents | Light/cream background with saturated accents. More like MI's panel aesthetic. | |
| Dark with cool accents | Dark background with cooler accents (teal, blue, violet). Electronic feel. | |
| Both (dark default, light option) | Ship dark theme first but design tokens support a light variant. | ✓ |

**User's choice:** Both (dark default, light option)
**Notes:** None

### Typography

| Option | Description | Selected |
|--------|-------------|----------|
| Geometric sans-serif | Clean, modern, slightly playful — e.g., Inter, Plus Jakarta Sans. Good readability at all sizes. | ✓ |
| Monospace for data, sans for UI | Monospace font for timestamps/BPM/key values, sans-serif for everything else. | |
| You decide | Claude picks a font pairing. | |

**User's choice:** Geometric sans-serif
**Notes:** None

### Implementation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind + custom tokens | Extend Tailwind config with custom design tokens. Build components as React + Tailwind. | ✓ |
| Tailwind + shadcn/ui base | Use shadcn/ui as a starting point, restyle heavily. Gives accessible primitives for free. | |
| You decide | Claude picks the approach. | |

**User's choice:** Tailwind + custom tokens
**Notes:** None

---

## Waveform Viewer & Playback

### Waveform Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Overview + detail | Small overview bar showing full recording, zoomable detail view below. Like Ableton's arrangement view. | ✓ |
| Scroll-to-zoom | Single waveform that zooms with scroll/pinch. Simpler but can feel lost in long files. | |
| Fixed zoom levels | Preset zoom levels with a zoom selector. Predictable but less fluid. | |

**User's choice:** Overview + detail
**Notes:** None

### Waveform Overlays

| Option | Description | Selected |
|--------|-------------|----------|
| Section markers + key/tempo badges | Colored section boundaries with small badges. Clean, not cluttered. | ✓ |
| Rich overlays | Section markers, chord changes, beat grid, loop brackets all visible. Information-dense. | |
| Minimal — waveform only | Keep waveform clean, all info in panels. | |

**User's choice:** Section markers + key/tempo badges
**Notes:** None

### Playback Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent bottom bar | Fixed transport bar at the bottom. Always visible. Like Spotify/Apple Music. | ✓ |
| Inline with waveform | Controls embedded in the waveform view. Only visible when viewing a jam. | |
| You decide | Claude picks the layout. | |

**User's choice:** Persistent bottom bar
**Notes:** None

### Audio Path

| Option | Description | Selected |
|--------|-------------|----------|
| Rust backend streaming | Backend serves audio via HTTP range requests. Handles format conversion, 32-bit float. | ✓ |
| Web Audio API direct | Frontend reads files directly via Tauri's asset protocol. More direct but memory concerns. | |
| You decide | Claude picks based on technical constraints. | |

**User's choice:** Rust backend streaming
**Notes:** None

---

## Timeline Browser & Library Layout

### Timeline Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Cards grouped by date | Cards with jam info grouped under date headers. Click to open detail. | ✓ |
| Vertical timeline | Visual timeline with jams as nodes. More visual but harder to scan. | |
| Enhanced list/table | Rich table with sortable columns. Dense and scannable. | |
| You decide | Claude picks. | |

**User's choice:** Cards grouped by date
**Notes:** None

### Card Content

| Option | Description | Selected |
|--------|-------------|----------|
| Mini waveform thumbnail | Small waveform preview from pre-computed peaks. | ✓ |
| Duration + date/time | How long and when. | ✓ |
| Tags + collaborators | User-added tags and who played. | ✓ |
| Key + BPM (when available) | Musical metadata from AI analysis (Phase 4+). | ✓ |

**User's choice:** All four options selected
**Notes:** Multi-select — user wants all info on cards

### Navigation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Click card → detail view | Full jam detail page with waveform and metadata. Back button returns. | ✓ |
| Expandable cards | Cards expand inline. No page navigation. | |
| Side panel | Library left, detail right. Split view. | |

**User's choice:** Click card → detail view
**Notes:** None

### Tab Bar Evolution

| Option | Description | Selected |
|--------|-------------|----------|
| Keep top tabs, add views | Library (timeline) \| Settings. Jam detail is drill-down within Library. | ✓ |
| Switch to sidebar | Left sidebar for Library, Settings, future views. | |
| You decide | Claude picks. | |

**User's choice:** Keep top tabs, add views
**Notes:** None

---

## Metadata Editing Experience

### Metadata Location

| Option | Description | Selected |
|--------|-------------|----------|
| Below waveform in detail view | Waveform on top, metadata sections below. Everything in one scrollable page. | ✓ |
| Tabbed panels in detail view | Tabbed sections below waveform. Organized but adds clicks. | |
| Sidebar panel | Waveform full width, metadata in collapsible right sidebar. | |

**User's choice:** Below waveform in detail view
**Notes:** None

### Tag System

| Option | Description | Selected |
|--------|-------------|----------|
| Free-form with autocomplete | Type to add, autocomplete from history. No predefined categories. | ✓ |
| Categorized tags | Tags organized into categories (genre, mood, technique, gear). | |
| You decide | Claude picks. | |

**User's choice:** Free-form with autocomplete
**Notes:** None

### Photo/Patch Attachment

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-drop + auto-attach | Drag photos into jam detail. Watch ~/wallflower/patches/ for auto-attach. Toast on auto-attach. | ✓ |
| Drag-drop only | Manual drag-drop or file picker. No auto-attach. | |
| Camera capture integration | Add "take photo" button for macOS camera/screenshot. | |

**User's choice:** Drag-drop + auto-attach
**Notes:** None

### Collaborators & Instruments

| Option | Description | Selected |
|--------|-------------|----------|
| Tag-style chips with autocomplete | Same pattern as tags. Type, autocomplete, displayed as chips. Consistent UX. | ✓ |
| Structured fields | Separate form fields per collaborator with instrument dropdown. | |
| You decide | Claude picks. | |

**User's choice:** Tag-style chips with autocomplete
**Notes:** None

---

## Claude's Discretion

- Specific notification event list and grouping behavior
- Waveform color scheme within the design system
- Exact spacing/sizing design tokens
- Photo gallery layout in jam detail view
- Date grouping thresholds for timeline
- Light theme color mapping

## Deferred Ideas

None — discussion stayed within phase scope
