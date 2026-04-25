"use client";

import { useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { SampleSidebar } from "./SampleSidebar";
import { SampleTable } from "./SampleTable";
import { SamplePreviewPanel } from "./SamplePreviewPanel";
import { SidebarToggle } from "./SidebarToggle";
import { useSampleBrowserStore } from "@/lib/stores/sample-browser";
import { useLibraryStore } from "@/lib/stores/library";
import { getAllSamples } from "@/lib/tauri";

interface SampleBrowserProps {
  onTabChange: (tab: "library" | "explore" | "settings") => void;
}

export function SampleBrowser({ onTabChange }: SampleBrowserProps) {
  const { filter, sidebarExpanded, hasActiveFilters, clearFilter,
    selectedSampleId, selectedSampleType, clearSelection, setSidebarExpanded } =
    useSampleBrowserStore();
  const setSelectedJam = useLibraryStore((s) => s.setSelectedJam);

  const { data, isLoading, isSuccess } = useQuery({
    queryKey: ["samples", filter],
    queryFn: () => getAllSamples(filter),
    staleTime: 10_000,
  });

  const samples = data ?? [];

  // Find the selected sample from fetched data
  const selectedSample =
    samples.find(
      (s) => s.id === selectedSampleId && s.sampleType === selectedSampleType,
    ) ?? null;

  const handleNavigateToJam = useCallback(
    (jamId: string) => {
      setSelectedJam(jamId);
      onTabChange("library");
    },
    [setSelectedJam, onTabChange],
  );

  // Escape key handler: close preview panel when open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSample) {
        e.preventDefault();
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedSample, clearSelection]);

  // Cmd+F handler: focus search input in sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        // Expand sidebar if collapsed
        if (!useSampleBrowserStore.getState().sidebarExpanded) {
          setSidebarExpanded(true);
        }
        // Focus the search input after a brief delay for sidebar animation
        requestAnimationFrame(() => {
          const searchInput = document.querySelector<HTMLInputElement>(
            '[aria-label="Search samples"]',
          );
          searchInput?.focus();
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setSidebarExpanded]);

  // Global empty state: no samples and no active filters
  if (isSuccess && samples.length === 0 && !hasActiveFilters) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-12 py-24">
        <h2 className="text-[28px] font-semibold text-foreground">
          No samples yet
        </h2>
        <p className="max-w-[400px] text-center text-sm text-muted-foreground">
          Bookmark sections in your jams or import recordings to auto-detect
          loops and sections.
        </p>
        <button
          type="button"
          onClick={() => onTabChange("library")}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: "#E8863A" }}
        >
          Go to Library
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-[#E8863A]" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarExpanded ? (
          <div className="relative transition-all duration-200 ease-out">
            <SampleSidebar />
            <SidebarToggle />
          </div>
        ) : (
          <SidebarToggle />
        )}

        {/* Table area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <SampleTable
            samples={samples}
            isLoaded={isSuccess}
            onNavigateToJam={handleNavigateToJam}
          />
        </div>
      </div>

      {/* Preview panel - slides up when sample selected */}
      <SamplePreviewPanel
        sample={selectedSample}
        onNavigateToJam={handleNavigateToJam}
        onClose={clearSelection}
      />

      {/* Screen reader announcement for result count */}
      <div aria-live="polite" className="sr-only">
        {data ? `${samples.length} samples matching` : ""}
      </div>
    </div>
  );
}
