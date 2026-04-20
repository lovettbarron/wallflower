"use client";

import { useCallback, useEffect, useRef } from "react";
import { X, Play, Pause } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StemRow } from "./StemRow";
import { SeparationProgress } from "./SeparationProgress";
import { useSeparationStore } from "@/lib/stores/separation";
import { STEM_COLORS } from "@/lib/types";
import type { BookmarkRecord } from "@/lib/types";
import { toast } from "sonner";

interface StemMixerProps {
  open: boolean;
  onClose: () => void;
  bookmark: BookmarkRecord | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function StemMixer({ open, onClose, bookmark }: StemMixerProps) {
  const stems = useSeparationStore((s) => s.stems);
  const isPlaying = useSeparationStore((s) => s.isPlaying);
  const currentTime = useSeparationStore((s) => s.currentTime);
  const separating = useSeparationStore((s) => s.separating);
  const progress = useSeparationStore((s) => s.progress);
  const mixerBookmark = useSeparationStore((s) => s.mixerBookmark);
  const toggleSolo = useSeparationStore((s) => s.toggleSolo);
  const toggleMute = useSeparationStore((s) => s.toggleMute);
  const setPlaying = useSeparationStore((s) => s.setPlaying);
  const setStemBuffer = useSeparationStore((s) => s.setStemBuffer);
  const closeMixer = useSeparationStore((s) => s.closeMixer);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // Determine total duration from first loaded stem buffer
  const totalDuration = stems.find((s) => s.audioBuffer)?.audioBuffer?.duration ?? 0;

  // Load audio buffers when mixer opens or stems change
  useEffect(() => {
    if (!open || stems.length === 0) return;

    let cancelled = false;
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;

    stems.forEach(async (stem) => {
      if (stem.audioBuffer) return; // Already loaded
      try {
        // Fetch stem audio from Rust backend
        const audioUrl = `http://localhost:23516/api/audio/${encodeURIComponent(stem.filePath.split("/").pop() || "")}`;
        const response = await fetch(audioUrl);
        if (cancelled) return;
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        setStemBuffer(stem.name, decoded);
      } catch (err) {
        console.error(`Failed to load stem ${stem.name}:`, err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, stems.length, stems, setStemBuffer]);

  // Update gain nodes when solo/mute state changes
  useEffect(() => {
    const anySoloed = stems.some((s) => s.soloed);
    stems.forEach((stem) => {
      const gain = gainNodesRef.current.get(stem.name);
      if (!gain) return;
      const shouldPlay = anySoloed ? stem.soloed : !stem.muted;
      gain.gain.value = shouldPlay ? 1 : 0;
    });
  }, [stems]);

  // Time tracking via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const tick = () => {
      const elapsed = ctx.currentTime - startTimeRef.current;
      const wrapped = totalDuration > 0 ? elapsed % totalDuration : elapsed;
      useSeparationStore.getState().setCurrentTime(wrapped);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, totalDuration]);

  const stopAllSources = useCallback(() => {
    sourceNodesRef.current.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Already stopped
      }
    });
    sourceNodesRef.current.clear();
  }, []);

  const startPlayback = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    stopAllSources();

    const anySoloed = stems.some((s) => s.soloed);
    startTimeRef.current = ctx.currentTime;

    stems.forEach((stem) => {
      if (!stem.audioBuffer) return;

      const source = ctx.createBufferSource();
      source.buffer = stem.audioBuffer;
      source.loop = true;

      const gain = ctx.createGain();
      const shouldPlay = anySoloed ? stem.soloed : !stem.muted;
      gain.gain.value = shouldPlay ? 1 : 0;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      sourceNodesRef.current.set(stem.name, source);
      gainNodesRef.current.set(stem.name, gain);
    });

    setPlaying(true);
  }, [stems, stopAllSources, setPlaying]);

  const pausePlayback = useCallback(() => {
    stopAllSources();
    gainNodesRef.current.clear();
    setPlaying(false);
  }, [stopAllSources, setPlaying]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, pausePlayback, startPlayback]);

  const handleExportAll = useCallback(async () => {
    try {
      const path = await useSeparationStore.getState().exportAllStems();
      toast.success(`Exported ${stems.length} stems to ${path}`, {
        action: {
          label: "Show in Finder",
          onClick: () => {
            // Finder reveal would use Tauri shell open
          },
        },
      });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [stems.length]);

  const handleExportSelected = useCallback(async () => {
    try {
      const path = await useSeparationStore.getState().exportSelectedStems();
      const anySoloed = stems.some((s) => s.soloed);
      const count = stems.filter((s) => (anySoloed ? s.soloed : !s.muted)).length;
      toast.success(`Exported ${count} stems to ${path}`, {
        action: {
          label: "Show in Finder",
          onClick: () => {
            // Finder reveal would use Tauri shell open
          },
        },
      });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [stems]);

  const handleClose = useCallback(() => {
    pausePlayback();
    closeMixer();
    onClose();
  }, [pausePlayback, closeMixer, onClose]);

  const handleCancelSeparation = useCallback(async () => {
    try {
      await useSeparationStore.getState().cancelSeparation();
    } catch (err) {
      toast.error("Failed to cancel separation");
    }
    handleClose();
  }, [handleClose]);

  const handleRetry = useCallback(async () => {
    if (!mixerBookmark) return;
    try {
      await useSeparationStore.getState().startSeparation(mixerBookmark);
    } catch (err) {
      toast.error("Separation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [mixerBookmark]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllSources();
      cancelAnimationFrame(rafRef.current);
    };
  }, [stopAllSources]);

  const showProgress = separating && progress?.status !== "completed";
  const anySoloed = stems.some((s) => s.soloed);
  const hasSelectedStems = stems.some((s) => (anySoloed ? s.soloed : !s.muted));

  const displayBookmark = bookmark ?? mixerBookmark;

  return (
    <Sheet open={open} onOpenChange={(openState) => { if (!openState) handleClose(); }}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[50vh]">
        {showProgress ? (
          <SeparationProgress
            bookmarkName={displayBookmark?.name ?? ""}
            progress={progress}
            onCancel={handleCancelSeparation}
            onRetry={handleRetry}
          />
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-semibold text-foreground">
                Stems: {displayBookmark?.name ?? ""}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                title="Close stem mixer"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Stem rows */}
            <div className="flex flex-col divide-y divide-border/50">
              {stems.map((stem) => (
                <StemRow
                  key={stem.name}
                  name={stem.name}
                  color={STEM_COLORS[stem.name] ?? "#888"}
                  soloed={stem.soloed}
                  muted={stem.muted}
                  onSolo={() => toggleSolo(stem.name)}
                  onMute={() => toggleMute(stem.name)}
                  audioBuffer={stem.audioBuffer}
                  anySoloed={anySoloed}
                />
              ))}
            </div>

            {/* Controls bar */}
            <div className="flex h-9 items-center gap-3 border-t border-border px-4">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePlayPause}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>

              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>

              <div className="flex-grow" />

              <Button
                variant="ghost"
                size="sm"
                className="text-[#E8863A] hover:text-[#E8863A]/80"
                onClick={handleExportSelected}
                disabled={!hasSelectedStems}
              >
                Export Selected
              </Button>

              <Button
                size="sm"
                className="bg-[#E8863A] text-white hover:bg-[#E8863A]/90"
                onClick={handleExportAll}
              >
                Export All
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
