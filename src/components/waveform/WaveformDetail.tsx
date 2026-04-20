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
  const regionsRef = useRef<RegionsPlugin | null>(null);

  const flatPeaks = useMemo(
    () => {
      if (peaks.channelPeaks && peaks.channelPeaks.length > 1) {
        return peaks.channelPeaks.map((ch) => ch.map((p) => p[0]));
      }
      return [peaks.peaks.map((p) => p[0])];
    },
    [peaks],
  );

  const regionsPlugin = useMemo(() => {
    const plugin = RegionsPlugin.create();
    regionsRef.current = plugin;
    return plugin;
  }, []);

  const plugins = useMemo(() => [regionsPlugin], [regionsPlugin]);

  const isStereo = peaks.channels > 1;

  const splitChannelsConfig = useMemo(
    () => isStereo ? [
      { waveColor: "#E8863A", progressColor: "#B55E20" },
      { waveColor: "#E8863A", progressColor: "#B55E20", overlay: true },
    ] : undefined,
    [isStereo],
  );

  const { isReady } = useWavesurfer({
    container: containerRef,
    peaks: flatPeaks,
    duration: peaks.duration,
    waveColor: "#E8863A",
    progressColor: "#B55E20",
    cursorColor: "#E8863A",
    cursorWidth: 2,
    height: isStereo ? 160 : 200,
    normalize: true,
    minPxPerSec: 1,
    interact: false,
    splitChannels: splitChannelsConfig,
    plugins,
  });

  // Snap helper: find nearest section/loop boundary within threshold
  const snapToNearestBoundary = useCallback(
    (time: number, altKeyHeld: boolean): number => {
      if (altKeyHeld) return time;

      const container = containerRef.current;
      if (!container || peaks.duration <= 0) return time;
      const pixelsPerSecond = container.clientWidth / peaks.duration;
      const snapThreshold = 20 / pixelsPerSecond;

      let nearest = time;
      let minDist = snapThreshold;

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

  // Drag-to-select bookmark creation + click-to-seek
  // Uses pointer events on the container (outside shadow DOM) to avoid
  // lifecycle conflicts with wavesurfer's internal enableDragSelection.
  const dragOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = dragOverlayRef.current;
    if (!isReady || !container || !overlay) return;

    const DRAG_THRESHOLD = 4;
    let startX = 0;
    let isDragging = false;

    const pxToTime = (px: number): number => {
      const rect = container.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (px - rect.left) / rect.width));
      return relX * peaks.duration;
    };

    const updateOverlay = (currentX: number) => {
      const rect = container.getBoundingClientRect();
      const left = Math.min(startX, currentX) - rect.left;
      const width = Math.abs(currentX - startX);
      overlay.style.left = `${left}px`;
      overlay.style.width = `${width}px`;
      overlay.style.display = "block";
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      overlay.style.display = "none";
      startX = e.clientX;
      isDragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (startX === 0) return;
      if (!isDragging && Math.abs(e.clientX - startX) > DRAG_THRESHOLD) {
        isDragging = true;
      }
      if (isDragging) {
        updateOverlay(e.clientX);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (startX === 0) return;

      if (isDragging) {
        // Keep overlay visible — it hides on next pointerdown
        const startTime = pxToTime(startX);
        const endTime = pxToTime(e.clientX);
        const t0 = Math.min(startTime, endTime);
        const t1 = Math.max(startTime, endTime);
        if (t1 - t0 > 0.1 && onBookmarkDragEnd) {
          const snappedStart = snapToNearestBoundary(t0, e.altKey);
          const snappedEnd = snapToNearestBoundary(t1, e.altKey);
          // Delay callback to next frame so pointer/click event cycle
          // completes before the popover mounts its outside-click handler
          requestAnimationFrame(() => {
            onBookmarkDragEnd(snappedStart, snappedEnd);
          });
        }
      } else {
        overlay.style.display = "none";
        onSeek(pxToTime(e.clientX));
      }

      startX = 0;
      isDragging = false;
    };

    container.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [isReady, peaks.duration, onSeek, onBookmarkDragEnd, snapToNearestBoundary]);

  // Handle region events (resize, click, dblclick on existing bookmark regions)
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;

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

    regions.on("region-updated", handleRegionUpdated);
    regions.on("region-clicked", handleRegionClicked);
    regions.on("region-double-clicked", handleRegionDblClicked);

    return () => {
      regions.un("region-updated", handleRegionUpdated);
      regions.un("region-clicked", handleRegionClicked);
      regions.un("region-double-clicked", handleRegionDblClicked);
    };
  }, [snapToNearestBoundary, onBookmarkUpdate, onBookmarkSelect, onBookmarkEdit]);

  // Sync bookmarks to regions
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady) return;

    try {
      const existing = regions.getRegions();
      for (const region of existing) {
        if (region.id.startsWith("bookmark-")) {
          region.remove();
        }
      }

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
    } catch {
      // Plugin not yet initialized by wavesurfer — will retry on next render
    }
  }, [bookmarks, isReady]);

  return (
    <div className="relative w-full">
      {!isReady && (
        <div
          className={`${isStereo ? "h-[160px]" : "h-[200px]"} w-full animate-pulse rounded-lg`}
          style={{ background: "#1D2129" }}
        />
      )}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg"
        style={{
          background: "#1D2129",
          display: isReady ? "block" : "none",
        }}
      >
        <div
          ref={dragOverlayRef}
          className="pointer-events-none absolute inset-y-0 z-10 rounded"
          style={{
            background: "rgba(232, 134, 58, 0.2)",
            border: "1px solid rgba(232, 134, 58, 0.5)",
            display: "none",
          }}
        />
      </div>
    </div>
  );
}
