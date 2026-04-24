# Phase 7: Sample Browser & Extract - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

The Explore tab becomes a cross-jam sample browser where users can search, filter, and preview bookmarks (user-created), loops (AI-detected), and sections (AI-detected) from all recordings. Users can audition any sample inline with waveform scrubbing, then export audio or stems directly from the browser. This replaces the spatial explorer that was removed in Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Sample List Layout
- **D-01:** Dense sortable table — rows with columns, compact, scannable. Modeled after Ableton's browser. Sortable by clicking column headers.
- **D-02:** Flat mixed list — bookmarks, loops, and sections appear together in one list with a Type column and color-coded type badges. Filter by type using sidebar controls.
- **D-03:** Essential 6 columns: Play button | Name | Type badge | Source Jam | Key | BPM | Duration. All columns sortable.
- **D-04:** Self-contained navigation — clicking a row selects it for preview within the Explore tab. A link on the source jam name navigates to the jam detail view if needed. Users stay in the browser by default.
- **D-05:** Bookmark color dot — small colored dot next to the name matching the bookmark's assigned color (from Phase 5 palette). Sections and loops get a neutral type indicator.
- **D-06:** Loop metadata badges — loops show repeat count as a small "×3" badge and an evolving indicator icon next to the loop name.
- **D-07:** Empty state — friendly message: "No samples yet — bookmark sections in your jams or import recordings to auto-detect loops and sections." Link to Library tab.

### Inline Preview
- **D-08:** Bottom preview panel — persistent panel at the bottom of the Explore tab shows the selected sample's waveform with play/pause, scrubbing, and key info. Similar to the stem mixer slide-up from Phase 5. Stays until user selects another sample or dismisses.
- **D-09:** Full wavesurfer waveform — reuse WaveformDetail component with interactive scrubbing, zoom, same look as jam detail view. Peaks are already pre-computed server-side. Consistent experience.
- **D-10:** Play button triggers preview — clicking the play button in a table row selects the row AND starts playback in the bottom panel. One action, two results. Clicking another row's play button switches to that sample.

### Filter & Search UX
- **D-11:** Sidebar filters (not chip-based FilterBar) — left sidebar with stacked filter controls, always visible by default. DAW browser style. Distinct from the Library tab's chip-based FilterBar.
- **D-12:** Full filter set: Type toggles (bookmark/loop/section), Key dropdown, Tempo range slider, Duration range slider, Source jam dropdown, Tags multi-select. Covers all success criteria dimensions.
- **D-13:** Text search bar at top of sidebar — searches across sample name, source jam name, tags, and notes. Filters and search combine with AND logic.
- **D-14:** Collapsible sidebar — toggle arrow at sidebar edge to collapse/expand. When collapsed, a floating filter icon shows active filter count. Maximizes table space when not filtering.

### Export from Browser
- **D-15:** Export buttons in the preview panel — "Export Audio" (time-sliced) and "Export Stems" (source-separated) buttons in the bottom preview panel, alongside a "Go to Jam" link. Consistent with Phase 5 export options.
- **D-16:** Direct export for AI samples — sections and loops can be exported without creating a bookmark first. The export pipeline uses the same time range regardless of source type. Reduces friction.
- **D-17:** Stem separation available for all types — any sample (bookmark, loop, or section) can trigger stem separation. The pipeline just needs a jam ID and time range, which all types have.

### Claude's Discretion
- Backend API design for cross-jam sample aggregation (new endpoints to fetch all bookmarks/loops/sections)
- SQLite query optimization for cross-jam filtering
- Sidebar width and responsive behavior
- Table row height and hover states
- Preview panel height and animation
- Waveform zoom level defaults for short samples
- Filter control sizing and spacing
- Sort default order (by date? by source jam? by name?)
- Keyboard shortcuts for play/next/previous within the table

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` — Full technology stack: wavesurfer.js 7.11.x, @wavesurfer/react 1.0.x, Tailwind CSS 4.x, zustand 5.x, @tanstack/react-query 5.x, Tauri v2
- `.planning/PROJECT.md` — Project vision, constraints, target hardware (M4 Mac Mini), Ableton as primary DAW
- `.planning/REQUIREMENTS.md` — PLAY-04 requirement for this phase

### Prior Phase Context
- `.planning/phases/02-playback-metadata-design-system-notifications/02-CONTEXT.md` — Design system (dark theme, Mutable Instruments, warm accents), tab bar navigation, waveform overlay system
- `.planning/phases/04-ml-analysis-pipeline/04-CONTEXT.md` — Analysis data model (key, tempo, sections, loops), search/filter infrastructure (SearchFilter, FilterBar), filter bar dimensions (D-12 through D-15)
- `.planning/phases/05-source-separation-export/05-CONTEXT.md` — Bookmark CRUD (D-01-D-04), export workflow (D-05-D-08), stem mixer slide-up pattern (D-10-D-11), export folder structure, separation pipeline
- `.planning/phases/06-spatial-explorer-accessibility-distribution/06-CONTEXT.md` — Explore tab setup (D-04), spatial explorer removal decision, accessibility patterns (D-06-D-08)

### Existing Code
- `src/app/page.tsx` — Explore tab placeholder (lines 133-141, replace with sample browser)
- `src/lib/types.ts` — BookmarkRecord, SectionRecord, LoopRecord, SearchFilter types
- `src/lib/stores/bookmarks.ts` — BookmarkStore with CRUD (per-jam, needs cross-jam extension)
- `src/lib/tauri.ts` — getBookmarks(jamId), exportAudio(), separateStems(), exportStems(), searchJams()
- `src/components/library/FilterBar.tsx` — Existing chip-based filter (reference for filter dimensions, NOT reused for sidebar)
- `src/components/waveform/WaveformDetail.tsx` — Waveform component to reuse in preview panel
- `src/components/stems/StemMixer.tsx` — Slide-up panel pattern to reference for preview panel
- `src/components/bookmarks/BookmarkContextMenu.tsx` — Export context menu (reference for export options)
- `crates/wallflower-core/src/db/mod.rs` — search_jams(), save_sections(), save_loops() (needs cross-jam sample query)

### Technology
- wavesurfer.js 7.11.x — Waveform visualization in preview panel
- @wavesurfer/react 1.0.x — React wrapper for wavesurfer

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- WaveformDetail component — reuse for preview panel waveform (already handles peaks, scrubbing, zoom)
- StemMixer slide-up pattern — reference for bottom preview panel layout and animation
- BookmarkRecord/SectionRecord/LoopRecord types — all fields needed for table columns already defined
- exportAudio()/separateStems()/exportStems() Tauri commands — reuse directly for export from browser
- BOOKMARK_COLORS constant — reuse for color dot rendering in table rows
- SearchFilter type — reference for filter dimensions (extend for sample-specific fields like duration range, type)

### Established Patterns
- zustand for client state (sample browser selection, filter state)
- @tanstack/react-query for server state (fetching cross-jam samples)
- Tauri IPC commands for frontend-backend communication
- SQLite via rusqlite with WAL mode, PRAGMA user_version migrations
- Dark theme with Mutable Instruments design language
- Toast notifications via sonner for export completion

### Integration Points
- Replace Explore tab placeholder in page.tsx with SampleBrowser component
- New backend API: cross-jam query for all bookmarks + all sections + all loops with filtering
- New SQLite query: aggregate samples across jams with key/tempo/duration/tag filtering
- New zustand store for sample browser state (selected sample, filters, sort)
- Preview panel connects to existing audio playback infrastructure
- Export buttons call existing exportAudio/separateStems Tauri commands
- Source jam link navigates back to Library tab with selectedJamId set

</code_context>

<specifics>
## Specific Ideas

- The Explore tab should feel like a DAW's sample browser — sidebar filters on the left, dense table on the right, preview at the bottom. Musicians are already used to this layout from Ableton, Logic, and Splice.
- The sidebar filters differentiate Explore from Library — Library uses inline chip filters for quick jam browsing, Explore uses persistent sidebar filters for deeper sample mining.
- Direct export of AI-detected sections/loops removes friction — a musician shouldn't have to create a bookmark just to export a cool loop the AI found.
- The preview panel echoes the stem mixer slide-up from Phase 5 — same spatial position (bottom), same purpose (audition before exporting), consistent interaction pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-sample-browser-extract*
*Context gathered: 2026-04-24*
