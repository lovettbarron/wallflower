"use client";

import { useRef, useEffect, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import type { PeakData } from "@/lib/types";

interface WaveformDetailProps {
  audioUrl: string;
  peaks: PeakData;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  isPlaying: boolean;
  seekTo?: number | null;
}

export function WaveformDetail({
  audioUrl,
  peaks,
  onTimeUpdate,
  onSeek,
  onPlayPause,
  isPlaying,
  seekTo,
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeekRef = useRef<number | null>(null);

  const { wavesurfer, isReady, currentTime } = useWavesurfer({
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
  });

  // Sync time updates
  useEffect(() => {
    onTimeUpdate(currentTime);
  }, [currentTime, onTimeUpdate]);

  // Listen for wavesurfer events
  useEffect(() => {
    if (!wavesurfer) return;

    const onPlay = () => onPlayPause(true);
    const onPause = () => onPlayPause(false);
    const onSeeking = (time: number) => onSeek(time);

    wavesurfer.on("play", onPlay);
    wavesurfer.on("pause", onPause);
    wavesurfer.on("seeking", onSeeking);

    return () => {
      wavesurfer.un("play", onPlay);
      wavesurfer.un("pause", onPause);
      wavesurfer.un("seeking", onSeeking);
    };
  }, [wavesurfer, onPlayPause, onSeek]);

  // Sync play/pause from transport store
  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    if (isPlaying && !wavesurfer.isPlaying()) {
      wavesurfer.play();
    } else if (!isPlaying && wavesurfer.isPlaying()) {
      wavesurfer.pause();
    }
  }, [wavesurfer, isReady, isPlaying]);

  // Handle external seek
  useEffect(() => {
    if (
      !wavesurfer ||
      !isReady ||
      seekTo === null ||
      seekTo === undefined ||
      seekTo === lastSeekRef.current
    )
      return;
    lastSeekRef.current = seekTo;
    const progress = peaks.duration > 0 ? seekTo / peaks.duration : 0;
    wavesurfer.seekTo(Math.max(0, Math.min(1, progress)));
  }, [wavesurfer, isReady, seekTo, peaks.duration]);

  // Expose wavesurfer for external control
  const handlePlayPause = useCallback(() => {
    if (!wavesurfer) return;
    wavesurfer.playPause();
  }, [wavesurfer]);

  if (!containerRef) return null;

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
