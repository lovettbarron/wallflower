import { create } from "zustand";

export interface TransportState {
  currentJamId: string | null;
  currentJamName: string | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  // Actions
  loadJam: (
    jamId: string,
    jamName: string,
    audioUrl: string,
    duration: number,
  ) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  stop: () => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  currentJamId: null,
  currentJamName: null,
  audioUrl: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,

  loadJam: (jamId, jamName, audioUrl, duration) =>
    set({
      currentJamId: jamId,
      currentJamName: jamName,
      audioUrl,
      isPlaying: false,
      currentTime: 0,
      duration,
    }),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  stop: () =>
    set({
      currentJamId: null,
      currentJamName: null,
      audioUrl: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }),
}));
