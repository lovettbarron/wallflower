"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft } from "lucide-react";
import { getJamWithMetadata, getPeaks, generatePeaksForJam } from "@/lib/tauri";
import type { JamDetail as JamDetailType, PeakData } from "@/lib/types";
import { WaveformOverview } from "@/components/waveform/WaveformOverview";
import { WaveformDetail } from "@/components/waveform/WaveformDetail";
import { MetadataEditor } from "@/components/metadata/MetadataEditor";
import { useTransportStore } from "@/lib/stores/transport";

interface JamDetailProps {
  jamId: string;
  onBack: () => void;
}

export function JamDetail({ jamId, onBack }: JamDetailProps) {
  const currentTime = useTransportStore((s) => s.currentTime);
  const duration = useTransportStore((s) => s.duration);
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const currentJamId = useTransportStore((s) => s.currentJamId);
  const loadJam = useTransportStore((s) => s.loadJam);
  const setPlaying = useTransportStore((s) => s.setPlaying);
  const setCurrentTime = useTransportStore((s) => s.setCurrentTime);

  const { data: jam, isLoading: jamLoading, refetch: refetchJam } = useQuery<JamDetailType | null>({
    queryKey: ["jam", jamId],
    queryFn: () => getJamWithMetadata(jamId),
    enabled: !!jamId,
  });

  const { data: peaks, isLoading: peaksLoading } = useQuery<PeakData>({
    queryKey: ["peaks", jamId],
    queryFn: async () => {
      if (jam?.peaksGenerated) {
        return getPeaks(jamId);
      }
      return generatePeaksForJam(jamId);
    },
    enabled: !!jamId && !!jam,
  });

  useEffect(() => {
    if (!jam || currentJamId === jam.id) return;
    const audioUrl = convertFileSrc(jam.filePath);
    loadJam(
      jam.id,
      jam.originalFilename || jam.filename,
      audioUrl,
      jam.durationSeconds || 0,
    );
  }, [jam, currentJamId, loadJam]);

  const handleOverviewSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
    },
    [setCurrentTime],
  );

  const handleWaveformSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
    },
    [setCurrentTime],
  );

  const handlePlayPause = useCallback(
    (playing: boolean) => {
      setPlaying(playing);
    },
    [setPlaying],
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
            currentTime={currentTime}
            duration={duration}
            onSeek={handleOverviewSeek}
          />

          <div className="h-6" />

          {/* Detail waveform */}
          <WaveformDetail
            audioUrl={audioUrl}
            peaks={peaks}
            onSeek={handleWaveformSeek}
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

      {/* Metadata editor */}
      {jam && (
        <MetadataEditor jam={jam} onUpdate={() => refetchJam()} />
      )}
    </div>
  );
}
