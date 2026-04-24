"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useRecordingStore } from "@/lib/stores/recording";
import { getJamWithMetadata } from "@/lib/tauri";
import type { JamDetail as JamDetailType } from "@/lib/types";
import { RecordingWaveform } from "./RecordingWaveform";
import { StopRecordingDialog } from "./StopRecordingDialog";
import { MetadataEditor } from "@/components/metadata/MetadataEditor";

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * RecordingView: Locked detail view shown during active recording.
 *
 * Replaces normal app content when recording is active.
 * Navigation is disabled -- user must stop recording to return to library.
 * Includes live waveform, elapsed time, metadata editor, and stop dialog.
 */
export function RecordingView() {
  const recordingJamId = useRecordingStore((s) => s.recordingJamId);
  const elapsedSeconds = useRecordingStore((s) => s.elapsedSeconds);
  const deviceName = useRecordingStore((s) => s.deviceName);
  const deviceDisconnected = useRecordingStore((s) => s.deviceDisconnected);

  const {
    data: jam,
    refetch: refetchJam,
  } = useQuery<JamDetailType | null>({
    queryKey: ["jam", recordingJamId],
    queryFn: () => getJamWithMetadata(recordingJamId!),
    enabled: !!recordingJamId,
    refetchInterval: 5000,
  });

  const jamName =
    jam?.originalFilename || jam?.filename || recordingJamId || "New Recording";

  return (
    <div className="flex flex-col h-full">
      {/* ARIA live region for recording state announcements */}
      <div aria-live="assertive" className="sr-only">
        {elapsedSeconds <= 1 ? "Recording started" : ""}
      </div>

      {/* Header with disabled back nav */}
      <div className="px-12 pt-8">
        <button
          disabled
          className="text-muted-foreground cursor-not-allowed flex items-center gap-1 text-sm mb-4"
          title="Stop recording to return to library"
          aria-label="Library — disabled during recording"
        >
          <ArrowLeft size={16} />
          Library
        </button>

        {/* Recording title with pulsing dot */}
        <div className="flex items-center gap-3 mb-2">
          <span
            aria-hidden="true"
            className="recording-dot inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#E53E3E" }}
          />
          <h1 className="text-xl font-semibold text-foreground">
            Recording: {jamName}
          </h1>
        </div>

        {/* Elapsed time and device info */}
        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
          <span aria-live="polite" className="font-mono tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </span>
          {deviceName && <span>{deviceName}</span>}
          {deviceDisconnected && (
            <span className="text-destructive font-medium">
              Device disconnected
            </span>
          )}
        </div>
      </div>

      {/* Live waveform */}
      <div className="px-12">
        <RecordingWaveform height={200} />
      </div>

      {/* Metadata editor (identical to Phase 2 jam detail) */}
      <div className="flex-1 overflow-y-auto px-12 py-6 pb-20">
        {jam && <MetadataEditor jam={jam} onUpdate={() => refetchJam()} />}
      </div>

      {/* StopRecordingDialog (rendered but hidden until requestStop) */}
      <StopRecordingDialog />
    </div>
  );
}
