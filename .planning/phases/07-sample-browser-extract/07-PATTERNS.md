# Phase 7: Sample Browser & Extract - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/explore/SampleBrowser.tsx` | component (container) | request-response | `src/app/page.tsx` (Explore tab section) | role-match |
| `src/components/explore/SampleSidebar.tsx` | component (filter) | request-response | `src/components/library/FilterBar.tsx` | role-match |
| `src/components/explore/SampleTable.tsx` | component (list) | request-response | `src/components/bookmarks/BookmarkList.tsx` | role-match |
| `src/components/explore/SampleTableRow.tsx` | component (row) | request-response | `src/components/bookmarks/BookmarkList.tsx` (lines 68-131) | exact |
| `src/components/explore/SamplePreviewPanel.tsx` | component (panel) | request-response | `src/components/stems/StemMixer.tsx` | role-match |
| `src/components/explore/TypeBadge.tsx` | component (presentational) | transform | `src/components/analysis/AnalysisBadge.tsx` | role-match |
| `src/components/explore/SidebarToggle.tsx` | component (control) | event-driven | (no close analog -- simple toggle) | partial |
| `src/components/explore/PlayIndicator.tsx` | component (presentational) | event-driven | (no close analog -- CSS animation) | none |
| `src/lib/stores/sample-browser.ts` | store | CRUD | `src/lib/stores/library.ts` | exact |
| `src/lib/types.ts` | model (extend) | transform | `src/lib/types.ts` (existing) | exact |
| `src/lib/tauri.ts` | service (extend) | request-response | `src/lib/tauri.ts` (existing) | exact |
| `src/app/page.tsx` | component (modify) | request-response | `src/app/page.tsx` (existing) | exact |
| `crates/wallflower-core/src/db/mod.rs` | model (extend) | CRUD | `crates/wallflower-core/src/db/mod.rs` (search_jams) | exact |
| `crates/wallflower-app/src/commands/samples.rs` | controller | request-response | `crates/wallflower-app/src/commands/jams.rs` | exact |
| `crates/wallflower-app/src/commands/export.rs` | controller (extend) | request-response | `crates/wallflower-app/src/commands/export.rs` (existing) | exact |
| `crates/wallflower-app/src/commands/mod.rs` | config (extend) | N/A | `crates/wallflower-app/src/commands/mod.rs` (existing) | exact |
| `crates/wallflower-app/src/lib.rs` | config (extend) | N/A | `crates/wallflower-app/src/lib.rs` (existing) | exact |

## Pattern Assignments

### `src/lib/stores/sample-browser.ts` (store, CRUD)

**Analog:** `src/lib/stores/library.ts`

**Imports pattern** (lines 1-2):
```typescript
import { create } from "zustand";
import type { SearchFilter } from "@/lib/types";
```

**Core store pattern** (lines 4-40) -- zustand store with filter state, hasActiveFilters computed flag, partial setFilter, and clearFilter:
```typescript
export interface LibraryState {
  selectedJamId: string | null;
  setSelectedJam: (id: string | null) => void;
  filter: SearchFilter;
  hasActiveFilters: boolean;
  setFilter: (partial: Partial<SearchFilter>) => void;
  clearFilter: () => void;
  clearFilterField: (field: keyof SearchFilter) => void;
}

function hasValues(filter: SearchFilter): boolean {
  return Object.values(filter).some(
    (v) =>
      v !== undefined &&
      v !== null &&
      (Array.isArray(v) ? v.length > 0 : v !== ""),
  );
}

export const useLibraryStore = create<LibraryState>((set) => ({
  selectedJamId: null,
  setSelectedJam: (id) => set({ selectedJamId: id }),
  filter: {},
  hasActiveFilters: false,
  setFilter: (partial) =>
    set((state) => {
      const newFilter = { ...state.filter, ...partial };
      return { filter: newFilter, hasActiveFilters: hasValues(newFilter) };
    }),
  clearFilter: () => set({ filter: {}, hasActiveFilters: false }),
  clearFilterField: (field) =>
    set((state) => {
      const newFilter = { ...state.filter };
      delete newFilter[field];
      return { filter: newFilter, hasActiveFilters: hasValues(newFilter) };
    }),
}));
```

**Key adaptation:** Add `sortColumn`, `sortDirection`, `selectedSampleId`, `selectedSampleType`, `sidebarExpanded` state fields. Add `setSort` (toggles direction when same column re-clicked), `selectSample`, `clearSelection`, `toggleSidebar` actions. The `hasValues` helper reuse is direct.

---

### `src/components/explore/SampleBrowser.tsx` (component, container)

**Analog:** `src/app/page.tsx` (lines 133-142 for the Explore tab placement)

**Tab content pattern** (lines 133-142):
```typescript
{activeTab === "explore" && (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-12 py-24">
    <h2 className="text-xl font-semibold text-foreground">
      Sample Browser
    </h2>
    <p className="max-w-md text-center text-sm text-muted-foreground">
      Search and filter bookmarks, loops, and sections extracted from your recordings. Coming soon.
    </p>
  </div>
)}
```

**Key adaptation:** Replace this placeholder div with `<SampleBrowser />`. The SampleBrowser itself is a flex container with three children: `<SampleSidebar />` (left), `<SampleTable />` (center), and `<SamplePreviewPanel />` (bottom). Use flex-row for sidebar+table, then flex-col wrapping table+preview.

---

### `src/components/explore/SampleSidebar.tsx` (component, filter)

**Analog:** `src/components/library/FilterBar.tsx`

**Imports pattern** (lines 1-27):
```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getFilterOptions } from "@/lib/tauri";
import { useLibraryStore } from "@/lib/stores/library";
import { cn } from "@/lib/utils";
import { SearchInput } from "./SearchInput";
import { KeySelect } from "./KeySelect";
import { TempoRangeSlider } from "./TempoRangeSlider";
import { FilterChip } from "./FilterChip";
import type { SearchFilter } from "@/lib/types";
```

**MultiSelect popover pattern** (lines 29-99) -- reusable multi-select using Command+Popover:
```typescript
function MultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel =
    selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[#272C36]",
          selected.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
        style={{ background: "#1D2129" }}
      >
        {displayLabel}
        <ChevronDown size={14} strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" style={{ background: "#1D2129" }} align="start">
        <Command style={{ background: "#1D2129" }}>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
              No {label.toLowerCase()} found
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => onToggle(opt)} className="cursor-pointer">
                  <div className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                    selected.includes(opt) ? "border-[#E8863A] bg-[#E8863A] text-white" : "border-muted-foreground",
                  )}>
                    {selected.includes(opt) && <Check size={12} strokeWidth={2} />}
                  </div>
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**react-query filter options pattern** (lines 109-113):
```typescript
const { data: options } = useQuery({
  queryKey: ["filter-options"],
  queryFn: getFilterOptions,
  staleTime: 30_000,
});
```

**Toggle array filter helper** (lines 116-125):
```typescript
const toggleArrayFilter = (
  field: "tags" | "collaborators" | "instruments",
  value: string,
) => {
  const current = filter[field] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  setFilter({ [field]: next.length > 0 ? next : undefined });
};
```

**Tempo range slider analog** from `src/components/library/TempoRangeSlider.tsx` (lines 16-74) -- full component showing Slider + Popover + filter store integration:
```typescript
export function TempoRangeSlider() {
  const [open, setOpen] = useState(false);
  const { filter, setFilter } = useLibraryStore();

  const { data: options } = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 30_000,
  });

  const globalMin = options?.tempoMin ?? 60;
  const globalMax = options?.tempoMax ?? 200;
  const currentMin = filter.tempoMin ?? globalMin;
  const currentMax = filter.tempoMax ?? globalMax;

  const handleChange = (value: number | readonly number[]) => {
    if (Array.isArray(value) && value.length >= 2) {
      setFilter({ tempoMin: value[0], tempoMax: value[1] });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* ... */}
      <PopoverContent className="w-64 p-4" style={{ background: "#1D2129" }} align="start">
        <div className="space-y-4">
          <Slider min={Math.floor(globalMin)} max={Math.ceil(globalMax)} value={[currentMin, currentMax]} onValueChange={handleChange} />
          <p className="text-center text-xs text-muted-foreground tabular-nums">
            {Math.round(currentMin)} - {Math.round(currentMax)} BPM
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Key adaptation:** The sidebar lays these filter controls out vertically in a left panel instead of horizontally in a chip bar. Each filter control (type toggles, key select, tempo slider, duration slider, source jam dropdown, tags multi-select) stacks vertically. Add a text search `<Input>` at the top. Add a collapse toggle. Wire to `useSampleBrowserStore` instead of `useLibraryStore`.

---

### `src/components/explore/SampleTable.tsx` (component, list)

**Analog:** `src/components/bookmarks/BookmarkList.tsx`

**Imports pattern** (lines 1-11):
```typescript
"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkContextMenu } from "@/components/bookmarks/BookmarkContextMenu";
import { BookmarkPopover } from "@/components/bookmarks/BookmarkPopover";
import { useBookmarkStore } from "@/lib/stores/bookmarks";
import type { BookmarkRecord, BookmarkColor } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";
```

**List with empty state pattern** (lines 55-65):
```typescript
{bookmarks.length === 0 && (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <p className="text-[28px] font-semibold text-foreground">
      No bookmarks yet
    </p>
    <p className="mt-2 text-sm text-muted-foreground">
      Drag across the waveform to select a section you want to export.
    </p>
  </div>
)}
```

**Row item pattern** (lines 68-131) -- clickable row with color dot, name, time range, accessibility:
```typescript
{bookmarks.map((bookmark) => {
  const colorKey = bookmark.color as BookmarkColor;
  const colorInfo = BOOKMARK_COLORS[colorKey] || BOOKMARK_COLORS.coral;

  return (
    <div
      className="flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-muted/50"
      onClick={() => onBookmarkClick(bookmark)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBookmarkClick(bookmark);
        }
      }}
    >
      {/* Color dot */}
      <span
        className="flex-shrink-0 rounded-full"
        style={{ width: 8, height: 8, backgroundColor: colorInfo.solid }}
      />
      {/* Name */}
      <span className="min-w-0 max-w-[200px] truncate text-sm text-foreground">
        {bookmark.name}
      </span>
      {/* Time range */}
      <span className="flex-shrink-0 text-xs text-muted-foreground">
        {formatTime(bookmark.startSeconds)}-{formatTime(bookmark.endSeconds)}
      </span>
    </div>
  );
})}
```

**Key adaptation:** Replace simple row layout with a shadcn `Table` (already installed at `src/components/ui/table.tsx`). Add sortable column headers with click handlers updating `useSampleBrowserStore.setSort()`. Rows render SampleTableRow sub-components. Table has 7 columns per D-03: Play | Name | Type | Source Jam | Key | BPM | Duration. The color dot and type badge patterns go inside the Name and Type columns respectively.

---

### `src/components/explore/SamplePreviewPanel.tsx` (component, panel)

**Analog:** `src/components/stems/StemMixer.tsx`

**Imports pattern** (lines 1-13):
```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import { X, Play, Pause } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StemRow } from "./StemRow";
import { SeparationProgress } from "./SeparationProgress";
import { useSeparationStore } from "@/lib/stores/separation";
import { STEM_COLORS } from "@/lib/types";
import type { BookmarkRecord } from "@/lib/types";
import { revealInFinder } from "@/lib/tauri";
import { toast } from "sonner";
```

**Sheet bottom panel pattern** (lines 248-251):
```typescript
<Sheet open={open} onOpenChange={(openState) => { if (!openState) handleClose(); }}>
  <SheetContent side="bottom" showCloseButton={false} className="max-h-[50vh]">
    {/* content */}
  </SheetContent>
</Sheet>
```

**Header bar pattern** (lines 261-273):
```typescript
<div className="flex items-center justify-between border-b border-border px-4 py-2">
  <span className="text-sm font-semibold text-foreground">
    Stems: {displayBookmark?.name ?? ""}
  </span>
  <Button variant="ghost" size="icon-sm" onClick={handleClose} title="Close stem mixer">
    <X className="size-4" />
  </Button>
</div>
```

**Controls bar with export buttons pattern** (lines 293-330):
```typescript
<div className="flex h-9 items-center gap-3 border-t border-border px-4">
  <Button variant="ghost" size="icon-sm" onClick={handlePlayPause} title={isPlaying ? "Pause" : "Play"}>
    {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
  </Button>
  <span className="text-xs tabular-nums text-muted-foreground">
    {formatTime(currentTime)} / {formatTime(totalDuration)}
  </span>
  <div className="flex-grow" />
  <Button
    variant="ghost"
    size="sm"
    className="text-[#E8863A] hover:text-[#E8863A]/80"
    onClick={handleExportSelected}
    disabled={!hasSelectedStems}
  >
    Export Selected
  </Button>
  <Button size="sm" className="bg-[#E8863A] text-white hover:bg-[#E8863A]/90" onClick={handleExportAll}>
    Export All
  </Button>
</div>
```

**Toast success/error pattern** (lines 170-186):
```typescript
const handleExportAll = useCallback(async () => {
  try {
    const path = await useSeparationStore.getState().exportAllStems();
    toast.success(`Exported ${stems.length} stems to ${path}`, {
      action: {
        label: "Show in Finder",
        onClick: () => { revealInFinder(path); },
      },
    });
  } catch (err) {
    toast.error("Export failed", {
      description: err instanceof Error ? err.message : "Unknown error",
    });
  }
}, [stems.length]);
```

**Key adaptation:** The preview panel is NOT a Sheet dialog -- it is a persistent div at the bottom of the SampleBrowser that shows/hides based on whether a sample is selected. It contains: (1) WaveformDetail component for the selected sample's jam audio, zoomed to the sample range, (2) sample info (name, type, key, bpm), (3) "Export Audio" and "Export Stems" buttons using the same toast pattern, (4) "Go to Jam" link that sets `useLibraryStore.setSelectedJam()` and switches tab. Use the transport store's `activeLoop` to constrain playback to the sample's time range.

---

### `src/components/explore/TypeBadge.tsx` (component, presentational)

**Analog:** `src/components/ui/badge.tsx` (shadcn Badge already installed)

**Badge usage pattern** from BookmarkList (line 49):
```typescript
<Badge variant="secondary" className="text-xs">
  {bookmarks.length}
</Badge>
```

**Key adaptation:** Create a small component that renders a colored Badge based on sample type. Bookmarks: warm color with BOOKMARK_COLORS dot. Sections: neutral/teal badge. Loops: neutral/sky badge. Use the existing `cn()` utility for conditional classes.

---

### `src/lib/types.ts` (model, extend)

**Analog:** Existing types file (self -- extend in place)

**Type definition pattern** (lines 182-209) -- existing SectionRecord, LoopRecord, BookmarkRecord:
```typescript
export interface SectionRecord {
  id: string;
  jamId: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
  clusterId: number;
  sortOrder: number;
}

export interface LoopRecord {
  id: string;
  jamId: string;
  startSeconds: number;
  endSeconds: number;
  repeatCount: number;
  evolving: boolean;
  label: string;
  sortOrder: number;
}
```

**Filter type pattern** (lines 212-223):
```typescript
export interface SearchFilter {
  query?: string;
  keys?: string[];
  tempoMin?: number;
  tempoMax?: number;
  tags?: string[];
  collaborators?: string[];
  instruments?: string[];
  dateFrom?: string;
  dateTo?: string;
  location?: string;
}
```

**Key adaptation:** Add `SampleType = 'bookmark' | 'section' | 'loop'`, `SampleRecord` (unified type from RESEARCH.md), `SampleFilter` (extends SearchFilter concept with types, durationMin, durationMax, sourceJamId), and `SampleFilterOptions` (extends FilterOptions with jams list and duration range).

---

### `src/lib/tauri.ts` (service, extend)

**Analog:** Existing tauri.ts (self -- extend in place)

**Tauri invoke pattern** (lines 278-285):
```typescript
export async function searchJams(filter: SearchFilter): Promise<JamRecord[]> {
  return invoke("search_jams", { filter });
}

export async function getFilterOptions(): Promise<FilterOptions> {
  return invoke("get_filter_options");
}
```

**Export command pattern** (lines 312-321):
```typescript
export async function exportAudio(bookmarkId: string): Promise<string> {
  return invoke("export_audio", { bookmarkId });
}

export async function separateStems(bookmarkId: string): Promise<StemInfo[]> {
  return invoke("separate_stems", { bookmarkId });
}
```

**Key adaptation:** Add `getAllSamples(filter: SampleFilter): Promise<SampleRecord[]>`, `getSampleFilterOptions(): Promise<SampleFilterOptions>`, `exportSampleAudio(jamId, start, end, name): Promise<string>`, `separateSampleStems(jamId, start, end, name): Promise<StemInfo[]>`. Follow identical invoke pattern.

---

### `crates/wallflower-app/src/commands/samples.rs` (controller, request-response)

**Analog:** `crates/wallflower-app/src/commands/jams.rs`

**Full file pattern** (lines 1-48):
```rust
use crate::AppState;
use wallflower_core::db;
use wallflower_core::db::schema::JamRecord;
use wallflower_core::db::SearchFilter;

#[tauri::command]
pub async fn list_jams(state: tauri::State<'_, AppState>) -> Result<Vec<JamRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_jams(&db.conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_jams(
    state: tauri::State<'_, AppState>,
    filter: SearchFilter,
) -> Result<Vec<JamRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::search_jams(&db.conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_filter_options(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let keys = db::get_distinct_keys(&db.conn).map_err(|e| e.to_string())?;
    let tags = db::list_all_tags(&db.conn).map_err(|e| e.to_string())?;
    let collaborators = db::list_all_collaborators(&db.conn).map_err(|e| e.to_string())?;
    let instruments = db::list_all_instruments(&db.conn).map_err(|e| e.to_string())?;
    let tempo_range = db::get_tempo_range(&db.conn).unwrap_or((60.0, 200.0));
    Ok(serde_json::json!({
        "keys": keys,
        "tags": tags,
        "collaborators": collaborators,
        "instruments": instruments,
        "tempoMin": tempo_range.0,
        "tempoMax": tempo_range.1,
    }))
}
```

**Error handling pattern** (consistent across all commands):
```rust
let db = state.db.lock().map_err(|e| e.to_string())?;
db::some_function(&db.conn, &params).map_err(|e| e.to_string())
```

**Key adaptation:** Create `get_all_samples(state, filter: SampleFilter) -> Result<Vec<SampleRecord>, String>` and `get_sample_filter_options(state) -> Result<SampleFilterOptions, String>` following identical db lock + map_err pattern.

---

### `crates/wallflower-app/src/commands/export.rs` (controller, extend)

**Analog:** Existing export.rs (self -- extend in place)

**Export audio command pattern** (lines 37-199) -- the key flow is:
1. Lock db, fetch bookmark + jam + settings
2. Resolve export path via `export::sanitize::resolve_export_path()`
3. Create parent directories
4. Call `export::writer::export_time_slice(source_path, &dest_path, start, end, bit_depth)`
5. Generate JSON sidecar
6. Record in exports table
7. Emit `export-complete` event
8. Return path

```rust
#[command]
pub async fn export_audio(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    bookmark_id: String,
) -> Result<String, String> {
    let (bookmark, jam, export_root, format_ext, bit_depth) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let bookmark = bookmarks::get_bookmark(&db.conn, &bookmark_id)
            .map_err(|e| e.to_string())?;
        let jam = wallflower_core::db::get_jam(&db.conn, &bookmark.jam_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Jam not found: {}", bookmark.jam_id))?;
        // ... get export settings ...
        (bookmark, jam, PathBuf::from(export_root), format_ext, bit_depth)
    };
    // ... resolve_export_path, export_time_slice, generate_sidecar ...
}
```

**Key adaptation:** Create `export_sample_audio(state, app, jam_id, start_seconds, end_seconds, sample_name)` that follows the same flow but accepts raw parameters instead of looking up a bookmark. Skip the bookmark fetch step -- go directly to jam fetch + export settings. Similarly create `separate_sample_stems(...)` that follows the `separate_stems` pattern but accepts jam_id + time range instead of bookmark_id.

---

### `crates/wallflower-core/src/db/mod.rs` (model, CRUD -- extend)

**Analog:** `search_jams()` function (lines 1026-1214)

**Dynamic SQL query builder pattern** (lines 1026-1050):
```rust
pub fn search_jams(conn: &Connection, filter: &SearchFilter) -> Result<Vec<JamRecord>> {
    let mut joins = Vec::new();
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1usize;

    if let Some(ref q) = filter.query {
        let trimmed = q.trim();
        if !trimmed.is_empty() {
            let like_pattern = format!("%{}%", trimmed);
            let p = param_idx;
            conditions.push(format!(
                "(j.filename LIKE ?{p} OR j.original_filename LIKE ?{p} ...)"
            ));
            param_values.push(Box::new(like_pattern));
            param_idx += 1;
        }
    }
```

**Multi-value IN filter pattern** (lines 1052-1071):
```rust
if let Some(ref keys) = filter.keys {
    if !keys.is_empty() {
        let placeholders: Vec<String> = keys
            .iter()
            .map(|_| {
                let p = format!("?{}", param_idx);
                param_idx += 1;
                p
            })
            .collect();
        joins.push("INNER JOIN jam_key ON jam_key.jam_id = j.id".to_string());
        conditions.push(format!(
            "(jam_key.key_name || ' ' || jam_key.scale) IN ({})",
            placeholders.join(", ")
        ));
        for k in keys {
            param_values.push(Box::new(k.clone()));
        }
    }
}
```

**Final query assembly + execution pattern** (lines 1184-1213):
```rust
let join_clause = joins.join("\n");
let where_clause = if conditions.is_empty() {
    String::new()
} else {
    format!("WHERE {}", conditions.join(" AND "))
};

let sql = format!(
    "SELECT DISTINCT j.id, j.filename, ...
     FROM jams j
     {}
     {}
     ORDER BY j.imported_at DESC",
    join_clause, where_clause
);

let params_refs: Vec<&dyn rusqlite::types::ToSql> =
    param_values.iter().map(|p| p.as_ref()).collect();

let mut stmt = conn.prepare(&sql)?;
let rows = stmt.query_map(params_refs.as_slice(), |row| map_jam_row(row))?;

let mut jams = Vec::new();
for row in rows {
    jams.push(row?);
}
Ok(jams)
```

**Helper query patterns** (lines 1217-1240):
```rust
pub fn get_distinct_keys(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT DISTINCT key_name || ' ' || scale FROM jam_key ORDER BY key_name")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut keys = Vec::new();
    for r in rows {
        keys.push(r?);
    }
    Ok(keys)
}

pub fn get_tempo_range(conn: &Connection) -> Result<(f64, f64)> {
    let result = conn.query_row(
        "SELECT MIN(bpm), MAX(bpm) FROM jam_tempo",
        [],
        |row| {
            let min: Option<f64> = row.get(0)?;
            let max: Option<f64> = row.get(1)?;
            Ok((min.unwrap_or(60.0), max.unwrap_or(200.0)))
        },
    )?;
    Ok(result)
}
```

**Key adaptation:** Create `SampleFilter` struct (like SearchFilter but with types, durationMin, durationMax, sourceJamId fields). Create `get_all_samples()` that builds a UNION ALL across bookmarks, jam_sections, and jam_loops (each branch JOINing jam_tempo and jam_key), wraps the UNION in a CTE or subquery, then applies WHERE conditions using the same dynamic parameter binding pattern. Apply the same `param_idx` + `conditions` + `param_values` approach for each filter dimension. Create `get_sample_filter_options()` following the `get_distinct_keys`/`get_tempo_range` pattern, adding source jam list and duration range queries.

---

### `crates/wallflower-app/src/commands/mod.rs` (config, extend)

**Analog:** Existing mod.rs (self)

**Module declaration pattern** (lines 1-10):
```rust
pub mod analysis;
pub mod bookmarks;
pub mod export;
pub mod import;
pub mod jams;
pub mod metadata;
pub mod recording;
pub mod settings;
pub mod spatial;
pub mod status;
```

**Key adaptation:** Add `pub mod samples;`

---

### `crates/wallflower-app/src/lib.rs` (config, extend)

**Analog:** Existing lib.rs (self)

**Command registration pattern** (lines 444-505):
```rust
.invoke_handler(tauri::generate_handler![
    // Jam queries
    commands::jams::list_jams,
    commands::jams::get_jam,
    commands::jams::search_jams,
    commands::jams::get_filter_options,
    // ...
    // Bookmarks & Export (Phase 5)
    commands::bookmarks::create_bookmark,
    commands::bookmarks::get_bookmarks,
    commands::export::export_audio,
    commands::export::separate_stems,
    // ...
])
```

**Key adaptation:** Add sample commands:
```rust
// Sample browser (Phase 7)
commands::samples::get_all_samples,
commands::samples::get_sample_filter_options,
commands::export::export_sample_audio,
commands::export::separate_sample_stems,
```

---

### `src/components/waveform/WaveformDetail.tsx` (reused, not modified)

**Usage pattern for preview panel** (lines 13-26, 84-98):
```typescript
interface WaveformDetailProps {
  audioUrl: string;
  peaks: PeakData;
  onSeek: (time: number) => void;
  bookmarks?: BookmarkRecord[];
  sections?: SectionRecord[];
  loops?: LoopRecord[];
  onBookmarkDragEnd?: (start: number, end: number) => void;
  onBookmarkUpdate?: (id: string, start: number, end: number) => void;
  onBookmarkSelect?: (id: string) => void;
  onBookmarkEdit?: (id: string) => void;
  onSectionClick?: (section: SectionRecord) => void;
  onLoopClick?: (loop: LoopRecord) => void;
}
```

**Key usage in SamplePreviewPanel:** Call with only `audioUrl`, `peaks`, `onSeek`. Omit `bookmarks`, `sections`, `loops` overlays since the preview shows a single sample. Set `activeLoop` on transport store to constrain playback to the sample's time range. The `peaks` come from `getPeaks(sample.jamId)`.

---

## Shared Patterns

### Dark Theme Color Constants
**Source:** Multiple components
**Apply to:** All new explore/ components

```typescript
// Background colors used consistently
style={{ background: "#1D2129" }}  // Primary background
"hover:bg-[#272C36]"              // Hover state
"bg-[#E8863A]"                    // Accent / active state (warm orange)
"text-[#E8863A]"                  // Accent text
"text-foreground"                 // Primary text
"text-muted-foreground"           // Secondary text
"border-border"                   // Border color
```

### Zustand Store Pattern
**Source:** `src/lib/stores/library.ts`, `src/lib/stores/bookmarks.ts`
**Apply to:** `src/lib/stores/sample-browser.ts`

All stores follow: `create<StateInterface>((set, get) => ({ ...initialState, action: (params) => set((state) => ({ ...updates })) }))`. State is module-level (persists across tab switches). No `useState` for persistent state.

### Tauri IPC Pattern
**Source:** `src/lib/tauri.ts`
**Apply to:** New sample browser functions in tauri.ts

```typescript
export async function someCommand(param: ParamType): Promise<ReturnType> {
  return invoke("command_name", { param });
}
```

### Rust Command Pattern
**Source:** `crates/wallflower-app/src/commands/jams.rs`
**Apply to:** `crates/wallflower-app/src/commands/samples.rs`

```rust
#[tauri::command]
pub async fn command_name(
    state: tauri::State<'_, AppState>,
    param: ParamType,
) -> Result<ReturnType, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::query_function(&db.conn, &param).map_err(|e| e.to_string())
}
```

### Toast Notification Pattern
**Source:** `src/components/stems/StemMixer.tsx` (lines 170-186)
**Apply to:** Export buttons in SamplePreviewPanel

```typescript
toast.success(`Exported to ${path}`, {
  action: {
    label: "Show in Finder",
    onClick: () => { revealInFinder(path); },
  },
});
// On error:
toast.error("Export failed", {
  description: err instanceof Error ? err.message : "Unknown error",
});
```

### Accessibility Pattern
**Source:** `src/components/bookmarks/BookmarkList.tsx` (lines 82-91), `src/components/waveform/WaveformDetail.tsx` (lines 336-341)
**Apply to:** SampleTable rows, SamplePreviewPanel waveform

```typescript
// Interactive rows
role="button"
tabIndex={0}
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onAction(item);
  }
}}

// ARIA live region for filter results
<div aria-live="polite" className="sr-only">
  {resultCount !== undefined ? `${resultCount} samples matching` : ""}
</div>
```

### Parameterized SQL Pattern
**Source:** `crates/wallflower-core/src/db/mod.rs` (lines 1026-1214)
**Apply to:** `get_all_samples()` query function

```rust
let mut conditions = Vec::new();
let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
let mut param_idx = 1usize;

// For each filter dimension:
if let Some(ref value) = filter.field {
    conditions.push(format!("column >= ?{}", param_idx));
    param_values.push(Box::new(value.clone()));
    param_idx += 1;
}

// Execute:
let params_refs: Vec<&dyn rusqlite::types::ToSql> =
    param_values.iter().map(|p| p.as_ref()).collect();
let mut stmt = conn.prepare(&sql)?;
let rows = stmt.query_map(params_refs.as_slice(), |row| map_row(row))?;
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/explore/PlayIndicator.tsx` | component | event-driven | No animated equalizer bars exist in the codebase. This is a small CSS-only component (3 animated bars). Use CSS keyframe animations with Tailwind `animate-` classes. |
| `src/components/explore/SidebarToggle.tsx` | component | event-driven | No collapsible sidebar exists in the codebase. Simple toggle button calling `useSampleBrowserStore.toggleSidebar()`. Partial reference: the Sheet open/close pattern in StemMixer, but this is simpler (a button with a chevron icon). |

## Metadata

**Analog search scope:** `src/`, `crates/wallflower-app/src/`, `crates/wallflower-core/src/`
**Files scanned:** ~80 (frontend + backend source files)
**Pattern extraction date:** 2026-04-25
