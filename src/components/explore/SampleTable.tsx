"use client";

import { useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SampleTableRow } from "./SampleTableRow";
import { useSampleBrowserStore } from "@/lib/stores/sample-browser";
import { useTransportStore } from "@/lib/stores/transport";
import type { SampleRecord, SortColumn } from "@/lib/types";

const COLUMNS: {
  key: SortColumn | null;
  label: string;
  sortable: boolean;
  className: string;
}[] = [
  { key: null, label: "", sortable: false, className: "w-10" },
  { key: "name", label: "Name", sortable: true, className: "min-w-[120px]" },
  { key: "type", label: "Type", sortable: true, className: "w-20" },
  { key: "source", label: "Source", sortable: true, className: "min-w-[100px]" },
  { key: "key", label: "Key", sortable: true, className: "w-[72px]" },
  { key: "bpm", label: "BPM", sortable: true, className: "w-14" },
  { key: "duration", label: "Duration", sortable: true, className: "w-[72px]" },
];

function sortSamples(
  samples: SampleRecord[],
  column: SortColumn,
  direction: "asc" | "desc",
): SampleRecord[] {
  const sorted = [...samples].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "type":
        cmp = a.sampleType.localeCompare(b.sampleType);
        break;
      case "source":
        // Ascending sorts alphabetically, descending sorts by import date
        if (direction === "desc") {
          cmp = a.jamImportedAt.localeCompare(b.jamImportedAt);
        } else {
          cmp = a.sourceJamName.localeCompare(b.sourceJamName);
        }
        break;
      case "key":
        cmp = (a.keyDisplay ?? "").localeCompare(b.keyDisplay ?? "");
        break;
      case "bpm":
        cmp = (a.tempoBpm ?? 0) - (b.tempoBpm ?? 0);
        break;
      case "duration":
        cmp = a.durationSeconds - b.durationSeconds;
        break;
    }
    return direction === "desc" ? -cmp : cmp;
  });
  return sorted;
}

interface SampleTableProps {
  samples: SampleRecord[];
  isLoaded: boolean;
  onNavigateToJam: (jamId: string) => void;
}

export function SampleTable({ samples, isLoaded, onNavigateToJam }: SampleTableProps) {
  const { sortColumn, sortDirection, selectedSampleId, setSort, selectSample } =
    useSampleBrowserStore();
  const { clearSelection, hasActiveFilters, clearFilter } =
    useSampleBrowserStore();

  const { currentJamId, isPlaying, activeLoop } = useTransportStore();
  const loadJam = useTransportStore((s) => s.loadJam);
  const setPlaying = useTransportStore((s) => s.setPlaying);
  const setActiveLoop = useTransportStore((s) => s.setActiveLoop);

  const sorted = useMemo(
    () => sortSamples(samples, sortColumn, sortDirection),
    [samples, sortColumn, sortDirection],
  );

  const isRowPlaying = useCallback(
    (sample: SampleRecord) =>
      currentJamId === sample.jamId &&
      isPlaying &&
      activeLoop?.startSeconds === sample.startSeconds &&
      activeLoop?.endSeconds === sample.endSeconds,
    [currentJamId, isPlaying, activeLoop],
  );

  const handlePlay = useCallback(
    (sample: SampleRecord) => {
      // If this sample is already playing, pause it
      if (isRowPlaying(sample)) {
        setPlaying(false);
        return;
      }

      // Load the jam audio and set active loop to sample's time range
      const audioUrl = `http://localhost:23516/api/audio/${encodeURIComponent(sample.sourceJamName)}`;
      loadJam(sample.jamId, sample.sourceJamName, audioUrl, sample.durationSeconds);
      setActiveLoop({
        startSeconds: sample.startSeconds,
        endSeconds: sample.endSeconds,
        label: sample.name,
      });
      setPlaying(true);

      // Also select the sample
      selectSample(sample.id, sample.sampleType);
    },
    [isRowPlaying, loadJam, setActiveLoop, setPlaying, selectSample],
  );

  const handleSelect = useCallback(
    (sample: SampleRecord) => {
      if (selectedSampleId === sample.id) {
        clearSelection();
      } else {
        selectSample(sample.id, sample.sampleType);
      }
    },
    [selectedSampleId, selectSample, clearSelection],
  );

  const getAriaSortValue = (
    columnKey: SortColumn | null,
  ): "ascending" | "descending" | "none" => {
    if (columnKey === sortColumn) {
      return sortDirection === "asc" ? "ascending" : "descending";
    }
    return "none";
  };

  // Empty states
  if (isLoaded && samples.length === 0) {
    if (hasActiveFilters) {
      // Filtered empty state
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-12 py-24">
          <h2 className="text-xl font-semibold text-foreground">
            No matching samples
          </h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Try adjusting your filters or clearing the search.
          </p>
          <button
            type="button"
            onClick={clearFilter}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/50"
          >
            Clear Filters
          </button>
        </div>
      );
    }

    // Will not show here -- global empty state handled by SampleBrowser
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Table aria-label={`Samples -- ${sorted.length} items`}>
        <TableHeader>
          <TableRow className="h-9" style={{ background: "#1D2129" }}>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.label || "play"}
                className={`${col.className} text-xs uppercase tracking-wider text-muted-foreground ${col.sortable ? "cursor-pointer select-none" : ""}`}
                onClick={
                  col.sortable && col.key
                    ? () => setSort(col.key as SortColumn)
                    : undefined
                }
                aria-sort={col.sortable ? getAriaSortValue(col.key) : undefined}
              >
                {col.sortable && col.key ? (
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortColumn === col.key ? (
                      sortDirection === "asc" ? (
                        <ChevronUp size={12} style={{ color: "#E8863A" }} />
                      ) : (
                        <ChevronDown size={12} style={{ color: "#E8863A" }} />
                      )
                    ) : null}
                  </div>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>
      <ScrollArea className="flex-1">
        <Table>
          <TableBody>
            {sorted.map((sample) => (
              <SampleTableRow
                key={sample.id}
                sample={sample}
                isSelected={selectedSampleId === sample.id}
                isPlaying={isRowPlaying(sample)}
                onPlay={() => handlePlay(sample)}
                onSelect={() => handleSelect(sample)}
                onNavigateToJam={onNavigateToJam}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Screen reader announcement for result count */}
      <div aria-live="polite" className="sr-only">
        {sorted.length} samples matching
      </div>
    </div>
  );
}
