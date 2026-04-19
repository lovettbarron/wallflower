"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRecordingStore } from "@/lib/stores/recording";

interface PhotoAutoAttachedPayload {
  jamId: string;
  jamName: string;
}

interface RecordingStartedPayload {
  jamId: string;
  jamName: string;
  deviceName: string;
}

interface RecordingStoppedPayload {
  jamId: string;
  filePath: string;
  durationSeconds: number;
}

interface RecordingLevelPayload {
  rmsDb: number;
}

interface RecordingSilencePayload {
  offsetSamples: number;
}

const DEFAULT_SAMPLE_RATE = 48000;

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Global Tauri event listener component.
 * Listens for backend events and shows in-app toasts.
 * Extends to handle all recording events from the backend.
 */
export function TauriEventListener() {
  const silenceStartRef = useRef<number | null>(null);
  const wasDisconnectedRef = useRef(false);

  // Recording store selectors
  const isRecording = useRecordingStore((s) => s.isRecording);
  const setLevel = useRecordingStore((s) => s.setLevel);
  const setElapsed = useRecordingStore((s) => s.setElapsed);
  const setDeviceDisconnected = useRecordingStore(
    (s) => s.setDeviceDisconnected
  );
  const addSilenceRegion = useRecordingStore((s) => s.addSilenceRegion);
  const requestStop = useRecordingStore((s) => s.requestStop);
  const reset = useRecordingStore((s) => s.reset);

  // Elapsed time timer: runs every second while recording
  useEffect(() => {
    if (!isRecording) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, setElapsed]);

  // Tauri event listeners
  useEffect(() => {
    const cleanupFns: (() => void)[] = [];

    async function setupListeners() {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        // Request notification permission on first launch
        try {
          const { isPermissionGranted, requestPermission } = await import(
            "@tauri-apps/plugin-notification"
          );
          const granted = await isPermissionGranted();
          if (!granted) {
            await requestPermission();
          }
        } catch {
          // Notification plugin not available
        }

        // ---- Existing listeners ----

        const unlistenPhotoAttached = await listen<PhotoAutoAttachedPayload>(
          "photo-auto-attached",
          (event) => {
            const { jamName } = event.payload;
            toast("Patch photo auto-attached to " + jamName, {
              duration: 4000,
            });
          }
        );
        cleanupFns.push(unlistenPhotoAttached);

        // ---- Recording event listeners ----

        // Recording level updates
        const unlistenLevel = await listen<RecordingLevelPayload>(
          "recording-level",
          (event) => {
            setLevel(event.payload.rmsDb);
          }
        );
        cleanupFns.push(unlistenLevel);

        // Recording state changes
        const unlistenStateChanged = await listen<string>(
          "recording-state-changed",
          (event) => {
            const state = event.payload;

            if (state === "device_disconnected") {
              setDeviceDisconnected(true);
              wasDisconnectedRef.current = true;
              toast.error(
                "Audio device disconnected. Reconnect to resume recording.",
                { duration: Infinity, id: "device-disconnect" }
              );
            } else if (state === "recording") {
              if (wasDisconnectedRef.current) {
                // Device reconnection case
                setDeviceDisconnected(false);
                wasDisconnectedRef.current = false;
                toast.dismiss("device-disconnect");
                toast.success("Recording resumed", { duration: 3000 });
              }
              // Ensure store reflects recording state (covers edge cases
              // where state-changed fires but recording-started was missed)
              const currentState = useRecordingStore.getState();
              if (!currentState.isRecording) {
                useRecordingStore.setState({ isRecording: true });
              }
            } else if (state === "idle") {
              // Recording was stopped externally (e.g., backend or tray)
              reset();
              wasDisconnectedRef.current = false;
            } else if (state === "error") {
              toast.error("Recording error occurred", { duration: 6000 });
            }
          }
        );
        cleanupFns.push(unlistenStateChanged);

        // Device error (backup for state-changed)
        const unlistenDeviceError = await listen(
          "recording-device-error",
          () => {
            setDeviceDisconnected(true);
            wasDisconnectedRef.current = true;
          }
        );
        cleanupFns.push(unlistenDeviceError);

        // Device reconnected (backup for state-changed)
        const unlistenDeviceReconnected = await listen(
          "recording-device-reconnected",
          () => {
            setDeviceDisconnected(false);
            wasDisconnectedRef.current = false;
            toast.dismiss("device-disconnect");
            toast.success("Recording resumed", { duration: 3000 });
          }
        );
        cleanupFns.push(unlistenDeviceReconnected);

        // Silence detection
        const unlistenSilenceStart = await listen<RecordingSilencePayload>(
          "recording-silence-start",
          (event) => {
            silenceStartRef.current =
              event.payload.offsetSamples / DEFAULT_SAMPLE_RATE;
          }
        );
        cleanupFns.push(unlistenSilenceStart);

        const unlistenSilenceEnd = await listen<RecordingSilencePayload>(
          "recording-silence-end",
          (event) => {
            const endSeconds =
              event.payload.offsetSamples / DEFAULT_SAMPLE_RATE;
            if (silenceStartRef.current !== null) {
              addSilenceRegion(silenceStartRef.current, endSeconds);
              silenceStartRef.current = null;
            }
          }
        );
        cleanupFns.push(unlistenSilenceEnd);

        // Show stop dialog (triggered by tray or global shortcut)
        const unlistenShowStop = await listen("show-stop-dialog", async () => {
          requestStop();
          // Bring window to focus
          try {
            const { getCurrentWindow } = await import(
              "@tauri-apps/api/window"
            );
            await getCurrentWindow().setFocus();
          } catch {
            // Not in Tauri
          }
        });
        cleanupFns.push(unlistenShowStop);

        // Recording started (from backend after start)
        const unlistenStarted = await listen<RecordingStartedPayload>(
          "recording-started",
          (event) => {
            const { jamId, deviceName } = event.payload;
            // Set recording state in zustand store — this triggers:
            // 1. page.tsx renders RecordingView (isRecording === true)
            // 2. TransportBar switches to recording mode
            // 3. Navigation locks to recording view
            // 4. Elapsed timer useEffect starts (isRecording dependency)
            useRecordingStore.setState({
              isRecording: true,
              recordingJamId: jamId,
              deviceName: deviceName,
              elapsedSeconds: 0,
              rmsDb: -100,
              deviceDisconnected: false,
              silenceRegions: [],
              showStopDialog: false,
              levelHistory: [],
            });
            toast(`Recording from ${deviceName}`, { duration: 3000 });
          }
        );
        cleanupFns.push(unlistenStarted);

        // Recording stopped (from backend after stop)
        const unlistenStopped = await listen<RecordingStoppedPayload>(
          "recording-stopped",
          (event) => {
            const { durationSeconds } = event.payload;
            toast.success(
              `Recording saved -- ${formatDuration(durationSeconds)} captured`,
              { duration: 4000 }
            );
          }
        );
        cleanupFns.push(unlistenStopped);
      } catch {
        // Not running in Tauri context (e.g., during SSR or dev in browser)
      }
    }

    setupListeners();

    return () => {
      for (const cleanup of cleanupFns) {
        cleanup();
      }
    };
  }, [
    setLevel,
    setDeviceDisconnected,
    addSilenceRegion,
    requestStop,
    reset,
  ]);

  return null;
}
