# Phase 2: Playback, Metadata, Design System & Notifications - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see waveforms, play and scrub audio (including 120-minute files), browse their jam library chronologically, edit rich metadata (tags, collaborators, instruments, location, notes, photos), experience the Wallflower design language, and receive native macOS notifications for key events. This phase transforms the Phase 1 functional file list into a polished, design-driven experience.

</domain>

<decisions>
## Implementation Decisions

### Design System & Visual Language
- **D-01:** Design tone leans Mutable Instruments — warm, playful, rounded corners, organic shapes, generous whitespace, bold accent colors. Fits the creative/jam vibe.
- **D-02:** Color palette is dark with warm accents as default (charcoal/near-black background, amber/coral/gold accents). Design tokens support a light theme variant for future use.
- **D-03:** Typography uses a geometric sans-serif (e.g., Inter, Plus Jakarta Sans). Clean, modern, slightly playful. Good readability at all sizes.
- **D-04:** Implementation via Tailwind CSS with custom design tokens (colors, spacing, border-radius). No component library dependency — build components as React + Tailwind.

### Waveform Viewer & Playback
- **D-05:** Overview + detail navigation model. Small overview bar showing the full recording, with a zoomable detail view below. Click overview to jump to position. Handles 120-minute files naturally (like Ableton's arrangement view).
- **D-06:** Waveform overlays: section markers (colored boundaries) and key/tempo badges. Clean, not cluttered. Detailed analysis info lives in panels below, not on the waveform. Overlay content appears progressively as analysis results become available (Phase 4+).
- **D-07:** Persistent bottom transport bar for playback controls — play/pause, scrub position, time display. Always visible regardless of which view the user is in.
- **D-08:** Audio playback via Rust backend streaming (HTTP range requests). Frontend uses standard audio element or wavesurfer with backend-served audio. Handles format conversion, 32-bit float, keeps large files off the webview heap.

### Timeline Browser & Library Layout
- **D-09:** Jam cards grouped by date headers (Today, Yesterday, March 15, etc.). Each card shows: mini waveform thumbnail, duration + date/time, tags + collaborators, key + BPM (placeholder until Phase 4 analysis).
- **D-10:** Click card navigates to full jam detail page (waveform + metadata). Back button returns to library. Clean separation between browse and detail views.
- **D-11:** Top tab bar navigation continues from Phase 1: Library (timeline) | Settings. Jam detail is a drill-down within Library, not a separate tab. Keeps navigation simple and consistent.

### Metadata Editing
- **D-12:** Metadata editing lives below the waveform in the jam detail view. Tags, collaborators, instruments, notes, location, photos all in one scrollable page. Everything about a jam in one place.
- **D-13:** Tags are free-form with autocomplete from previously used tags. No predefined categories. Flexible, fast, learns the user's vocabulary over time.
- **D-14:** Collaborators and instruments use the same tag-style chip pattern with autocomplete. Consistent UX across all metadata types.
- **D-15:** Photo/patch attachment via drag-drop into jam detail view, plus auto-attach from watched ~/wallflower/patches/ folder. New photos in the patches folder auto-attach to the most recent or active jam with a toast notification.
- **D-16:** All metadata changes live-save immediately — no explicit save button (per META-09).

### Notifications
- **D-17:** Native macOS notifications for key events (device connected, import complete, analysis complete). Implementation via Tauri v2 notification API (INFRA-11). Specific notification triggers are Claude's discretion based on the event types available.

### Claude's Discretion
- Specific notification event list and grouping behavior
- Waveform color scheme and visual treatment within the design system
- Exact spacing/sizing tokens for the design system
- Photo gallery layout within the jam detail view
- Date grouping logic for timeline (how far back before grouping by week/month)
- Light theme color mapping (dark ships first)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` — Full technology stack with version pinning, wavesurfer.js 7.11.x, @wavesurfer/react 1.0.x, Tailwind CSS 4.x, zustand 5.x, @tanstack/react-query 5.x
- `.planning/PROJECT.md` — Project vision, constraints, target hardware (M4 Mac Mini)
- `.planning/REQUIREMENTS.md` — PLAY-01 through PLAY-05, META-01 through META-09, DES-01/05/06, INFRA-11

### Phase 1 Foundation
- `.planning/phases/01-tauri-app-shell-storage-api-foundation/01-CONTEXT.md` — Phase 1 decisions (tab bar navigation D-06, Tauri IPC D-12, settings UI D-07/D-08)
- `.planning/phases/01-tauri-app-shell-storage-api-foundation/01-UI-SPEC.md` — Phase 1 UI design contract (component patterns, layout established)

### Design Reference
- DES-01 in REQUIREMENTS.md — "Playful, clean, big design language inspired by Mutable Instruments (generous whitespace, bold accent colors, rounded organic shapes) and Intellijel (structured logical sections)"
- DES-05 — Wireframes generated and approved before UI implementation
- DES-06 — UI accepts photo sketches as design input

### Technology
- wavesurfer.js 7.11.x docs — Waveform rendering, regions plugin, zoom/scroll
- @wavesurfer/react 1.0.x — React hooks integration for wavesurfer
- Tauri v2 notification API — Native macOS notification support

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 establishes: Tauri v2 project structure, SQLite schema/migrations, Tauri command pattern, Tailwind CSS foundation, zustand state management pattern
- Top tab bar component (Library | Settings) from Phase 1
- File list component from Phase 1 — will be replaced by card-based timeline but import/status patterns may carry over

### Established Patterns
- Tauri IPC commands for frontend-backend communication (D-12 from Phase 1)
- SQLite via rusqlite with WAL mode for concurrent access
- Atomic file operations (temp-then-rename) for sync-folder safety
- zustand for client state, @tanstack/react-query for server state

### Integration Points
- Waveform peaks: backend must pre-compute multi-resolution peaks and serve them via API (PLAY-01)
- Audio streaming: backend serves audio via HTTP range requests for playback (PLAY-02)
- Metadata CRUD: new API endpoints for tags, collaborators, instruments, location, notes, photos
- Photo storage: backend handles photo file storage in app support directory
- Patches folder watcher: extends Phase 1 folder watching (notify crate) to watch ~/wallflower/patches/
- Notification bridge: Tauri v2 notification API from Rust backend

</code_context>

<specifics>
## Specific Ideas

- Design inspiration explicitly Mutable Instruments — warm, organic, generous whitespace. The app should feel like a creative tool, not a file manager.
- Waveform navigation modeled after Ableton's arrangement view (overview + detail)
- Consistent chip/tag pattern across all metadata types (tags, collaborators, instruments) — one interaction model the user learns once
- Patch photo auto-attach from ~/wallflower/patches/ is important for the eurorack workflow — musician takes a photo of their patch, drops it in the folder, it appears on the jam automatically
- Dark theme is primary — this is a studio tool used during long sessions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-playback-metadata-design-system-notifications*
*Context gathered: 2026-04-19*
