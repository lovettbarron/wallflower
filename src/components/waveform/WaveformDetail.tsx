"use client";

import { useRef, useEffect } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import type { PeakData } from "@/lib/types";

interface WaveformDetailProps {
  audioUrl: string;
  peaks: PeakData;
  onSeek: (time: number) => void;
}

export function WaveformDetail({
  audioUrl,
  peaks,
  onSeek,
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
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
  });

  useEffect(() => {
    if (!wavesurfer) return;

    const handleInteraction = (time: number) => {
      if (!seekingRef.current) {
        seekingRef.current = true;
        onSeek(time);
        requestAnimationFrame(() => {
          seekingRef.current = false;
        });
      }
    };

    wavesurfer.on("seeking", handleInteraction);

    return () => {
      wavesurfer.un("seeking", handleInteraction);
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
