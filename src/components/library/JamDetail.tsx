"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { getJamWithMetadata, getPeaks, generatePeaksForJam, updateJamMetadata, prioritizeAnalysis, exportAudio, revealInFinder, getAnalysisResults, deleteJam } from "@/lib/tauri";
import type { JamDetail as JamDetailType, PeakData, BookmarkColor, SeparationProgressEvent, AnalysisResults } from "@/lib/types";
import { WaveformOverview } from "@/components/waveform/WaveformOverview";
import { WaveformDetail } from "@/components/waveform/WaveformDetail";
import { MetadataEditor } from "@/components/metadata/MetadataEditor";
import { BookmarkList } from "@/components/bookmarks/BookmarkList";
import { BookmarkPopover } from "@/components/bookmarks/BookmarkPopover";
import { StemMixer } from "@/components/stems/StemMixer";
import { useTransportStore } from "@/lib/stores/transport";
import { useRecordingStore } from "@/lib/stores/recording";
import { useBookmarkStore } from "@/lib/stores/bookmarks";
import { useSeparationStore } from "@/lib/stores/separation";
import { AnalysisSummary } from "@/components/analysis/AnalysisSummary";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface JamDetailProps {
  jamId: string;
  onBack: () => void;
}

export function JamDetail({ jamId, onBack }: JamDetailProps) {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const recordingJamId = useRecordingStore((s) => s.recordingJamId);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentJamId = useTransportStore((s) => s.currentJamId);
  const loadJam = useTransportStore((s) => s.loadJam);
  const setCurrentTime = useTransportStore((s) => s.setCurrentTime);
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const setPlaying = useTransportStore((s) => s.setPlaying);
  const setActiveLoop = useTransportStore((s) => s.setActiveLoop);

  // Bookmark state
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const loadBookmarks = useBookmarkStore((s) => s.loadBookmarks);
  const addBookmark = useBookmarkStore((s) => s.addBookmark);
  const editBookmark = useBookmarkStore((s) => s.editBookmark);
  const selectBookmark = useBookmarkStore((s) => s.selectBookmark);
  const getNextColor = useBookmarkStore((s) => s.getNextColor);
  const getNextName = useBookmarkStore((s) => s.getNextName);

  // Separation state
  const mixerOpen = useSeparationStore((s) => s.mixerOpen);
  const separating = useSeparationStore((s) => s.separating);

  const handleDeleteJam = useCallback(async () => {
    try {
      await deleteJam(jamId);
      queryClient.invalidateQueries({ queryKey: ["jams"] });
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      toast.success("Jam deleted");
      onBack();
    } catch (err) {
      toast.error("Failed to delete jam", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
    setShowDeleteDialog(false);
  }, [jamId, queryClient, onBack]);

  // Listen for separation-progress events from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    async function setupSeparationListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const fn = await listen<SeparationProgressEvent>("separation-progress", (event) => {
          if (!mounted) return;
          useSeparationStore.getState().updateProgress(event.payload);
        });
        unlisten = fn;
      } catch {
        // Not running in Tauri
      }
    }
    setupSeparationListener();
    return () => { mounted = false; unlisten?.(); };
  }, []);

  // Bookmark creation popover state
  const [showBookmarkPopover, setShowBookmarkPopover] = useState(false);
  const [pendingBookmarkRange, setPendingBookmarkRange] = useState<{ start: number; end: number } | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);

  // Load bookmarks when jamId changes
  useEffect(() => {
    if (jamId) {
      loadBookmarks(jamId);
    }
  }, [jamId, loadBookmarks]);

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

  const { data: analysis } = useQuery<AnalysisResults>({
    queryKey: ["jam", jamId, "analysis"],
    queryFn: () => getAnalysisResults(jamId),
    enabled: !!jamId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (jam) setTitle(jam.originalFilename || jam.filename);
  }, [jam]);

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

  // Bookmark handlers
  const handleBookmarkDragEnd = useCallback(
    (start: number, end: number) => {
      setPendingBookmarkRange({ start, end });
      setShowBookmarkPopover(true);
      setCurrentTime(start);
      setActiveLoop({ startSeconds: start, endSeconds: end, label: "Selection" });
      setPlaying(true);
    },
    [setCurrentTime, setActiveLoop, setPlaying],
  );

  const handleBookmarkSave = useCallback(
    async (name: string, color: BookmarkColor, notes: string) => {
      if (!pendingBookmarkRange || !jamId) return;
      await addBookmark({
        jamId,
        name,
        startSeconds: pendingBookmarkRange.start,
        endSeconds: pendingBookmarkRange.end,
        color,
        notes: notes || null,
      });
      setShowBookmarkPopover(false);
      setPendingBookmarkRange(null);
    },
    [pendingBookmarkRange, jamId, addBookmark],
  );

  const handleBookmarkUpdate = useCallback(
    async (id: string, start: number, end: number) => {
      await editBookmark(id, { startSeconds: start, endSeconds: end });
    },
    [editBookmark],
  );

  const handleBookmarkSelect = useCallback(
    (id: string) => {
      selectBookmark(id);
    },
    [selectBookmark],
  );

  const handleBookmarkEdit = useCallback(
    (id: string) => {
      setEditingBookmarkId(id);
    },
    [],
  );

  const handleSectionClick = useCallback(
    (section: { startSeconds: number; endSeconds: number; label: string }) => {
      setCurrentTime(section.startSeconds);
      setActiveLoop({
        startSeconds: section.startSeconds,
        endSeconds: section.endSeconds,
        label: section.label,
      });
      setPlaying(true);
    },
    [setCurrentTime, setActiveLoop, setPlaying],
  );

  const handleLoopClick = useCallback(
    (loop: { startSeconds: number; endSeconds: number; label: string }) => {
      setCurrentTime(loop.startSeconds);
      setActiveLoop({
        startSeconds: loop.startSeconds,
        endSeconds: loop.endSeconds,
        label: loop.label,
      });
      setPlaying(true);
    },
    [setCurrentTime, setActiveLoop, setPlaying],
  );

  const handleBookmarkClick = useCallback(
    (bookmark: { startSeconds: number; endSeconds: number; name?: string }) => {
      setCurrentTime(bookmark.startSeconds);
      setActiveLoop({
        startSeconds: bookmark.startSeconds,
        endSeconds: bookmark.endSeconds,
        label: bookmark.name || "Bookmark",
      });
      setPlaying(true);
    },
    [setCurrentTime, setActiveLoop, setPlaying],
  );

  const handleExportAudio = useCallback(
    async (bookmarkId: string) => {
      try {
        const path = await exportAudio(bookmarkId);
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
    },
    [],
  );

  const handleExportStems = useCallback(
    async (bookmarkId: string) => {
      const bookmark = bookmarks.find((b) => b.id === bookmarkId);
      if (!bookmark) return;
      try {
        await useSeparationStore.getState().startSeparation(bookmark);
      } catch (err) {
        toast.error("Stem separation failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [bookmarks],
  );

  // Find editing bookmark for popover
  const editingBookmark = editingBookmarkId
    ? bookmarks.find((b) => b.id === editingBookmarkId)
    : null;

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
    <div
      className="relative"
      aria-label={`Jam detail: ${jam.originalFilename || jam.filename}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onBack();
        }
      }}
    >
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

      {/* Back navigation + delete */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded text-sm transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
          style={{ color: "#E8863A" }}
        >
          <ArrowLeft size={16} />
          Library
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Delete jam"
        >
          <Trash2 size={16} />
        </button>
      </div>

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
            bookmarks={bookmarks}
          />

          <div className="h-6" />

          {/* Detail waveform */}
          <WaveformDetail
            audioUrl={audioUrl}
            peaks={peaks}
            onSeek={handleSeek}
            bookmarks={bookmarks}
            sections={analysis?.sections ?? []}
            loops={analysis?.loops ?? []}
            onBookmarkDragEnd={handleBookmarkDragEnd}
            onBookmarkUpdate={handleBookmarkUpdate}
            onBookmarkSelect={handleBookmarkSelect}
            onBookmarkEdit={handleBookmarkEdit}
            onSectionClick={handleSectionClick}
            onLoopClick={handleLoopClick}
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

      <div className="h-6" />

      {/* Bookmark list */}
      <BookmarkList
        jamId={jamId}
        onBookmarkClick={handleBookmarkClick}
        onExportAudio={handleExportAudio}
        onExportStems={handleExportStems}
      />

      <div className="h-6" />

      {/* Analysis summary */}
      <AnalysisSummary jamId={jam.id} />

      <div className="h-6" />

      {/* Metadata editor */}
      {jam && (
        <MetadataEditor jam={jam} onUpdate={() => refetchJam()} />
      )}

      {/* Bookmark creation popover */}
      <BookmarkPopover
        open={showBookmarkPopover}
        onClose={() => {
          setShowBookmarkPopover(false);
          setPendingBookmarkRange(null);
          setActiveLoop(null);
          setPlaying(false);
        }}
        onSave={handleBookmarkSave}
        initialName={getNextName()}
        initialColor={getNextColor()}
        initialNotes=""
        mode="create"
      />

      {/* Bookmark edit popover */}
      {editingBookmark && (
        <BookmarkPopover
          open={!!editingBookmark}
          onClose={() => setEditingBookmarkId(null)}
          onSave={async (name, color, notes) => {
            await editBookmark(editingBookmarkId!, { name, color, notes });
            setEditingBookmarkId(null);
          }}
          initialName={editingBookmark.name}
          initialColor={editingBookmark.color as BookmarkColor}
          initialNotes={editingBookmark.notes || ""}
          mode="edit"
        />
      )}

      {/* Stem Mixer */}
      <StemMixer
        open={mixerOpen || separating}
        onClose={() => useSeparationStore.getState().closeMixer()}
        bookmark={null}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete {jam?.originalFilename || jam?.filename}?</DialogTitle>
            <DialogDescription>
              This will permanently remove the recording, all bookmarks, analysis data, and associated files. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Keep Recording
            </Button>
            <Button variant="destructive" onClick={handleDeleteJam}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
