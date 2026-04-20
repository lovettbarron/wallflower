"use client";

import { useRef, useEffect, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PeakData } from "@/lib/types";
import { getAnalysisResults } from "@/lib/tauri";
import { useTransportStore } from "@/lib/stores/transport";
import { SectionMarkers } from "./SectionMarkers";

interface WaveformOverviewProps {
  peaks: PeakData;
  onSeek: (time: number) => void;
  viewportStart?: number;
  viewportEnd?: number;
  jamId?: string;
}

export function WaveformOverview({
  peaks,
  onSeek,
  viewportStart,
  viewportEnd,
  jamId,
}: WaveformOverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [overviewWidth, setOverviewWidth] = useState(0);

  const { data: analysis } = useQuery({
    queryKey: ["jam", jamId, "analysis"],
    queryFn: () => getAnalysisResults(jamId!),
    enabled: !!jamId,
    staleTime: 30000,
  });

  // Track canvas width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setOverviewWidth(entry.contentRect.width);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawFrame = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { currentTime, duration } = useTransportStore.getState();

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = "#E8863A";
      const peakCount = peaks.peaks.length;
      if (peakCount > 0) {
        const step = peakCount / w;
        for (let x = 0; x < w; x++) {
          const idx = Math.floor(x * step);
          if (idx >= peakCount) break;
          const [min, max] = peaks.peaks[idx];
          const top = mid + min * mid;
          const bottom = mid + max * mid;
          const barHeight = Math.max(1, bottom - top);
          ctx.fillRect(x, top, 1, barHeight);
        }
      }

      if (
        viewportStart !== undefined &&
        viewportEnd !== undefined &&
        duration > 0
      ) {
        const startX = (viewportStart / duration) * w;
        const endX = (viewportEnd / duration) * w;
        ctx.fillStyle = "rgba(232, 134, 58, 0.1)";
        ctx.fillRect(startX, 0, endX - startX, h);
      }

      if (duration > 0) {
        const posX = (currentTime / duration) * w;
        ctx.fillStyle = "#E8863A";
        ctx.fillRect(posX - 1, 0, 2, h);
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => cancelAnimationFrame(rafRef.current);
  }, [peaks, viewportStart, viewportEnd]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { duration } = useTransportStore.getState();
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="h-12 w-full cursor-crosshair rounded-lg"
        style={{ background: "#1D2129" }}
      />
      {analysis?.sections && analysis.sections.length > 0 && overviewWidth > 0 && (
        <SectionMarkers
          sections={analysis.sections}
          totalDuration={peaks.duration}
          containerWidth={overviewWidth}
          showLabels={false}
        />
      )}
    </div>
  );
}
