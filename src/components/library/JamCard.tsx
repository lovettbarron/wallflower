"use client";

import { useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { JamRecord, PeakData } from "@/lib/types";
import { getPeaks } from "@/lib/tauri";
import { formatDuration } from "@/lib/format";

interface JamCardProps {
  jam: JamRecord;
  onClick: () => void;
}

function MiniWaveform({ peaks }: { peaks: PeakData }) {
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
    ctx.fillStyle = "#E8863A";

    const peakCount = peaks.peaks.length;
    if (peakCount === 0) return;

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
  }, [peaks]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="h-10 w-full rounded-lg"
      style={{ background: "#1D2129" }}
    />
  );
}

function WaveformSkeleton() {
  return (
    <div
      className="h-10 w-full animate-pulse rounded-lg"
      style={{ background: "#1D2129" }}
    />
  );
}

export function JamCard({ jam, onClick }: JamCardProps) {
  const { data: peaks, isLoading } = useQuery<PeakData>({
    queryKey: ["peaks", jam.id],
    queryFn: () => getPeaks(jam.id),
    enabled: jam.peaksGenerated,
    staleTime: Infinity,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-xl p-4 text-left transition-colors hover:bg-[#272C36] focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#151921]"
      style={{ background: "#1D2129" }}
    >
      {/* Mini waveform */}
      {isLoading || !peaks ? <WaveformSkeleton /> : <MiniWaveform peaks={peaks} />}

      {/* Info row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          {jam.originalFilename || jam.filename}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDuration(jam.durationSeconds)}
        </span>
        <span
          className="shrink-0 rounded-xl px-2 py-0.5 text-xs uppercase text-muted-foreground"
          style={{ background: "#272C36" }}
        >
          {jam.format}
        </span>
      </div>
    </button>
  );
}
