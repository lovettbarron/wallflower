import { create } from "zustand";

export interface ActiveLoop {
  startSeconds: number;
  endSeconds: number;
  label: string;
}

export interface TransportState {
  currentJamId: string | null;
  currentJamName: string | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeLoop: ActiveLoop | null;
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
  setActiveLoop: (loop: ActiveLoop | null) => void;
  stop: () => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  currentJamId: null,
  currentJamName: null,
  audioUrl: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  activeLoop: null,

  loadJam: (jamId, jamName, audioUrl, duration) =>
    set({
      currentJamId: jamId,
      currentJamName: jamName,
      audioUrl,
      isPlaying: false,
      currentTime: 0,
      duration,
      activeLoop: null,
    }),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  setActiveLoop: (loop) => set({ activeLoop: loop }),

  stop: () =>
    set({
      currentJamId: null,
      currentJamName: null,
      audioUrl: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      activeLoop: null,
    }),
}));
