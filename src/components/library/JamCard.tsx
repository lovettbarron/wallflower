"use client";

import { useRef, useEffect, useCallback, forwardRef, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import type { JamRecord, PeakData } from "@/lib/types";
import { getPeaks, getAnalysisResults } from "@/lib/tauri";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnalysisBadge } from "@/components/analysis/AnalysisBadge";
import { AnalysisStatus } from "@/components/analysis/AnalysisStatus";

interface JamCardProps {
  jam: JamRecord;
  onClick: () => void;
  isDropTarget?: boolean;
  isSelected?: boolean;
  tabIndex?: number;
  onKeyDown?: (e: KeyboardEvent) => void;
  onFocus?: () => void;
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

export const JamCard = forwardRef<HTMLButtonElement, JamCardProps>(function JamCard(
  { jam, onClick, isDropTarget, isSelected, tabIndex, onKeyDown, onFocus },
  ref,
) {
  const { data: peaks, isLoading } = useQuery<PeakData>({
    queryKey: ["peaks", jam.id],
    queryFn: () => getPeaks(jam.id),
    enabled: jam.peaksGenerated,
    staleTime: Infinity,
  });

  const { data: analysis } = useQuery({
    queryKey: ["jam", jam.id, "analysis"],
    queryFn: () => getAnalysisResults(jam.id),
    staleTime: 60000,
  });

  const jamName = jam.originalFilename || jam.filename;
  const durationText = formatDuration(jam.durationSeconds);

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isSelected ?? false}
      aria-label={`${jamName}, ${durationText}`}
      data-jam-id={jam.id}
      data-jam-name={jamName}
      onClick={onClick}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className={cn(
        "relative w-full cursor-pointer rounded-xl p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#151921]",
        isDropTarget
          ? "ring-2 ring-[#E8863A] bg-[#E8863A]/10"
          : "hover:bg-[#272C36]",
      )}
      style={{ background: isDropTarget ? undefined : "#1D2129" }}
    >
      {/* Drop target indicator */}
      {isDropTarget && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 rounded-lg bg-[#1D2129]/90 px-4 py-2">
            <ImagePlus className="size-4 text-[#E8863A]" strokeWidth={1.5} />
            <span className="text-sm font-medium text-[#E8863A]">
              Drop to attach photo
            </span>
          </div>
        </div>
      )}

      {/* Mini waveform */}
      {isLoading || !peaks ? <WaveformSkeleton /> : <MiniWaveform peaks={peaks} />}

      {/* Info row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          {jam.originalFilename || jam.filename}
        </span>

        {/* Analysis badges or status */}
        {analysis?.status?.status === "analyzing" ? (
          <AnalysisStatus
            currentStep={analysis.status.currentStep}
            completedSteps={[]}
            variant="card"
          />
        ) : (
          <div className="flex items-center gap-1">
            <AnalysisBadge
              label={
                analysis?.key
                  ? `${analysis.key.keyName}${analysis.key.scale === "minor" ? "m" : ""}`
                  : "--"
              }
              pending={!analysis?.key}
            />
            <AnalysisBadge
              label={
                analysis?.tempo
                  ? `${Math.round(analysis.tempo.bpm)}`
                  : "--"
              }
              pending={!analysis?.tempo}
              className="tabular-nums"
            />
          </div>
        )}

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
});
