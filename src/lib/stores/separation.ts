import { create } from "zustand";
import type { StemInfo, SeparationProgressEvent, BookmarkRecord } from "@/lib/types";
import { separateStems, cancelSeparation, exportStems, exportAudio } from "@/lib/tauri";

interface StemState {
  name: string;
  filePath: string;
  soloed: boolean;
  muted: boolean;
  audioBuffer: AudioBuffer | null;
}

interface SeparationState {
  // Mixer state
  mixerOpen: boolean;
  mixerBookmark: BookmarkRecord | null;
  stems: StemState[];
  isPlaying: boolean;
  currentTime: number;

  // Separation progress
  separating: boolean;
  progress: SeparationProgressEvent | null;

  // Actions
  startSeparation: (bookmark: BookmarkRecord) => Promise<void>;
  cancelSeparation: () => Promise<void>;
  openMixer: (bookmark: BookmarkRecord, stems: StemInfo[]) => void;
  closeMixer: () => void;
  toggleSolo: (stemName: string) => void;
  toggleMute: (stemName: string) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setStemBuffer: (stemName: string, buffer: AudioBuffer) => void;
  exportAllStems: () => Promise<string>;
  exportSelectedStems: () => Promise<string>;
  exportBookmarkAudio: (bookmarkId: string) => Promise<string>;
  updateProgress: (event: SeparationProgressEvent) => void;
}

export const useSeparationStore = create<SeparationState>((set, get) => ({
  mixerOpen: false,
  mixerBookmark: null,
  stems: [],
  isPlaying: false,
  currentTime: 0,
  separating: false,
  progress: null,

  startSeparation: async (bookmark) => {
    set({ separating: true, progress: null, mixerBookmark: bookmark });
    try {
      const stemInfos = await separateStems(bookmark.id);
      // On success, open mixer with returned stems
      get().openMixer(bookmark, stemInfos);
    } catch (err) {
      set({ separating: false });
      throw err;
    }
  },

  cancelSeparation: async () => {
    await cancelSeparation();
    set({ separating: false, progress: null });
  },

  openMixer: (bookmark, stemInfos) => {
    const stems: StemState[] = stemInfos.map((s) => ({
      name: s.stemName,
      filePath: s.filePath,
      soloed: false,
      muted: false,
      audioBuffer: null,
    }));
    set({ mixerOpen: true, mixerBookmark: bookmark, stems, separating: false, progress: null });
  },

  closeMixer: () => {
    set({ mixerOpen: false, stems: [], isPlaying: false, currentTime: 0, mixerBookmark: null });
  },

  toggleSolo: (stemName) => {
    set((s) => ({
      stems: s.stems.map((stem) =>
        stem.name === stemName ? { ...stem, soloed: !stem.soloed } : stem
      ),
    }));
  },

  toggleMute: (stemName) => {
    set((s) => ({
      stems: s.stems.map((stem) =>
        stem.name === stemName ? { ...stem, muted: !stem.muted } : stem
      ),
    }));
  },

  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),

  setStemBuffer: (stemName, buffer) => {
    set((s) => ({
      stems: s.stems.map((stem) =>
        stem.name === stemName ? { ...stem, audioBuffer: buffer } : stem
      ),
    }));
  },

  exportAllStems: async () => {
    const bookmark = get().mixerBookmark;
    if (!bookmark) throw new Error("No bookmark selected");
    const allNames = get().stems.map((s) => s.name);
    return exportStems(bookmark.id, allNames);
  },

  exportSelectedStems: async () => {
    const bookmark = get().mixerBookmark;
    if (!bookmark) throw new Error("No bookmark selected");
    const hasSoloed = get().stems.some((s) => s.soloed);
    const selected = get().stems
      .filter((s) => (hasSoloed ? s.soloed : !s.muted))
      .map((s) => s.name);
    return exportStems(bookmark.id, selected);
  },

  exportBookmarkAudio: async (bookmarkId) => {
    return exportAudio(bookmarkId);
  },

  updateProgress: (event) => {
    set({ progress: event });
    if (event.status === "completed") {
      set({ separating: false });
    }
  },
}));
