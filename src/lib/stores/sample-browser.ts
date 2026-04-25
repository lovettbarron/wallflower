"use client";

import { create } from "zustand";
import type { SampleFilter, SampleType, SortColumn } from "@/lib/types";

function hasValues(filter: SampleFilter): boolean {
  return Object.values(filter).some(
    (v) =>
      v !== undefined &&
      v !== null &&
      (Array.isArray(v) ? v.length > 0 : v !== ""),
  );
}

export interface SampleBrowserState {
  // Filter state
  filter: SampleFilter;
  hasActiveFilters: boolean;
  sidebarExpanded: boolean;

  // Sort state
  sortColumn: SortColumn;
  sortDirection: "asc" | "desc";

  // Selection
  selectedSampleId: string | null;
  selectedSampleType: SampleType | null;

  // Actions
  setFilter: (partial: Partial<SampleFilter>) => void;
  clearFilter: () => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setSort: (column: SortColumn) => void;
  selectSample: (id: string, type: SampleType) => void;
  clearSelection: () => void;
}

export const useSampleBrowserStore = create<SampleBrowserState>((set) => ({
  // Filter
  filter: {},
  hasActiveFilters: false,
  sidebarExpanded: true,

  // Sort -- default by source jam date descending (per UI-SPEC)
  sortColumn: "source",
  sortDirection: "desc",

  // Selection
  selectedSampleId: null,
  selectedSampleType: null,

  // Actions
  setFilter: (partial) =>
    set((state) => {
      const newFilter = { ...state.filter, ...partial };
      return { filter: newFilter, hasActiveFilters: hasValues(newFilter) };
    }),

  clearFilter: () => set({ filter: {}, hasActiveFilters: false }),

  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

  setSort: (column) =>
    set((state) => {
      if (state.sortColumn === column) {
        // Toggle direction when same column re-clicked
        return {
          sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
        };
      }
      // New column: default to ascending, except "source" which defaults descending
      return {
        sortColumn: column,
        sortDirection: column === "source" ? "desc" : "asc",
      };
    }),

  selectSample: (id, type) =>
    set({ selectedSampleId: id, selectedSampleType: type }),

  clearSelection: () =>
    set({ selectedSampleId: null, selectedSampleType: null }),
}));
