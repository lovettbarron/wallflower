"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { WaveformDetail } from "@/components/waveform/WaveformDetail";
import { TypeBadge } from "./TypeBadge";
import { useTransportStore } from "@/lib/stores/transport";
import {
  getPeaks,
  exportAudio,
  exportSampleAudio,
  separateStems,
  separateSampleStems,
  revealInFinder,
} from "@/lib/tauri";
import { toast } from "sonner";
import type { SampleRecord } from "@/lib/types";

interface SamplePreviewPanelProps {
  sample: SampleRecord | null;
  onNavigateToJam: (jamId: string) => void;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SamplePreviewPanel({
  sample,
  onNavigateToJam,
  onClose,
}: SamplePreviewPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!sample) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sample, onClose]);

  // Load peaks for the source jam
  const { data: peaks, isLoading: peaksLoading } = useQuery({
    queryKey: ["peaks", sample?.jamId],
    queryFn: () => getPeaks(sample!.jamId),
    enabled: !!sample,
  });

  const audioUrl = sample
    ? `http://localhost:23516/api/audio/${encodeURIComponent(sample.sourceJamName)}`
    : "";

  // Load jam into transport and set active loop when sample changes
  useEffect(() => {
    if (!sample) return;

    const url = `http://localhost:23516/api/audio/${encodeURIComponent(sample.sourceJamName)}`;
    useTransportStore.getState().loadJam(
      sample.jamId,
      sample.name,
      url,
      sample.durationSeconds,
    );
    useTransportStore.getState().setActiveLoop({
      startSeconds: sample.startSeconds,
      endSeconds: sample.endSeconds,
      label: sample.name,
    });
  }, [sample]);

  const handleSeek = useCallback(
    (time: number) => {
      useTransportStore.getState().setCurrentTime(time);
    },
    [],
  );

  // Export audio handler
  const handleExportAudio = useCallback(async () => {
    if (!sample) return;
    try {
      let path: string;
      if (sample.sampleType === "bookmark") {
        path = await exportAudio(sample.id);
      } else {
        path = await exportSampleAudio(
          sample.jamId,
          sample.startSeconds,
          sample.endSeconds,
          sample.name,
        );
      }
      toast.success(`Exported to ${path}`, {
        action: {
          label: "Show in Finder",
          onClick: () => {
            revealInFinder(path);
          },
        },
      });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [sample]);

  // Export stems handler
  const handleExportStems = useCallback(async () => {
    if (!sample) return;
    toast.info(`Separating stems for ${sample.name}...`);
    try {
      if (sample.sampleType === "bookmark") {
        await separateStems(sample.id);
      } else {
        await separateSampleStems(
          sample.jamId,
          sample.startSeconds,
          sample.endSeconds,
          sample.name,
        );
      }
      toast.success(`Stems ready for ${sample.name}`);
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [sample]);

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-label="Sample preview"
      className="flex-shrink-0 overflow-hidden transition-all duration-200 ease-out"
      style={{
        maxHeight: sample ? "220px" : "0px",
        borderTop: sample ? "1px solid hsl(220, 14%, 22%)" : "none",
        background: "#1D2129",
      }}
    >
      {sample && (
        <div className="flex h-[220px] flex-col">
          {/* Waveform area */}
          <div className="h-[120px] flex-shrink-0 overflow-hidden">
            {peaksLoading || !peaks ? (
              <div
                className="h-[120px] w-full animate-pulse rounded-lg"
                style={{ background: "#1D2129" }}
              />
            ) : (
              <WaveformDetail
                audioUrl={audioUrl}
                peaks={peaks}
                onSeek={handleSeek}
              />
            )}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {sample.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {sample.keyDisplay ?? "--"}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {sample.tempoBpm
                ? `${Math.round(sample.tempoBpm)} BPM`
                : "--"}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDuration(sample.durationSeconds)}
            </span>
            <TypeBadge type={sample.sampleType} />
          </div>

          {/* Action row */}
          <div className="flex items-center justify-end gap-3 px-4 py-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToJam(sample.jamId);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-[#E8863A] transition-colors hover:bg-muted/50 hover:text-[#E8863A]/80"
              aria-label={`Go to ${sample.sourceJamName}`}
            >
              Go to Jam
            </button>
            <button
              type="button"
              onClick={handleExportStems}
              className="rounded-md px-3 py-1.5 text-sm text-[#E8863A] transition-colors hover:bg-muted/50 hover:text-[#E8863A]/80"
              aria-label={`Export stems for ${sample.name}`}
            >
              Export Stems
            </button>
            <button
              type="button"
              onClick={handleExportAudio}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#E8863A]/90"
              style={{ backgroundColor: "#E8863A" }}
              aria-label={`Export audio for ${sample.name}`}
            >
              Export Audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
