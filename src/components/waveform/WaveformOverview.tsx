"use client";

import { useRef, useEffect, useCallback, type MouseEvent } from "react";
import type { PeakData } from "@/lib/types";

interface WaveformOverviewProps {
  peaks: PeakData;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  viewportStart?: number;
  viewportEnd?: number;
}

export function WaveformOverview({
  peaks,
  currentTime,
  duration,
  onSeek,
  viewportStart,
  viewportEnd,
}: WaveformOverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Draw peaks
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

    // Draw viewport highlight
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

    // Draw playback position
    if (duration > 0) {
      const posX = (currentTime / duration) * w;
      ctx.fillStyle = "#E8863A";
      ctx.fillRect(posX - 1, 0, 2, h);
    }
  }, [peaks, currentTime, duration, viewportStart, viewportEnd]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="h-12 w-full cursor-crosshair rounded-lg"
      style={{ background: "#1D2129" }}
    />
  );
}
