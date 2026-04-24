"use client";

import { useRef, useEffect, useCallback, type MouseEvent } from "react";
import type { PeakData, BookmarkRecord, BookmarkColor } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";
import { useTransportStore } from "@/lib/stores/transport";

interface WaveformOverviewProps {
  peaks: PeakData;
  onSeek: (time: number) => void;
  viewportStart?: number;
  viewportEnd?: number;
  bookmarks?: BookmarkRecord[];
}

export function WaveformOverview({
  peaks,
  onSeek,
  viewportStart,
  viewportEnd,
  bookmarks = [],
}: WaveformOverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

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

      // Draw bookmark indicators
      const totalDuration = duration > 0 ? duration : peaks.duration;
      if (totalDuration > 0) {
        for (const bookmark of bookmarks) {
          const colorKey = bookmark.color as BookmarkColor;
          const colorInfo = BOOKMARK_COLORS[colorKey] || BOOKMARK_COLORS.coral;
          const startX = (bookmark.startSeconds / totalDuration) * w;
          const endX = (bookmark.endSeconds / totalDuration) * w;
          const spanPx = endX - startX;

          if (spanPx > 4) {
            // Wide enough to render as a filled region
            ctx.fillStyle = colorInfo.fill.replace("0.25", "0.15");
            ctx.fillRect(startX, 0, spanPx, h);
            // Left and right borders
            ctx.fillStyle = colorInfo.solid;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(startX, 0, 2, h);
            ctx.fillRect(endX - 2, 0, 2, h);
            ctx.globalAlpha = 1;
          } else {
            // Narrow: render as a single line
            ctx.fillStyle = colorInfo.solid;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(startX, 0, 2, h);
            ctx.globalAlpha = 1;
          }
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
  }, [peaks, viewportStart, viewportEnd, bookmarks]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { duration } = useTransportStore.getState();
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  const currentTime = useTransportStore((s) => s.currentTime);
  const duration = useTransportStore((s) => s.duration);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      role="slider"
      tabIndex={0}
      aria-label="Waveform overview — click to seek"
      aria-valuemin={0}
      aria-valuemax={duration > 0 ? duration : peaks.duration}
      aria-valuenow={currentTime}
      className="h-12 w-full cursor-crosshair rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
      style={{ background: "#1D2129" }}
    />
  );
}
