import { create } from "zustand";
import { startRecording, stopRecording } from "@/lib/tauri";
import { useLibraryStore } from "@/lib/stores/library";

export interface RecordingState {
  isRecording: boolean;
  recordingJamId: string | null;
  deviceName: string | null;
  elapsedSeconds: number;
  rmsDb: number;
  deviceDisconnected: boolean;
  silenceRegions: { startSeconds: number; endSeconds: number }[];
  showStopDialog: boolean;
  /** Level data buffer for waveform rendering (last N rms values) */
  levelHistory: number[];

  // Actions
  startRec: () => Promise<{ jamId: string; deviceName: string } | null>;
  requestStop: () => void;
  cancelStop: () => void;
  confirmStop: () => Promise<void>;
  setElapsed: (seconds: number) => void;
  setLevel: (rmsDb: number) => void;
  setDeviceDisconnected: (disconnected: boolean) => void;
  addSilenceRegion: (start: number, end: number) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  recordingJamId: null,
  deviceName: null,
  elapsedSeconds: 0,
  rmsDb: -100,
  deviceDisconnected: false,
  silenceRegions: [] as { startSeconds: number; endSeconds: number }[],
  showStopDialog: false,
  levelHistory: [] as number[],

  startRec: async () => {
    try {
      const result = await startRecording();
      set({
        isRecording: true,
        recordingJamId: result.jamId,
        deviceName: result.deviceName,
        elapsedSeconds: 0,
        rmsDb: -100,
        deviceDisconnected: false,
        silenceRegions: [],
        levelHistory: [],
      });
      return result;
    } catch (e) {
      console.error("Failed to start recording:", e);
      return null;
    }
  },

  requestStop: () => set({ showStopDialog: true }),
  cancelStop: () => set({ showStopDialog: false }),

  confirmStop: async () => {
    const jamId = useRecordingStore.getState().recordingJamId;
    try {
      await stopRecording();
    } catch (e) {
      console.error("Failed to stop recording:", e);
    }
    set({
      isRecording: false,
      recordingJamId: null,
      deviceName: null,
      elapsedSeconds: 0,
      rmsDb: -100,
      deviceDisconnected: false,
      silenceRegions: [],
      showStopDialog: false,
      levelHistory: [],
    });
    if (jamId) {
      useLibraryStore.getState().setSelectedJam(jamId);
    }
  },

  setElapsed: (seconds) => set({ elapsedSeconds: seconds }),

  setLevel: (rmsDb) =>
    set((state) => ({
      rmsDb,
      // Keep last 600 values (~40 seconds at 15fps)
      levelHistory: [...state.levelHistory.slice(-599), rmsDb],
    })),

  setDeviceDisconnected: (disconnected) =>
    set({ deviceDisconnected: disconnected }),

  addSilenceRegion: (start, end) =>
    set((state) => ({
      silenceRegions: [
        ...state.silenceRegions,
        { startSeconds: start, endSeconds: end },
      ],
    })),

  reset: () =>
    set({
      isRecording: false,
      recordingJamId: null,
      deviceName: null,
      elapsedSeconds: 0,
      rmsDb: -100,
      deviceDisconnected: false,
      silenceRegions: [],
      showStopDialog: false,
      levelHistory: [],
    }),
}));
