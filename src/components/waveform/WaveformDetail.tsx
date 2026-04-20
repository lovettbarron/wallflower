"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { useQuery } from "@tanstack/react-query";
import type { PeakData, LoopRecord, SectionRecord } from "@/lib/types";
import { getAnalysisResults } from "@/lib/tauri";
import { useTransportStore } from "@/lib/stores/transport";
import { SectionMarkers } from "./SectionMarkers";
import { LoopBrackets } from "./LoopBrackets";

interface WaveformDetailProps {
  audioUrl: string;
  peaks: PeakData;
  onSeek: (time: number) => void;
  jamId?: string;
}

export function WaveformDetail({
  audioUrl,
  peaks,
  onSeek,
  jamId,
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const { activeLoop, setActiveLoop, setPlaying, setCurrentTime } =
    useTransportStore();

  const { data: analysis } = useQuery({
    queryKey: ["jam", jamId, "analysis"],
    queryFn: () => getAnalysisResults(jamId!),
    enabled: !!jamId,
    staleTime: 30000,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const flatPeaks = useMemo(
    () => [peaks.peaks.map((p) => p[0])],
    [peaks],
  );

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    peaks: flatPeaks,
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

    wavesurfer.on("interaction", handleInteraction);

    return () => {
      wavesurfer.un("interaction", handleInteraction);
    };
  }, [wavesurfer, onSeek]);

  const handleLoopClick = useCallback(
    (loop: LoopRecord) => {
      const isSameLoop = activeLoop?.label === loop.label;
      if (isSameLoop) {
        setActiveLoop(null);
        return;
      }
      setActiveLoop({
        startSeconds: loop.startSeconds,
        endSeconds: loop.endSeconds,
        label: loop.evolving
          ? `${loop.label} x${loop.repeatCount} (evolving)`
          : `${loop.label} x${loop.repeatCount}`,
      });
      setCurrentTime(loop.startSeconds);
      onSeek(loop.startSeconds);
      setPlaying(true);
    },
    [activeLoop, setActiveLoop, setCurrentTime, setPlaying, onSeek],
  );

  const handleSectionClick = useCallback(
    (section: SectionRecord) => {
      setActiveLoop(null);
      setCurrentTime(section.startSeconds);
      onSeek(section.startSeconds);
      setPlaying(true);
    },
    [setActiveLoop, setCurrentTime, setPlaying, onSeek],
  );

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

      {isReady && analysis?.sections && analysis.sections.length > 0 && containerWidth > 0 && (
        <SectionMarkers
          sections={analysis.sections}
          totalDuration={peaks.duration}
          containerWidth={containerWidth}
          showLabels={true}
          onSectionClick={handleSectionClick}
        />
      )}

      {isReady && analysis?.loops && analysis.loops.length > 0 && containerWidth > 0 && (
        <LoopBrackets
          loops={analysis.loops}
          totalDuration={peaks.duration}
          containerWidth={containerWidth}
          activeLoopLabel={activeLoop?.label?.split(" x")[0]}
          onLoopClick={handleLoopClick}
        />
      )}

      {isReady && analysis?.key && analysis?.tempo && (
        <div
          className="absolute right-2 top-2 rounded-lg px-1.5 py-0.5 text-xs text-foreground"
          style={{ background: "rgba(21, 25, 33, 0.8)" }}
        >
          {analysis.key.keyName}{analysis.key.scale === "minor" ? "m" : ""} | {Math.round(analysis.tempo.bpm)} BPM
        </div>
      )}
    </div>
  );
}
