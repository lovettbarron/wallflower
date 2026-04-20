"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import type { PeakData, BookmarkRecord, BookmarkColor, SectionRecord, LoopRecord } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";

interface WaveformDetailProps {
  audioUrl: string;
  peaks: PeakData;
  onSeek: (time: number) => void;
  bookmarks?: BookmarkRecord[];
  sections?: SectionRecord[];
  loops?: LoopRecord[];
  onBookmarkDragEnd?: (start: number, end: number) => void;
  onBookmarkUpdate?: (id: string, start: number, end: number) => void;
  onBookmarkSelect?: (id: string) => void;
  onBookmarkEdit?: (id: string) => void;
}

export function WaveformDetail({
  audioUrl,
  peaks,
  onSeek,
  bookmarks = [],
  sections = [],
  loops = [],
  onBookmarkDragEnd,
  onBookmarkUpdate,
  onBookmarkSelect,
  onBookmarkEdit,
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const bookmarksRef = useRef<BookmarkRecord[]>(bookmarks);
  bookmarksRef.current = bookmarks;

  const flatPeaks = useMemo(
    () => [peaks.peaks.map((p) => p[0])],
    [peaks],
  );

  const regionsPlugin = useMemo(() => {
    const plugin = RegionsPlugin.create();
    regionsRef.current = plugin;
    return plugin;
  }, []);

  const plugins = useMemo(() => [regionsPlugin], [regionsPlugin]);

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    peaks: flatPeaks,
    duration: peaks.duration,
    waveColor: "#E8863A",
    progressColor: "#B55E20",
    cursorColor: "#E8863A",
    cursorWidth: 2,
    height: 200,
    normalize: true,
    minPxPerSec: 1,
    interact: true,
    plugins,
  });

  useEffect(() => {
    if (!isReady || !regionsRef.current) return;

    const disableDragSelection = regionsRef.current.enableDragSelection({
      color: "rgba(232, 134, 58, 0.15)",
    });

    return disableDragSelection;
  }, [isReady]);

  // Handle seek interaction
  useEffect(() => {
    if (!wavesurfer) return;

    const handleInteraction = (time: number) => {
      if (!seekingRef.current) {
        seekingRef.current = true;
        onSeek(time);
        requestAnimationFrame(() => {
          seekingRef.current = false;
        });
      }
    };

    wavesurfer.on("interaction", handleInteraction);

    return () => {
      wavesurfer.un("interaction", handleInteraction);
    };
  }, [wavesurfer, onSeek]);

  // Snap helper: find nearest section/loop boundary within threshold
  const snapToNearestBoundary = useCallback(
    (time: number, altKeyHeld: boolean): number => {
      if (altKeyHeld) return time;

      // Calculate snap threshold: 20px in seconds
      const container = containerRef.current;
      if (!container || peaks.duration <= 0) return time;
      const pixelsPerSecond = container.clientWidth / peaks.duration;
      const snapThreshold = 20 / pixelsPerSecond;

      let nearest = time;
      let minDist = snapThreshold;

      // Check section boundaries
      for (const section of sections) {
        const distStart = Math.abs(section.startSeconds - time);
        if (distStart < minDist) {
          minDist = distStart;
          nearest = section.startSeconds;
        }
        const distEnd = Math.abs(section.endSeconds - time);
        if (distEnd < minDist) {
          minDist = distEnd;
          nearest = section.endSeconds;
        }
      }

      // Check loop boundaries
      for (const loop of loops) {
        const distStart = Math.abs(loop.startSeconds - time);
        if (distStart < minDist) {
          minDist = distStart;
          nearest = loop.startSeconds;
        }
        const distEnd = Math.abs(loop.endSeconds - time);
        if (distEnd < minDist) {
          minDist = distEnd;
          nearest = loop.endSeconds;
        }
      }

      return nearest;
    },
    [sections, loops, peaks.duration],
  );

  // Handle region events (drag-create, update, click, dblclick)
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;

    const handleRegionCreated = (region: { id: string; start: number; end: number; remove: () => void }) => {
      // Only handle user-dragged regions (not bookmark synced ones)
      if (region.id.startsWith("bookmark-")) return;

      const start = snapToNearestBoundary(region.start, false);
      const end = snapToNearestBoundary(region.end, false);

      // Remove the temp drag region
      region.remove();

      if (onBookmarkDragEnd && Math.abs(end - start) > 0.1) {
        onBookmarkDragEnd(Math.min(start, end), Math.max(start, end));
      }
    };

    const handleRegionUpdated = (region: { id: string; start: number; end: number }) => {
      if (!region.id.startsWith("bookmark-")) return;
      const bookmarkId = region.id.replace("bookmark-", "");
      const start = snapToNearestBoundary(region.start, false);
      const end = snapToNearestBoundary(region.end, false);
      onBookmarkUpdate?.(bookmarkId, Math.min(start, end), Math.max(start, end));
    };

    const handleRegionClicked = (region: { id: string }, e: MouseEvent) => {
      e.stopPropagation();
      if (!region.id.startsWith("bookmark-")) return;
      const bookmarkId = region.id.replace("bookmark-", "");
      onBookmarkSelect?.(bookmarkId);
    };

    const handleRegionDblClicked = (region: { id: string }, e: MouseEvent) => {
      e.stopPropagation();
      if (!region.id.startsWith("bookmark-")) return;
      const bookmarkId = region.id.replace("bookmark-", "");
      onBookmarkEdit?.(bookmarkId);
    };

    regions.on("region-created", handleRegionCreated);
    regions.on("region-updated", handleRegionUpdated);
    regions.on("region-clicked", handleRegionClicked);
    regions.on("region-double-clicked", handleRegionDblClicked);

    return () => {
      regions.un("region-created", handleRegionCreated);
      regions.un("region-updated", handleRegionUpdated);
      regions.un("region-clicked", handleRegionClicked);
      regions.un("region-double-clicked", handleRegionDblClicked);
    };
  }, [snapToNearestBoundary, onBookmarkDragEnd, onBookmarkUpdate, onBookmarkSelect, onBookmarkEdit]);

  // Sync bookmarks to regions
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady) return;

    // Remove old bookmark regions
    const existing = regions.getRegions();
    for (const region of existing) {
      if (region.id.startsWith("bookmark-")) {
        region.remove();
      }
    }

    // Add new bookmark regions
    for (const bookmark of bookmarks) {
      const colorKey = bookmark.color as BookmarkColor;
      const colorInfo = BOOKMARK_COLORS[colorKey] || BOOKMARK_COLORS.coral;
      regions.addRegion({
        id: `bookmark-${bookmark.id}`,
        start: bookmark.startSeconds,
        end: bookmark.endSeconds,
        color: colorInfo.fill,
        drag: true,
        resize: true,
      });
    }
  }, [bookmarks, isReady]);

  return (
    <div className="relative w-full">
      {!isReady && (
        <div
          className="h-[200px] w-full animate-pulse rounded-lg"
          style={{ background: "#1D2129" }}
        />
      )}
      <div
        ref={containerRef}
        className="w-full rounded-lg"
        style={{
          background: "#1D2129",
          display: isReady ? "block" : "none",
        }}
      />
    </div>
  );
}
