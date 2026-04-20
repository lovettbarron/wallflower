import { create } from "zustand";
import type { SearchFilter } from "@/lib/types";

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
