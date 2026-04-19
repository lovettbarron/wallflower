"use client";

import { useRef, useEffect, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import type { PeakData } from "@/lib/types";

interface WaveformDetailProps {
  audioUrl: string;
  peaks: PeakData;
  currentTime: number;
  onSeek: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  isPlaying: boolean;
}

export function WaveformDetail({
  audioUrl,
  peaks,
  currentTime,
  onSeek,
  onPlayPause,
  isPlaying,
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    peaks: [peaks.peaks.map((p) => p[0])],
    duration: peaks.duration,
    waveColor: "#E8863A",
    progressColor: "#B55E20",
    cursorColor: "#E8863A",
    cursorWidth: 2,
    height: 200,
    normalize: true,
    minPxPerSec: 1,
    interact: true,
    mediaControls: false,
  });

  // Sync cursor position from transport (read-only — don't push back)
  useEffect(() => {
    if (!wavesurfer || !isReady || peaks.duration <= 0) return;
    const progress = currentTime / peaks.duration;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const wsTime = wavesurfer.getCurrentTime();
    if (Math.abs(wsTime - currentTime) > 0.3) {
      wavesurfer.seekTo(clampedProgress);
    }
  }, [wavesurfer, isReady, currentTime, peaks.duration]);

  // Handle user clicking on waveform to seek
  useEffect(() => {
    if (!wavesurfer) return;

    const onSeeking = (time: number) => onSeek(time);
    const onClick = () => {
      const time = wavesurfer.getCurrentTime();
      onSeek(time);
    };

    wavesurfer.on("seeking", onSeeking);
    wavesurfer.on("click", onClick);

    return () => {
      wavesurfer.un("seeking", onSeeking);
      wavesurfer.un("click", onClick);
    };
  }, [wavesurfer, onSeek]);

  return (
    <div className="relative w-full">
      {!isReady && (
        <div
          className="h-[200px] w-full animate-pulse rounded-lg"
          style={{ background: "#1D2129" }}
        />
      )}
      <div
        ref={containerRef}
        className="w-full rounded-lg"
        style={{
          background: "#1D2129",
          display: isReady ? "block" : "none",
        }}
      />
    </div>
  );
}
