---
phase: 1
slug: tauri-app-shell-storage-api-foundation
status: draft
shadcn_initialized: false
preset: pending-scaffolding
created: 2026-04-18
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the app shell, file list, settings, and import flows. Phase 1 is intentionally minimal and functional — the full design language (DES-01) arrives in Phase 2. This contract establishes foundational tokens and component patterns that Phase 2 will refine.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialize during Tauri+Next.js scaffolding) |
| Preset | default — customize in Phase 2 when design language is defined |
| Component library | radix (via shadcn) |
| Icon library | lucide-react (shadcn default) |
| Font | system font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif |

**Note:** shadcn must be initialized when the Next.js frontend is scaffolded (Plan 01-01 or equivalent). Run `npx shadcn init` with default preset. Phase 2 will customize the preset to match the Mutable Instruments / Intellijel design language.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding within table cells |
| sm | 8px | Table cell padding, compact element spacing |
| md | 16px | Default element spacing, form field gaps |
| lg | 24px | Section padding inside cards and panels |
| xl | 32px | Tab bar padding, layout gaps between major sections |
| 2xl | 48px | Page margins (left/right) |
| 3xl | 64px | Page-level vertical spacing (top of content area) |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 (regular) | 1.5 |
| Label | 12px | 500 (medium) | 1.4 |
| Heading | 20px | 600 (semibold) | 1.2 |
| Display | 28px | 600 (semibold) | 1.2 |

**Phase 1 usage:**
- Body (14px): File list rows, settings descriptions, toast messages, dialog body text
- Label (12px): Table column headers, form labels, metadata labels (format, duration), tab labels
- Heading (20px): Page titles ("Library", "Settings"), dialog titles ("Import from Device")
- Display (28px): Empty state heading only

**Note:** 3 weights declared (400, 500, 600) — Label uses 500 to differentiate from body text at smaller size. Phase 2 may consolidate to 2 weights when the design language is finalized.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | hsl(0 0% 100%) / #FFFFFF | Page background, content area |
| Secondary (30%) | hsl(0 0% 97%) / #F7F7F7 | Tab bar background, settings sections, table header row, drag-drop zone |
| Accent (10%) | hsl(173 58% 39%) / #29A08A | Import button, active tab indicator, progress bar fill, file count badge |
| Destructive | hsl(0 72% 51%) / #D93636 | Remove file action only |

Accent reserved for: import button (primary CTA), active tab underline/indicator, import progress bar fill, file count badge in tab

**Color rationale:** The teal accent is a starting point inspired by Mutable Instruments' palette. Phase 2 will finalize the exact accent color as part of the full design language. All other surfaces use neutral grays to avoid committing to a palette prematurely.

**Dark mode:** Not in scope for Phase 1. Phase 2 design system will establish light/dark tokens via shadcn CSS variables.

---

## Component Inventory

Components needed for Phase 1 UI. All sourced from shadcn official registry unless noted.

| Component | Source | Usage |
|-----------|--------|-------|
| Button | shadcn | Import button (primary), settings save, dialog actions |
| Table | shadcn | File list (filename, date, duration, format columns) |
| Tabs | shadcn | Top navigation (Library, Settings) |
| Dialog | shadcn | USB device import prompt, sync folder warning |
| Toast / Sonner | shadcn | Duplicate detection notification, import complete, errors |
| Input | shadcn | Settings fields (folder paths) |
| Label | shadcn | Settings form labels |
| Progress | shadcn | Import progress bar |
| Card | shadcn | Settings sections grouping |
| Badge | shadcn | File format indicator (WAV, FLAC, MP3) |
| Separator | shadcn | Visual dividers in settings |

---

## Layout Contract

### App Shell

```
+--------------------------------------------------+
| [Wallflower]              (native title bar)      |
+--------------------------------------------------+
| [ Library ]  [ Settings ]        (top tab bar)    |
+--------------------------------------------------+
|                                                    |
|  (active tab content area)                         |
|                                                    |
+--------------------------------------------------+
|  (status bar: import progress, watch status)       |
+--------------------------------------------------+
```

- Title bar: Native Tauri window chrome (macOS traffic lights). No custom title bar.
- Tab bar: Full width, secondary background, xl (32px) horizontal padding, md (16px) vertical padding. Active tab uses accent underline (2px).
- Content area: 2xl (48px) horizontal padding, lg (24px) top padding.
- Status bar: Fixed bottom, sm (8px) vertical padding, 2xl (48px) horizontal padding. Shows import progress and folder watch status.

### Library Tab — File List

```
+--------------------------------------------------+
|  Library                           [Import Files] |
|                                                    |
|  Filename        Date        Duration    Format    |
|  ------------------------------------------------ |
|  jam-2026-04.wav  Apr 18     1:23:45     WAV      |
|  session-03.flac  Apr 17     0:45:12     FLAC     |
|  ...                                               |
|                                                    |
+--------------------------------------------------+
|  +--------------------------------------------+   |
|  |  Drop audio files here to import            |   |
|  |  or click Import Files above                |   |
|  +--------------------------------------------+   |
+--------------------------------------------------+
```

- Table: Full width, alternating row colors not used (clean flat rows). Row height 44px (touch-friendly).
- Drag-drop zone: Dashed border (1px, secondary color), rounded-lg (8px radius), md (16px) padding. Located below the table. On drag-over: accent border color, light accent background tint.
- Import button: Primary variant (accent background, white text), top-right aligned with page heading.

### Library Tab — Empty State

```
+--------------------------------------------------+
|                                                    |
|           (centered vertically)                    |
|                                                    |
|        No jams in your library yet                |
|                                                    |
|    Drop audio files here or click Import Files     |
|    to get started. You can also add files to       |
|    ~/wallflower and they'll appear automatically.  |
|                                                    |
|              [Import Files]                        |
|                                                    |
+--------------------------------------------------+
```

### Settings Tab

```
+--------------------------------------------------+
|  Settings                                          |
|                                                    |
|  +-- Watch Folder --------------------------+     |
|  | Watch folder path                         |     |
|  | [~/wallflower                    ] [Browse]|    |
|  |                                           |     |
|  | Audio storage location                    |     |
|  | [~/Library/Application Support/...] [Browse]|   |
|  +-------------------------------------------+    |
|                                                    |
|  +-- Import Behavior -----------------------+     |
|  | Duplicate handling                        |     |
|  | (o) Skip duplicates (show notification)   |     |
|  | ( ) Always import (create copy)           |     |
|  +-------------------------------------------+    |
|                                                    |
|  +-- About ---------------------------------+     |
|  | Wallflower v0.1.0                         |     |
|  | andrewlb.com  |  GitHub Repository        |     |
|  +-------------------------------------------+    |
|                                                    |
+--------------------------------------------------+
```

- Settings sections: Card components, lg (24px) padding, md (16px) gap between cards.
- Form fields: Full width within card, md (16px) gap between fields.

---

## Interaction States

### Drag-and-Drop Import
| State | Visual |
|-------|--------|
| Default | Dashed border (secondary color), "Drop audio files here" text in muted foreground |
| Drag over | Solid border (accent color), light accent background (10% opacity), "Release to import" text |
| Processing | Progress bar appears in status bar, drop zone returns to default |

### USB Device Detection Dialog
| State | Visual |
|-------|--------|
| Trigger | Dialog opens automatically when Zoom F3 or compatible USB recorder is mounted |
| Content | Title: "Import from [Device Name]". List of new audio files with checkboxes. Select all / deselect all. |
| Actions | "Import Selected" (primary/accent), "Skip" (ghost/secondary) |

### Sync Folder Warning Dialog
| State | Visual |
|-------|--------|
| Trigger | First launch or settings change when watch folder is inside Dropbox/iCloud |
| Content | Title: "Sync Folder Detected". Body explains risk of file corruption with cloud sync. |
| Actions | "Change Folder" (primary/accent), "Keep Current Folder" (ghost/secondary) |

### Toast Notifications
| Event | Copy | Duration |
|-------|------|----------|
| Duplicate detected | "Already imported: {filename}" | 4 seconds |
| Import complete (single) | "{filename} imported" | 3 seconds |
| Import complete (batch) | "{count} files imported" | 4 seconds |
| Import error | "Could not import {filename}: {reason}" | 6 seconds, with dismiss button |
| Watch folder active | "Watching ~/wallflower for new files" | 3 seconds (on app launch) |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Import Files" |
| Empty state heading | "No jams in your library yet" |
| Empty state body | "Drop audio files here or click Import Files to get started. You can also add files to ~/wallflower and they'll appear automatically." |
| Error state (import) | "Could not import {filename}: {reason}. Check the file format is WAV, FLAC, or MP3 and try again." |
| Error state (database) | "Unable to access library database. Check that ~/Library/Application Support/wallflower is accessible." |
| Destructive confirmation | Not applicable in Phase 1 (no delete functionality) |
| Drag-drop default | "Drop audio files here to import" |
| Drag-drop active | "Release to import" |
| USB dialog title | "Import from {device name}" |
| USB dialog body | "{count} new recordings found on {device name}" |
| USB primary action | "Import Selected" |
| USB secondary action | "Skip" |
| Sync warning title | "Sync Folder Detected" |
| Sync warning body | "Your watch folder is inside {Dropbox/iCloud}. Cloud sync can cause file corruption during import. We recommend using a local folder instead." |
| Sync warning primary | "Change Folder" |
| Sync warning secondary | "Keep Current Folder" |
| Settings — watch folder label | "Watch folder path" |
| Settings — storage label | "Audio storage location" |
| Settings — duplicate label | "Duplicate handling" |
| Tab — library | "Library" |
| Tab — settings | "Settings" |
| Status — watching | "Watching {path}" |
| Status — importing | "Importing {filename}..." |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Button, Table, Tabs, Dialog, Toast/Sonner, Input, Label, Progress, Card, Badge, Separator | not required |

No third-party registries declared.

---

## Phase 1 Specific Notes

1. **This is a foundation phase.** The UI is intentionally functional, not polished. Phase 2 introduces the full Mutable Instruments / Intellijel design language and will update tokens, colors, and typography.

2. **shadcn initialization** must happen during project scaffolding. The default preset is sufficient for Phase 1. Phase 2 will customize the preset.

3. **No dark mode** in Phase 1. The shadcn CSS variable system supports it, but the color contract above is light-mode only.

4. **Accessibility baseline:** Even in Phase 1's minimal UI, all interactive elements must have visible focus rings (2px accent outline, 2px offset), and all form inputs must have associated labels. Full accessibility audit is Phase 6.

5. **File list is not paginated** in Phase 1. A musician's library at this stage will be small. Virtual scrolling or pagination will be added if needed in Phase 2+.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
