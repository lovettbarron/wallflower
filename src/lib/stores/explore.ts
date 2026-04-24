import { create } from "zustand";

export interface DimensionWeights {
  key: number; // 0-100, default 50
  tempo: number; // 0-100, default 50
  date: number; // 0-100, default 25
  instruments: number; // 0-100, default 0
  collaborators: number; // 0-100, default 0
}

interface ExploreState {
  weights: DimensionWeights;
  setWeight: (dim: keyof DimensionWeights, value: number) => void;
  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;
  hoveredNodeId: string | null;
  setHoveredNode: (id: string | null) => void;
  focusedNodeId: string | null;
  setFocusedNode: (id: string | null) => void;
  /** Cache for waveform peaks per node (loaded on hover/select). */
  peaksCache: Record<string, number[]>;
  setPeaks: (id: string, peaks: number[]) => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  weights: { key: 50, tempo: 50, date: 25, instruments: 0, collaborators: 0 },
  setWeight: (dim, value) =>
    set((s) => ({ weights: { ...s.weights, [dim]: value } })),
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  hoveredNodeId: null,
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  focusedNodeId: null,
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  peaksCache: {},
  setPeaks: (id, peaks) =>
    set((s) => ({ peaksCache: { ...s.peaksCache, [id]: peaks } })),
}));

/** Returns the dimension with the highest weight. Falls back to 'key'. */
export function getDominantDimension(
  weights: DimensionWeights,
): keyof DimensionWeights {
  const entries = Object.entries(weights) as [keyof DimensionWeights, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : "key";
}
