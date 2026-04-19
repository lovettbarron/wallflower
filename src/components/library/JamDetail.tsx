"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft } from "lucide-react";
import { getJam, getPeaks } from "@/lib/tauri";
import type { JamRecord, PeakData } from "@/lib/types";
import { WaveformOverview } from "@/components/waveform/WaveformOverview";
import { WaveformDetail } from "@/components/waveform/WaveformDetail";
import { useTransportStore } from "@/lib/stores/transport";

interface JamDetailProps {
  jamId: string;
  onBack: () => void;
}

export function JamDetail({ jamId, onBack }: JamDetailProps) {
  const transportStore = useTransportStore();
  const [seekTo, setSeekTo] = useState<number | null>(null);

  const { data: jam, isLoading: jamLoading } = useQuery<JamRecord | null>({
    queryKey: ["jam", jamId],
    queryFn: () => getJam(jamId),
    enabled: !!jamId,
  });

  const { data: peaks, isLoading: peaksLoading } = useQuery<PeakData>({
    queryKey: ["peaks", jamId],
    queryFn: () => getPeaks(jamId),
    enabled: !!jamId && !!jam?.peaksGenerated,
  });

  // Load jam into transport when page mounts
  useEffect(() => {
    if (!jam || transportStore.currentJamId === jam.id) return;
    const audioUrl = convertFileSrc(jam.filePath);
    transportStore.loadJam(
      jam.id,
      jam.originalFilename || jam.filename,
      audioUrl,
      jam.durationSeconds || 0,
    );
  }, [jam]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      transportStore.setCurrentTime(time);
    },
    [transportStore],
  );

  const handleSeek = useCallback(
    (time: number) => {
      transportStore.setCurrentTime(time);
    },
    [transportStore],
  );

  const handleOverviewSeek = useCallback(
    (time: number) => {
      setSeekTo(time);
      transportStore.setCurrentTime(time);
    },
    [transportStore],
  );

  const handlePlayPause = useCallback(
    (playing: boolean) => {
      transportStore.setPlaying(playing);
    },
    [transportStore],
  );

  if (jamLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (!jam) {
    return <p className="text-sm text-muted-foreground">Jam not found.</p>;
  }

  const audioUrl = convertFileSrc(jam.filePath);

  return (
    <div>
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 rounded text-sm transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
        style={{ color: "#E8863A" }}
      >
        <ArrowLeft size={16} />
        Library
      </button>

      {/* Jam title */}
      <h1 className="mb-6 text-xl font-semibold text-foreground">
        {jam.originalFilename || jam.filename}
      </h1>

      {/* Waveforms */}
      {peaksLoading && (
        <div>
          <div
            className="mb-6 h-12 w-full animate-pulse rounded-lg"
            style={{ background: "#1D2129" }}
          />
          <div
            className="h-[200px] w-full animate-pulse rounded-lg"
            style={{ background: "#1D2129" }}
          />
        </div>
      )}

      {peaks && (
        <>
          {/* Overview waveform */}
          <WaveformOverview
            peaks={peaks}
            currentTime={transportStore.currentTime}
            duration={transportStore.duration}
            onSeek={handleOverviewSeek}
          />

          <div className="h-6" />

          {/* Detail waveform */}
          <WaveformDetail
            audioUrl={audioUrl}
            peaks={peaks}
            onTimeUpdate={handleTimeUpdate}
            onSeek={handleSeek}
            onPlayPause={handlePlayPause}
            isPlaying={transportStore.isPlaying}
            seekTo={seekTo}
          />
        </>
      )}

      {!peaks && !peaksLoading && (
        <div
          className="flex h-[200px] w-full items-center justify-center rounded-lg text-sm text-muted-foreground"
          style={{ background: "#1D2129" }}
        >
          Waveform peaks not yet generated for this recording.
        </div>
      )}

      <div className="h-6" />

      {/* Metadata placeholder */}
      <div
        className="rounded-xl p-6 text-sm text-muted-foreground"
        style={{ background: "#1D2129" }}
      >
        Metadata section coming in Plan 03
      </div>
    </div>
  );
}
