# Phase 7: Sample Browser & Extract - Research

**Researched:** 2026-04-25
**Domain:** Cross-jam sample aggregation, filterable table UI, inline audio preview, export pipeline reuse
**Confidence:** HIGH

## Summary

Phase 7 replaces the Explore tab placeholder with a DAW-style sample browser. The feature aggregates three existing data types -- bookmarks (user-created, `bookmarks` table), sections (AI-detected, `jam_sections` table), and loops (AI-detected, `jam_loops` table) -- into a single cross-jam searchable list. The UI follows the layout defined in 07-UI-SPEC.md: a collapsible sidebar with stacked filters on the left, a dense sortable table in the center, and a bottom preview panel with waveform playback and export actions.

The backend work is primarily a new SQLite query function and corresponding Tauri command that performs a UNION-style aggregation across the three tables, joining with `jam_tempo` and `jam_key` for musical metadata and `jam_tags` for tag filtering. The frontend work is the bulk of the phase: a new `SampleBrowser` component tree, a new `useSampleBrowserStore` zustand store, react-query integration for data fetching, and reuse of the existing `WaveformDetail` component and export Tauri commands.

**Primary recommendation:** Build the backend aggregation query and Tauri command first (narrow scope, testable independently), then build the frontend component tree top-down (SampleBrowser > SampleSidebar + SampleTable + SamplePreviewPanel), wiring in the zustand store and react-query hooks. Export buttons reuse existing `exportAudio` and `separateStems` Tauri commands with a thin adapter for section/loop types.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dense sortable table -- rows with columns, compact, scannable. Modeled after Ableton's browser. Sortable by clicking column headers.
- **D-02:** Flat mixed list -- bookmarks, loops, and sections appear together in one list with a Type column and color-coded type badges. Filter by type using sidebar controls.
- **D-03:** Essential 6 columns: Play button | Name | Type badge | Source Jam | Key | BPM | Duration. All columns sortable.
- **D-04:** Self-contained navigation -- clicking a row selects it for preview within the Explore tab. A link on the source jam name navigates to the jam detail view if needed. Users stay in the browser by default.
- **D-05:** Bookmark color dot -- small colored dot next to the name matching the bookmark's assigned color. Sections and loops get a neutral type indicator.
- **D-06:** Loop metadata badges -- loops show repeat count as a small "x3" badge and an evolving indicator icon next to the loop name.
- **D-07:** Empty state -- friendly message with link to Library tab.
- **D-08:** Bottom preview panel -- persistent panel at the bottom of the Explore tab shows the selected sample's waveform with play/pause, scrubbing, and key info.
- **D-09:** Full wavesurfer waveform -- reuse WaveformDetail component with interactive scrubbing, zoom. Peaks are already pre-computed server-side.
- **D-10:** Play button triggers preview -- clicking the play button in a table row selects the row AND starts playback in the bottom panel.
- **D-11:** Sidebar filters (not chip-based FilterBar) -- left sidebar with stacked filter controls, always visible by default. DAW browser style.
- **D-12:** Full filter set: Type toggles, Key dropdown, Tempo range slider, Duration range slider, Source jam dropdown, Tags multi-select.
- **D-13:** Text search bar at top of sidebar -- searches across sample name, source jam name, tags, and notes. Filters and search combine with AND logic.
- **D-14:** Collapsible sidebar -- toggle arrow at sidebar edge to collapse/expand. When collapsed, a floating filter icon shows active filter count.
- **D-15:** Export buttons in the preview panel -- "Export Audio" and "Export Stems" buttons alongside "Go to Jam" link.
- **D-16:** Direct export for AI samples -- sections and loops can be exported without creating a bookmark first. The export pipeline uses jam ID + time range.
- **D-17:** Stem separation available for all types -- any sample can trigger stem separation. Pipeline needs jam ID and time range.

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-04 | User can browse jam library in a spatial map/explorer view where jams cluster by musical similarity | Phase 6 moved PLAY-04 to Phase 7 as a sample browser requirement. The "spatial map" concept was replaced by a sample browser after the force graph was deemed not useful for musicians. The sample browser fulfills the browsing/discovery intent of PLAY-04 with a more practical interface. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Tauri v2 + Rust backend + React/Next.js frontend (static export) + Python sidecar
- **Database**: SQLite via rusqlite, WAL mode, `PRAGMA user_version` migrations
- **Frontend**: Next.js 15.x, React 19.x, wavesurfer.js 7.11.x, @wavesurfer/react 1.0.x, Tailwind CSS 4.x, zustand 5.x, @tanstack/react-query 5.x
- **Testing**: Full test coverage across all components
- **Design**: Dark theme, Mutable Instruments / Intellijel design language
- **File safety**: Atomic writes for exports
- **GSD Workflow**: Must use GSD commands for repo edits

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-jam sample aggregation query | Database / Storage | API / Backend | SQLite UNION query across bookmarks + sections + loops tables, with JOINs to tempo/key/tags. Returns unified sample list. |
| Sample filtering (key, tempo, duration, type, tags, text) | Database / Storage | API / Backend | SQL WHERE clauses with dynamic parameter binding. Same pattern as existing `search_jams()`. |
| Tauri IPC command for samples | API / Backend | -- | New `get_all_samples` Tauri command wraps the DB query. Follows established pattern from `get_bookmarks`, `search_jams`. |
| Sample browser table UI | Browser / Client | -- | React component tree with zustand state. Table rendering, sorting, row selection -- all client-side. |
| Sidebar filter controls | Browser / Client | -- | Client-side filter state in zustand store. Filter values sent as parameters to backend query via react-query. |
| Inline waveform preview | Browser / Client | API / Backend | Reuses `WaveformDetail` component. Audio served from existing `/api/audio` endpoint. Peaks fetched via existing `getPeaks` Tauri command. |
| Audio playback | Browser / Client | -- | Web Audio API via transport store. Same mechanism as JamDetail playback. |
| Export audio/stems | API / Backend | Browser / Client | Existing `exportAudio` and `separateStems` Tauri commands. For non-bookmark types (sections/loops), a thin adapter creates a temporary bookmark or extends the command to accept jam_id + time_range directly. |
| Navigation (source jam link) | Browser / Client | -- | Sets `selectedJamId` in library store and switches active tab. |

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wavesurfer.js | 7.11.x | Waveform in preview panel | Already used in WaveformDetail. Reuse, not re-implement. [VERIFIED: codebase] |
| @wavesurfer/react | 1.0.x | React wrapper for wavesurfer | Already imported in WaveformDetail. [VERIFIED: codebase] |
| zustand | 5.x | Sample browser state (filters, selection, sort) | Already used for library, bookmarks, transport, separation stores. [VERIFIED: codebase] |
| @tanstack/react-query | 5.x | Server state for sample list + filter options | Already used for filter-options in FilterBar. [VERIFIED: codebase] |
| lucide-react | -- | Icons (Play, Pause, ChevronUp, ChevronDown, SlidersHorizontal, Search, X) | Already used throughout the app. [VERIFIED: codebase] |
| sonner | -- | Toast notifications for export status | Already used in StemMixer. [VERIFIED: codebase] |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Table/Badge/Button/Sheet/Slider/Select/Input/ScrollArea/Separator/Tooltip/Command/Popover | -- | UI primitives | All already installed in `src/components/ui/`. No new shadcn additions needed. [VERIFIED: codebase] |
| tailwind CSS | 4.x | Styling | All new components use existing Tailwind classes. [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom table sorting | @tanstack/react-table | Adds dependency for a feature that is straightforward with native sort + state. The table has only 7 columns. Custom sorting is simpler here. |
| Sidebar filter as standalone library | Custom zustand + shadcn | No external filter library needed. The filter controls are standard form elements (checkboxes, sliders, selects) already available in shadcn. |

**Installation:**
```bash
# No new packages needed. All dependencies are already installed.
```

## Architecture Patterns

### System Architecture Diagram

```
User clicks Explore tab
        |
        v
[SampleBrowser Component]
        |
        +-- [SampleSidebar] -- filter state --> [useSampleBrowserStore (zustand)]
        |                                              |
        +-- [SampleTable] <-- sorted/filtered data <---+
        |       |                                      |
        |       +-- row click --> select sample -------+
        |       +-- play click --> start playback -----+--> [useTransportStore]
        |                                              |
        +-- [SamplePreviewPanel]                       |
                |                                      |
                +-- WaveformDetail (reused) <-- peaks from getPeaks()
                +-- Export Audio --> exportAudio() or exportSampleAudio() (new)
                +-- Export Stems --> separateStems() or separateSampleStems() (new)
                +-- Go to Jam --> setSelectedJam() + switch tab

[Tauri IPC Layer]
        |
        v
[Rust Backend]
        |
        +-- get_all_samples(filter) --> SQLite UNION query
        |       |
        |       +-- SELECT from bookmarks
        |       +-- UNION ALL SELECT from jam_sections
        |       +-- UNION ALL SELECT from jam_loops
        |       +-- JOIN jam_tempo, jam_key, jam_tags, jams
        |       +-- WHERE clauses from filter params
        |
        +-- export_sample_audio(jam_id, start, end) --> export::writer
        +-- separate_sample_stems(jam_id, start, end) --> gRPC sidecar
```

### Recommended Project Structure

```
src/
  components/
    explore/                    # NEW -- Phase 7 components
      SampleBrowser.tsx         # Top-level container
      SampleSidebar.tsx         # Left sidebar with filters
      SampleTable.tsx           # Sortable table
      SampleTableRow.tsx        # Individual row
      SamplePreviewPanel.tsx    # Bottom preview with waveform
      PlayIndicator.tsx         # Animated equalizer bars
      TypeBadge.tsx             # Color-coded type badge
      SidebarToggle.tsx         # Collapse/expand control
  lib/
    stores/
      sample-browser.ts         # NEW -- zustand store for browser state
    types.ts                     # EXTEND -- add SampleRecord union type
    tauri.ts                     # EXTEND -- add getAllSamples(), exportSampleAudio(), etc.
crates/
  wallflower-core/src/
    db/mod.rs                    # EXTEND -- add get_all_samples() query function
    bookmarks/mod.rs             # May extend for non-bookmark export adapters
  wallflower-app/src/
    commands/
      samples.rs                 # NEW -- Tauri commands for sample browser
      mod.rs                     # EXTEND -- register sample commands
    commands/export.rs           # EXTEND -- export_sample_audio(), separate_sample_stems()
```

### Pattern 1: Cross-jam UNION Query for Sample Aggregation
**What:** A single SQL query that unions bookmarks, sections, and loops into a normalized "sample" shape, joining with analysis/metadata tables for filtering.
**When to use:** When the frontend requests the full sample list or a filtered subset.
**Example:**
```sql
-- Source: Derived from existing search_jams pattern in db/mod.rs [VERIFIED: codebase]
SELECT
    b.id, 'bookmark' as sample_type, b.jam_id, b.name, b.start_seconds, b.end_seconds,
    b.color, NULL as repeat_count, 0 as evolving,
    j.original_filename as source_jam_name,
    j.imported_at as jam_imported_at,
    COALESCE(k.key_name || ' ' || k.scale, NULL) as key_display,
    t.bpm as tempo_bpm,
    (b.end_seconds - b.start_seconds) as duration_seconds
FROM bookmarks b
JOIN jams j ON b.jam_id = j.id
LEFT JOIN jam_key k ON b.jam_id = k.jam_id
LEFT JOIN jam_tempo t ON b.jam_id = t.jam_id

UNION ALL

SELECT
    s.id, 'section' as sample_type, s.jam_id, s.label as name, s.start_seconds, s.end_seconds,
    NULL as color, NULL as repeat_count, 0 as evolving,
    j.original_filename as source_jam_name,
    j.imported_at as jam_imported_at,
    COALESCE(k.key_name || ' ' || k.scale, NULL) as key_display,
    t.bpm as tempo_bpm,
    (s.end_seconds - s.start_seconds) as duration_seconds
FROM jam_sections s
JOIN jams j ON s.jam_id = j.id
LEFT JOIN jam_key k ON s.jam_id = k.jam_id
LEFT JOIN jam_tempo t ON s.jam_id = t.jam_id

UNION ALL

SELECT
    l.id, 'loop' as sample_type, l.jam_id, l.label as name, l.start_seconds, l.end_seconds,
    NULL as color, l.repeat_count, l.evolving,
    j.original_filename as source_jam_name,
    j.imported_at as jam_imported_at,
    COALESCE(k.key_name || ' ' || k.scale, NULL) as key_display,
    t.bpm as tempo_bpm,
    (l.end_seconds - l.start_seconds) as duration_seconds
FROM jam_loops l
JOIN jams j ON l.jam_id = j.id
LEFT JOIN jam_key k ON l.jam_id = k.jam_id
LEFT JOIN jam_tempo t ON l.jam_id = t.jam_id

ORDER BY jam_imported_at DESC
```

### Pattern 2: Export Adapter for Non-Bookmark Samples (D-16, D-17)
**What:** The existing export pipeline (`export_audio`, `separate_stems`) takes a `bookmark_id`. For sections and loops, either (a) create new Tauri commands that accept `jam_id + start_seconds + end_seconds` directly, or (b) create a temporary in-memory bookmark record.
**When to use:** When user clicks "Export Audio" or "Export Stems" on a section or loop from the browser.
**Recommendation:** Option (a) -- new commands `export_sample_audio(jam_id, start, end, name)` and `separate_sample_stems(jam_id, start, end, name)` that encapsulate the export logic without requiring a bookmark row. This avoids polluting the bookmarks table with temporary records.

```rust
// Source: Derived from existing export_audio pattern [VERIFIED: codebase]
#[command]
pub async fn export_sample_audio(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    jam_id: String,
    start_seconds: f64,
    end_seconds: f64,
    sample_name: String,
) -> Result<String, String> {
    // Same logic as export_audio but uses jam_id + time range directly
    // instead of looking up a bookmark
}
```

### Pattern 3: zustand Store for Sample Browser State
**What:** A dedicated zustand store managing filter state, sort state, selected sample, sidebar visibility.
**When to use:** All sample browser client-side state.
**Example:**
```typescript
// Source: Follows existing store patterns in bookmarks.ts, library.ts [VERIFIED: codebase]
interface SampleBrowserState {
  // Filter state
  filter: SampleFilter;
  hasActiveFilters: boolean;
  sidebarExpanded: boolean;

  // Sort state
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';

  // Selection
  selectedSampleId: string | null;
  selectedSampleType: 'bookmark' | 'section' | 'loop' | null;

  // Actions
  setFilter: (partial: Partial<SampleFilter>) => void;
  clearFilter: () => void;
  toggleSidebar: () => void;
  setSort: (column: SortColumn, direction: 'asc' | 'desc') => void;
  selectSample: (id: string, type: 'bookmark' | 'section' | 'loop') => void;
  clearSelection: () => void;
}
```

### Pattern 4: react-query for Sample Data Fetching
**What:** Use `@tanstack/react-query` to fetch and cache the sample list, refetching when filters change.
**When to use:** Loading sample data from the backend.
**Example:**
```typescript
// Source: Follows existing useQuery pattern in FilterBar.tsx [VERIFIED: codebase]
const { data: samples, isLoading } = useQuery({
  queryKey: ['samples', filter],
  queryFn: () => getAllSamples(filter),
  staleTime: 10_000,
});
```

### Anti-Patterns to Avoid
- **Fetching per-jam then merging client-side:** Never fetch bookmarks, sections, and loops per-jam and merge in JavaScript. The UNION query is the correct approach -- let SQLite do the aggregation.
- **Creating temporary bookmarks for export:** Do not insert bookmark rows into the database just to use the existing `export_audio` command. Create new commands that accept raw time ranges.
- **Using FilterBar component from Library:** D-11 explicitly says the Explore tab uses a sidebar, NOT the chip-based FilterBar. Do not reuse FilterBar. Build SampleSidebar as a new component.
- **Client-side sorting of large datasets:** All sorting should happen in the SQL query or on the already-fetched dataset. With a zustand store tracking sort state, the component re-sorts the array. For typical datasets (hundreds to low thousands of samples), client-side sort is fine. If performance becomes an issue, push sorting to SQL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waveform display in preview | Custom canvas waveform | `WaveformDetail` component (existing) | Already handles peaks, scrubbing, zoom, stereo. D-09 requires reuse. |
| Audio playback | Custom audio engine | `useTransportStore` + existing audio element | Already manages playback state, time tracking, loop support. |
| Toast notifications | Custom notification UI | `sonner` (already installed) | Used in StemMixer. Consistent UX. |
| Sortable table | Custom table implementation | shadcn `Table` components + sort state in zustand | Table components already installed. Sort is just click handler + Array.sort. |
| Multi-select dropdowns | Custom multi-select | shadcn `Command` + `Popover` (existing pattern in FilterBar) | `MultiSelect` pattern already exists in FilterBar.tsx. Reference it, rebuild for sidebar layout. |
| Range sliders | Custom range input | shadcn `Slider` | Already installed and used in TempoRangeSlider. |
| Slide-up panel | Custom panel animation | CSS transition on height + conditional render | Same approach as StemMixer's Sheet usage. |

**Key insight:** Phase 7 is primarily a composition phase -- almost all building blocks already exist. The new work is (1) a SQL UNION query, (2) two new Tauri commands for non-bookmark export, (3) a new zustand store, and (4) a new component tree that assembles existing primitives into the DAW browser layout.

## Common Pitfalls

### Pitfall 1: Key/Tempo Inheritance for Samples
**What goes wrong:** Sections and loops don't have their own key/tempo -- they inherit from the parent jam's `jam_key` and `jam_tempo` tables. If the JOIN is wrong or missing, key/BPM columns show "--" for all AI-detected samples.
**Why it happens:** The UNION query must JOIN `jam_key` and `jam_tempo` on `jam_id` for ALL three branches of the UNION, not just the bookmarks branch.
**How to avoid:** Write the UNION query with identical JOIN structure in all three SELECT branches. Test with jams that have analysis data.
**Warning signs:** Key/BPM columns are empty for sections and loops but populated for bookmarks.

### Pitfall 2: Export Pipeline Requires bookmark_id
**What goes wrong:** The existing `export_audio` and `separate_stems` Tauri commands require a `bookmark_id`. Sections and loops don't have bookmark IDs. Calling these commands with a section/loop ID will fail.
**Why it happens:** Phase 5 built the export pipeline around bookmarks. Phase 7 extends export to all sample types (D-16, D-17).
**How to avoid:** Create new Tauri commands (`export_sample_audio`, `separate_sample_stems`) that accept `jam_id + start_seconds + end_seconds + name` directly. The export writer already takes these parameters -- the bookmark lookup is just an indirection.
**Warning signs:** "Export Audio" button throws an error for section/loop types.

### Pitfall 3: Waveform Preview Shows Full Recording Instead of Sample Region
**What goes wrong:** WaveformDetail displays the entire recording's waveform instead of just the sample's time range. The preview panel should show only the sample's region.
**Why it happens:** WaveformDetail loads the full jam's peaks. For a preview, you need to either (a) slice the peaks data to the sample's time range, or (b) load full peaks but set the visible region and restrict playback to the sample range.
**How to avoid:** Use option (b) -- load full peaks but configure WaveformDetail to zoom into the sample's time range. The `activeLoop` concept in `useTransportStore` already supports constraining playback to a time range. For the visible region, set `minPxPerSec` based on sample duration to auto-zoom.
**Warning signs:** Preview shows tiny waveform of full 2-hour recording instead of zoomed 8-second sample.

### Pitfall 4: Sort State Conflicts with Filter Updates
**What goes wrong:** Changing a filter resets the sort state, or sorting doesn't work correctly after filters narrow the list.
**Why it happens:** If sort state and filter state are managed in different stores or with incorrect dependencies.
**How to avoid:** Keep both sort and filter state in the same zustand store (`useSampleBrowserStore`). The react-query key includes the filter but NOT the sort -- sorting happens client-side on the fetched data.
**Warning signs:** Clicking a sort header after filtering produces unexpected ordering.

### Pitfall 5: N+1 Query for Tags in Filter
**What goes wrong:** If tags are stored per-jam and you need to filter samples by tag, a naive approach queries tags for each sample individually.
**Why it happens:** Tags are in `jam_tags` linked to `jam_id`, not to individual samples. The UNION query needs a JOIN or subquery to filter by tags.
**How to avoid:** Add an EXISTS subquery in the WHERE clause: `EXISTS (SELECT 1 FROM jam_tags WHERE jam_tags.jam_id = b.jam_id AND jam_tags.tag IN (?))`. Same pattern already used in `search_jams()` for text search.
**Warning signs:** Filtering by tags is slow or returns no results.

### Pitfall 6: Tab Navigation and State Persistence
**What goes wrong:** Switching from Explore to Library and back loses filter state, selected sample, or sidebar collapsed state.
**Why it happens:** If the SampleBrowser component is unmounted when switching tabs, local state is lost.
**How to avoid:** All persistent state lives in the zustand store (which persists across tab switches since it's module-level). The component tree reads from the store on mount. Do NOT use local `useState` for filters or selection.
**Warning signs:** Filters reset when switching tabs.

## Code Examples

### Unified Sample Record Type
```typescript
// Source: Derived from existing BookmarkRecord, SectionRecord, LoopRecord [VERIFIED: codebase]
export type SampleType = 'bookmark' | 'section' | 'loop';

export interface SampleRecord {
  id: string;
  sampleType: SampleType;
  jamId: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  color: string | null;       // bookmark color, null for sections/loops
  repeatCount: number | null; // loop repeat count
  evolving: boolean;          // loop evolving flag
  sourceJamName: string;
  jamImportedAt: string;
  keyDisplay: string | null;  // "C minor" or null
  tempoBpm: number | null;
  durationSeconds: number;
}
```

### Sample Browser Store
```typescript
// Source: Follows library.ts and bookmarks.ts patterns [VERIFIED: codebase]
import { create } from "zustand";

export type SortColumn = 'name' | 'type' | 'source' | 'key' | 'bpm' | 'duration';

export interface SampleFilter {
  query?: string;
  types?: SampleType[];       // ['bookmark', 'loop', 'section']
  keys?: string[];
  tempoMin?: number;
  tempoMax?: number;
  durationMin?: number;
  durationMax?: number;
  sourceJamId?: string;
  tags?: string[];
}

interface SampleBrowserState {
  filter: SampleFilter;
  hasActiveFilters: boolean;
  sidebarExpanded: boolean;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  selectedSampleId: string | null;
  selectedSampleType: SampleType | null;

  setFilter: (partial: Partial<SampleFilter>) => void;
  clearFilter: () => void;
  toggleSidebar: () => void;
  setSort: (column: SortColumn) => void; // toggles direction
  selectSample: (id: string, type: SampleType) => void;
  clearSelection: () => void;
}
```

### Backend Query Function Signature (Rust)
```rust
// Source: Follows search_jams() pattern in db/mod.rs [VERIFIED: codebase]
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleFilter {
    pub query: Option<String>,
    pub types: Option<Vec<String>>,  // ["bookmark", "section", "loop"]
    pub keys: Option<Vec<String>>,
    pub tempo_min: Option<f64>,
    pub tempo_max: Option<f64>,
    pub duration_min: Option<f64>,
    pub duration_max: Option<f64>,
    pub source_jam_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

pub fn get_all_samples(conn: &Connection, filter: &SampleFilter) -> Result<Vec<SampleRecord>> {
    // Build UNION query with dynamic WHERE clauses per filter parameter
    // Same dynamic parameter binding approach as search_jams()
}
```

### Tauri Command for Sample Fetching
```rust
// Source: Follows get_bookmarks pattern in commands/bookmarks.rs [VERIFIED: codebase]
#[command]
pub async fn get_all_samples(
    state: tauri::State<'_, AppState>,
    filter: SampleFilter,
) -> Result<Vec<SampleRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_samples(&db.conn, &filter).map_err(|e| e.to_string())
}
```

### Filter Options Endpoint (extend existing)
```rust
// Source: Derived from get_filter_options pattern [VERIFIED: codebase]
// Add to existing filter options: source jam list, duration range
pub fn get_sample_filter_options(conn: &Connection) -> Result<SampleFilterOptions> {
    let keys = get_distinct_keys(conn)?;
    let tags = list_all_tags(conn)?;
    let (tempo_min, tempo_max) = get_tempo_range(conn)?;

    // New: get all jam names for source dropdown
    let mut stmt = conn.prepare("SELECT id, original_filename FROM jams ORDER BY imported_at DESC")?;
    let jams: Vec<(String, String)> = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?.filter_map(|r| r.ok()).collect();

    // New: get duration range across all sample types
    // (computed from the UNION of bookmark/section/loop durations)

    Ok(SampleFilterOptions { keys, tags, tempo_min, tempo_max, jams, duration_min, duration_max })
}
```

### Preview Panel Waveform Integration
```typescript
// Source: Derived from WaveformDetail usage in JamDetail [VERIFIED: codebase]
// The preview panel loads the source jam's peaks and audio,
// then configures WaveformDetail to show only the sample's time range.

function SamplePreviewPanel({ sample }: { sample: SampleRecord }) {
  const { data: peaks } = useQuery({
    queryKey: ['peaks', sample.jamId],
    queryFn: () => getPeaks(sample.jamId),
  });

  const audioUrl = `http://localhost:23516/api/audio/${encodeURIComponent(filename)}`;

  // Use WaveformDetail with simplified props (no bookmarks/sections/loops overlays)
  // Set activeLoop on transport store to constrain playback to sample region
  return (
    <WaveformDetail
      audioUrl={audioUrl}
      peaks={peaks}
      onSeek={handleSeek}
      // No bookmarks, sections, loops -- preview shows single sample
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spatial force graph (Phase 6) | Sample browser table | Phase 6 execution | Force graph was removed because it wasn't useful for musicians. Sample browser replaces it. [VERIFIED: STATE.md, ROADMAP.md] |
| Export requires bookmark | Direct export from sections/loops | Phase 7 (D-16) | New commands needed for non-bookmark export. Reduces friction. |
| Per-jam bookmark fetching | Cross-jam UNION query | Phase 7 (new) | BookmarkStore currently loads per-jam. Phase 7 needs aggregation across all jams. |

**Deprecated/outdated:**
- Spatial explorer components from Phase 6: Removed. The Explore tab placeholder is what Phase 7 replaces. [VERIFIED: codebase -- lines 133-141 of page.tsx]
- `list_jams_spatial()` in db/mod.rs: This spatial data query from Phase 6 is no longer used by any frontend component but remains in the codebase. Phase 7 does not need it -- the new `get_all_samples()` query replaces it for the Explore tab.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Client-side sorting is fast enough for the expected sample count (hundreds to low thousands) | Architecture Patterns | If users have 10K+ samples, client-side sort could be sluggish. Mitigation: add SQL ORDER BY as fallback. LOW risk -- musicians rarely have that many analyzed jams. |
| A2 | The transport store's `activeLoop` feature can constrain playback to a sample's time range | Pitfall 3 | If activeLoop doesn't work for preview, a separate audio element may be needed. Can be verified by reading transport store code. LOW risk -- store already has this feature. [VERIFIED: transport.ts has `activeLoop` with `startSeconds`/`endSeconds`] |
| A3 | Sections and loops inherit key/tempo from their parent jam (no per-section key/tempo) | Pitfall 1 | If per-section key/tempo is needed, more complex data model required. LOW risk -- confirmed by schema. `jam_key` and `jam_tempo` are per-jam, not per-section. [VERIFIED: V4 migration SQL] |

## Open Questions

1. **Export command design for non-bookmark types**
   - What we know: Existing `export_audio` takes `bookmark_id`. Sections/loops don't have bookmark IDs. D-16 says export should work without creating a bookmark.
   - What's unclear: Whether to (a) create new Tauri commands that accept raw parameters, (b) extend existing commands with an optional alternative parameter, or (c) auto-create a temporary bookmark.
   - Recommendation: Option (a) -- create `export_sample_audio` and `separate_sample_stems` commands. Cleanest separation of concerns. No temporary database records.

2. **Text search scope for samples**
   - What we know: D-13 says search across sample name, source jam name, tags, and notes.
   - What's unclear: Whether "notes" means the jam's notes or the bookmark's notes. Sections and loops don't have notes.
   - Recommendation: Search across sample `name` (label for sections/loops, name for bookmarks), source jam `original_filename`, jam `notes`, bookmark `notes` (where applicable), and jam tags.

3. **Duration range bounds for filter**
   - What we know: D-12 requires duration range slider.
   - What's unclear: What the min/max bounds should be. Need to compute from actual data.
   - Recommendation: Backend computes min/max duration from the UNION of all sample types and returns in filter options. Frontend uses these as slider bounds.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust: `cargo test` (built-in). Frontend: no test framework configured (no jest/vitest found in project). |
| Config file | Rust: `Cargo.toml` in each crate. Frontend: none. |
| Quick run command | `cargo test --lib -p wallflower-core -- sample` |
| Full suite command | `cargo test --workspace` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-04-a | Cross-jam sample aggregation returns bookmarks + sections + loops | unit (Rust) | `cargo test -p wallflower-core -- get_all_samples` | Wave 0 |
| PLAY-04-b | Filter by key, tempo, duration, type, tags produces correct results | unit (Rust) | `cargo test -p wallflower-core -- sample_filter` | Wave 0 |
| PLAY-04-c | Export works for section/loop types (not just bookmarks) | unit (Rust) | `cargo test -p wallflower-core -- export_sample` | Wave 0 |
| PLAY-04-d | UI renders sample table, sidebar, preview panel | manual | Manual: open Explore tab, verify layout | N/A |
| PLAY-04-e | Inline preview plays correct audio segment | manual | Manual: select sample, verify waveform and playback | N/A |

### Sampling Rate
- **Per task commit:** `cargo test --lib -p wallflower-core`
- **Per wave merge:** `cargo test --workspace`
- **Phase gate:** Full suite green + manual UAT of all 4 success criteria

### Wave 0 Gaps
- [ ] `crates/wallflower-core/src/db/mod.rs` -- add `get_all_samples()` + tests
- [ ] `crates/wallflower-core/src/db/mod.rs` -- add `get_sample_filter_options()` + tests
- [ ] Test data fixtures for cross-jam sample scenarios (multiple jams with bookmarks, sections, loops, analysis data)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user local app, no auth. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | Single user, all data accessible. |
| V5 Input Validation | yes | Validate filter parameters before SQL construction. Use parameterized queries (already established pattern). |
| V6 Cryptography | no | No crypto operations in this phase. |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter parameters | Tampering | Parameterized queries via `rusqlite::params![]`. Already established in `search_jams()`. [VERIFIED: codebase] |
| Path traversal via export filename | Tampering | `export::sanitize::resolve_export_path()` already sanitizes filenames. Reuse for sample exports. [VERIFIED: codebase] |
| Unbounded query result size | Denial of Service | Add LIMIT to the UNION query (e.g., 10000). Desktop app with local data, so risk is minimal. |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/lib/types.ts`, `src/lib/stores/*.ts`, `src/lib/tauri.ts`, `src/components/waveform/WaveformDetail.tsx`, `src/components/stems/StemMixer.tsx`, `src/components/library/FilterBar.tsx`, `crates/wallflower-core/src/db/mod.rs`, `crates/wallflower-core/src/bookmarks/mod.rs`, `crates/wallflower-app/src/commands/export.rs`, `crates/wallflower-app/src/commands/bookmarks.rs`, `crates/wallflower-app/src/api/mod.rs`
- Schema inspection: `migrations/V4__analysis_tables.sql`, `migrations/V5__bookmarks_exports.sql`
- Phase context: `07-CONTEXT.md`, `07-UI-SPEC.md`
- Project state: `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- shadcn component availability verified by listing `src/components/ui/` directory

### Tertiary (LOW confidence)
- None. All findings verified against codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- follows established patterns (zustand stores, Tauri commands, rusqlite queries)
- Pitfalls: HIGH -- identified from actual code inspection of existing export pipeline and query patterns

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable -- all technologies already in use)
