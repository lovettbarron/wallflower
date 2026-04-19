import { create } from "zustand";

export interface LibraryState {
  selectedJamId: string | null;
  setSelectedJam: (id: string | null) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  selectedJamId: null,
  setSelectedJam: (id) => set({ selectedJamId: id }),
}));
