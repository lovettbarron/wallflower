"use client";

import { useRef, useEffect, useCallback, type PointerEvent } from "react";
import type { PeakData, BookmarkRecord, BookmarkColor } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";
import { useTransportStore } from "@/lib/stores/transport";

const EDGE_HIT_ZONE = 6;

type DragMode = "none" | "pan" | "resize-left" | "resize-right";

interface WaveformOverviewProps {
  peaks: PeakData;
  onSeek: (time: number) => void;
  viewportStart?: number;
  viewportEnd?: number;
  bookmarks?: BookmarkRecord[];
  onViewportPan?: (newStartTime: number) => void;
  onViewportResize?: (newStart: number, newEnd: number) => void;
}

export function WaveformOverview({
  peaks,
  onSeek,
  viewportStart,
  viewportEnd,
  bookmarks = [],
  onViewportPan,
  onViewportResize,
}: WaveformOverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    originStart: number;
    originEnd: number;
    moved: boolean;
  } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      let maxAbs = 0;
      for (const [mn, mx] of peaks.peaks) {
        const a = Math.max(Math.abs(mn), Math.abs(mx));
        if (a > maxAbs) maxAbs = a;
      }
      const scale = maxAbs > 0 ? 1 / maxAbs : 1;

      const step = peakCount / w;
      for (let x = 0; x < w; x++) {
        const idx = Math.floor(x * step);
        if (idx >= peakCount) break;
        const [min, max] = peaks.peaks[idx];
        const top = mid + min * scale * mid;
        const bottom = mid + max * scale * mid;
        const barHeight = Math.max(1, bottom - top);
        ctx.fillRect(x, top, 1, barHeight);
      }
    }

    const totalDuration = duration > 0 ? duration : peaks.duration;
    if (totalDuration > 0) {
      for (const bookmark of bookmarks) {
        const colorKey = bookmark.color as BookmarkColor;
        const colorInfo = BOOKMARK_COLORS[colorKey] || BOOKMARK_COLORS.coral;
        const startX = (bookmark.startSeconds / totalDuration) * w;
        const endX = (bookmark.endSeconds / totalDuration) * w;
        const spanPx = endX - startX;

        if (spanPx > 4) {
          ctx.fillStyle = colorInfo.fill.replace("0.25", "0.15");
          ctx.fillRect(startX, 0, spanPx, h);
          ctx.fillStyle = colorInfo.solid;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(startX, 0, 2, h);
          ctx.fillRect(endX - 2, 0, 2, h);
          ctx.globalAlpha = 1;
        } else {
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
      duration > 0 &&
      (viewportEnd - viewportStart) < duration * 0.99
    ) {
      const startX = (viewportStart / duration) * w;
      const endX = (viewportEnd / duration) * w;
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, startX, h);
      ctx.fillRect(endX, 0, w - endX, h);
      ctx.strokeStyle = "rgba(232, 134, 58, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(startX, 0, endX - startX, h);

      // Draw edge handles
      ctx.fillStyle = "rgba(232, 134, 58, 0.9)";
      ctx.fillRect(startX - 1, 0, 3, h);
      ctx.fillRect(endX - 2, 0, 3, h);
    }

    if (duration > 0) {
      const posX = (currentTime / duration) * w;
      ctx.fillStyle = "#E8863A";
      ctx.fillRect(posX - 1, 0, 2, h);
    }
  }, [peaks, viewportStart, viewportEnd, bookmarks]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  useEffect(() => {
    const unsub = useTransportStore.subscribe((state, prev) => {
      if (
        state.currentTime !== prev.currentTime ||
        state.duration !== prev.duration
      ) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      }
    });
    return unsub;
  }, [draw]);

  const isZoomed = viewportStart !== undefined && viewportEnd !== undefined &&
    useTransportStore.getState().duration > 0 &&
    (viewportEnd - viewportStart) < useTransportStore.getState().duration * 0.99;

  const getHitZone = useCallback((clientX: number): DragMode => {
    const canvas = canvasRef.current;
    if (!canvas || viewportStart === undefined || viewportEnd === undefined) return "none";
    const { duration } = useTransportStore.getState();
    if (duration <= 0 || (viewportEnd - viewportStart) >= duration * 0.99) return "none";

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const startX = (viewportStart / duration) * rect.width;
    const endX = (viewportEnd / duration) * rect.width;

    if (Math.abs(x - startX) <= EDGE_HIT_ZONE) return "resize-left";
    if (Math.abs(x - endX) <= EDGE_HIT_ZONE) return "resize-right";
    if (x > startX && x < endX) return "pan";
    return "none";
  }, [viewportStart, viewportEnd]);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || viewportStart === undefined || viewportEnd === undefined) return;

    const mode = getHitZone(e.clientX);
    if (mode === "none") return;

    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      originStart: viewportStart,
      originEnd: viewportEnd,
      moved: false,
    };
  }, [getHitZone, viewportStart, viewportEnd]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;

    // Update cursor based on hit zone when not dragging
    if (!drag) {
      const zone = getHitZone(e.clientX);
      if (zone === "resize-left" || zone === "resize-right") {
        canvas!.style.cursor = "ew-resize";
      } else if (zone === "pan") {
        canvas!.style.cursor = "grab";
      } else {
        canvas!.style.cursor = "crosshair";
      }
      return;
    }

    if (!canvas) return;
    const { duration } = useTransportStore.getState();
    if (duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 2) drag.moved = true;

    const timeDelta = (dx / rect.width) * duration;
    const viewportSpan = drag.originEnd - drag.originStart;

    if (drag.mode === "pan") {
      canvas.style.cursor = "grabbing";
      let newStart = drag.originStart + timeDelta;
      newStart = Math.max(0, Math.min(newStart, duration - viewportSpan));
      onViewportPan?.(newStart);
    } else if (drag.mode === "resize-left") {
      let newStart = drag.originStart + timeDelta;
      newStart = Math.max(0, Math.min(newStart, drag.originEnd - 0.5));
      onViewportResize?.(newStart, drag.originEnd);
    } else if (drag.mode === "resize-right") {
      let newEnd = drag.originEnd + timeDelta;
      newEnd = Math.max(drag.originStart + 0.5, Math.min(newEnd, duration));
      onViewportResize?.(drag.originStart, newEnd);
    }
  }, [getHitZone, onViewportPan, onViewportResize]);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    dragRef.current = null;

    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
      const zone = getHitZone(e.clientX);
      canvas.style.cursor = zone === "pan" ? "grab" : zone !== "none" ? "ew-resize" : "crosshair";
    }

    // If the user didn't drag, treat as a click-to-seek
    if (!drag || !drag.moved) {
      if (!canvas) return;
      const { duration } = useTransportStore.getState();
      if (duration <= 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / rect.width) * duration;
      onSeek(Math.max(0, Math.min(time, duration)));
    }
  }, [getHitZone, onSeek]);

  const currentTime = useTransportStore((s) => s.currentTime);
  const duration = useTransportStore((s) => s.duration);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="slider"
      tabIndex={0}
      aria-label="Waveform overview — click to seek, drag viewport to pan"
      aria-valuemin={0}
      aria-valuemax={duration > 0 ? duration : peaks.duration}
      aria-valuenow={currentTime}
      className="h-12 w-full cursor-crosshair rounded-lg touch-none focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
      style={{ background: "#1D2129" }}
    />
  );
}
