"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { getJamWithMetadata, getPeaks, generatePeaksForJam, updateJamMetadata, prioritizeAnalysis } from "@/lib/tauri";
import type { JamDetail as JamDetailType, PeakData } from "@/lib/types";
import { WaveformOverview } from "@/components/waveform/WaveformOverview";
import { WaveformDetail } from "@/components/waveform/WaveformDetail";
import { MetadataEditor } from "@/components/metadata/MetadataEditor";
import { useTransportStore } from "@/lib/stores/transport";
import { useRecordingStore } from "@/lib/stores/recording";
import { AnalysisSummary } from "@/components/analysis/AnalysisSummary";

interface JamDetailProps {
  jamId: string;
  onBack: () => void;
}

export function JamDetail({ jamId, onBack }: JamDetailProps) {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const recordingJamId = useRecordingStore((s) => s.recordingJamId);
  const [isDragOver, setIsDragOver] = useState(false);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentJamId = useTransportStore((s) => s.currentJamId);
  const loadJam = useTransportStore((s) => s.loadJam);
  const setCurrentTime = useTransportStore((s) => s.setCurrentTime);
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const setPlaying = useTransportStore((s) => s.setPlaying);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    async function setupDragOverlay() {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const fn = await getCurrentWebview().onDragDropEvent((event) => {
          if (!mounted) return;
          if (event.payload.type === "over") setIsDragOver(true);
          if (event.payload.type === "leave" || event.payload.type === "drop") setIsDragOver(false);
        });
        unlisten = fn;
      } catch {
        // Not running in Tauri
      }
    }
    setupDragOverlay();
    return () => { mounted = false; unlisten?.(); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      setPlaying(!isPlaying);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setPlaying]);

  const { data: jam, isLoading: jamLoading, refetch: refetchJam } = useQuery<JamDetailType | null>({
    queryKey: ["jam", jamId],
    queryFn: () => getJamWithMetadata(jamId),
    enabled: !!jamId,
  });

  const { data: peaks, isLoading: peaksLoading } = useQuery<PeakData>({
    queryKey: ["peaks", jamId],
    queryFn: async () => {
      if (jam?.peaksGenerated) {
        return getPeaks(jamId);
      }
      return generatePeaksForJam(jamId);
    },
    enabled: !!jamId && !!jam,
  });

  useEffect(() => {
    if (jam) setTitle(jam.originalFilename || jam.filename);
  }, [jam]);

  // Prioritize analysis for the currently-viewed jam (D-16)
  useEffect(() => {
    prioritizeAnalysis(jamId).catch(() => {
      // Silently ignore -- analysis may not be available
    });
  }, [jamId]);

  const saveTitle = useCallback(
    async (newTitle: string) => {
      if (!jam || newTitle === (jam.originalFilename || jam.filename)) return;
      await updateJamMetadata(jam.id, newTitle, null, null, null);
      queryClient.invalidateQueries({ queryKey: ["jam", jamId] });
      queryClient.invalidateQueries({ queryKey: ["jams"] });
    },
    [jam, jamId, queryClient],
  );

  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
      titleSaveTimeout.current = setTimeout(() => saveTitle(val), 600);
    },
    [saveTitle],
  );

  useEffect(() => {
    if (!jam || currentJamId === jam.id) return;
    const audioUrl = `http://localhost:23516/api/audio/${encodeURIComponent(jam.filename)}`;
    loadJam(
      jam.id,
      jam.originalFilename || jam.filename,
      audioUrl,
      jam.durationSeconds || 0,
    );
  }, [jam, currentJamId, loadJam]);

  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
    },
    [setCurrentTime],
  );

  if (jamLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (!jam) {
    return <p className="text-sm text-muted-foreground">Jam not found.</p>;
  }

  // Guard: if this jam is being actively recorded, show a note
  if (isRecording && recordingJamId === jam.id) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="recording-dot mb-4 h-3 w-3 rounded-full" style={{ backgroundColor: "#E53E3E" }} />
        <p className="text-sm text-muted-foreground">
          This jam is currently being recorded. Use the recording view to edit metadata.
        </p>
      </div>
    );
  }

  const audioUrl = `http://localhost:23516/api/audio/${encodeURIComponent(jam.filename)}`;

  return (
    <div className="relative">
      {/* Full-page drag overlay */}
      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#E8863A] bg-[#1D2129]/90 px-12 py-10">
            <ImagePlus className="size-12 text-[#E8863A]" strokeWidth={1.5} />
            <span className="text-base font-medium text-[#E8863A]">
              Drop to attach photo
            </span>
            <span className="text-xs text-muted-foreground">
              to {jam?.originalFilename || jam?.filename || "this jam"}
            </span>
          </div>
        </div>
      )}

      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 rounded text-sm transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
        style={{ color: "#E8863A" }}
      >
        <ArrowLeft size={16} />
        Library
      </button>

      {/* Jam title (editable) */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        onBlur={() => saveTitle(title)}
        className="mb-6 w-full bg-transparent text-xl font-semibold text-foreground outline-none border-b border-transparent focus:border-[#E8863A] transition-colors"
        spellCheck={false}
      />

      {/* Waveforms */}
      {peaksLoading && (
        <div>
          <div
            className="mb-6 h-12 w-full animate-pulse rounded-lg"
            style={{ background: "#1D2129" }}
          />
          <div
            className="h-[200px] w-full animate-pulse rounded-lg"
            style={{ background: "#1D2129" }}
          />
        </div>
      )}

      {peaks && (
        <>
          {/* Overview waveform */}
          <WaveformOverview
            peaks={peaks}
            onSeek={handleSeek}
          />

          <div className="h-6" />

          {/* Detail waveform */}
          <WaveformDetail
            audioUrl={audioUrl}
            peaks={peaks}
            onSeek={handleSeek}
          />
        </>
      )}

      {!peaks && !peaksLoading && (
        <div
          className="flex h-[200px] w-full items-center justify-center rounded-lg text-sm text-muted-foreground"
          style={{ background: "#1D2129" }}
        >
          Waveform peaks not yet generated for this recording.
        </div>
      )}

      {/* Analysis summary row */}
      <AnalysisSummary jamId={jam.id} />

      <div className="h-6" />

      {/* Metadata editor */}
      {jam && (
        <MetadataEditor jam={jam} onUpdate={() => refetchJam()} />
      )}
    </div>
  );
}
