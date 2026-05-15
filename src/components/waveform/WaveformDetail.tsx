"use client";

import { useRef, useEffect, useMemo, useCallback, useState, forwardRef, useImperativeHandle, type KeyboardEvent } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { useTransportStore } from "@/lib/stores/transport";
import { formatDuration } from "@/lib/format";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import type { PeakData, BookmarkRecord, BookmarkColor, SectionRecord, LoopRecord } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";
import { SectionMarkers } from "./SectionMarkers";
import { LoopBrackets } from "./LoopBrackets";

export interface WaveformDetailHandle {
  zoomToRange: (start: number, end: number) => void;
  zoomToRangeExact: (start: number, end: number) => void;
  resetZoom: () => void;
  scrollToTime: (time: number) => void;
  clearSelection: () => void;
}

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
  onSectionClick?: (section: SectionRecord) => void;
  onLoopClick?: (loop: LoopRecord) => void;
  onViewportChange?: (start: number, end: number) => void;
}

const MAX_PX_PER_SEC = 500;
const ZOOM_SENSITIVITY = 0.005;

export const WaveformDetail = forwardRef<WaveformDetailHandle, WaveformDetailProps>(function WaveformDetail({
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
  onSectionClick,
  onLoopClick,
  onViewportChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const overlayTransformRef = useRef<HTMLDivElement>(null);
  const pxPerSecRef = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [totalScrollWidth, setTotalScrollWidth] = useState(0);
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  // Track the drag selection as a time range so it survives zoom/scroll changes
  const selectionRangeRef = useRef<{ startTime: number; endTime: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      { waveColor: "#E8863A", progressColor: "#B55E20" },
    ] : undefined,
    [isStereo],
  );

  const { wavesurfer, isReady } = useWavesurfer({
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

  const getBasePxPerSec = useCallback(() => {
    if (peaks.duration <= 0 || containerWidth <= 0) return 1;
    return containerWidth / peaks.duration;
  }, [peaks.duration, containerWidth]);

  // Read viewport from wavesurfer's actual scroll container (not the wrapper).
  // wavesurfer.getScroll() = scrollContainer.scrollLeft
  // wavesurfer.getWidth()  = scrollContainer.clientWidth (visible area)
  // wrapper.clientWidth     = total waveform width (scrollWidth of the scroll container)
  const computeViewport = useCallback((): { start: number; end: number } => {
    if (!wavesurfer) return { start: 0, end: peaks.duration };
    const visibleWidth = wavesurfer.getWidth();
    const wrapperWidth = wavesurfer.getWrapper()?.clientWidth ?? visibleWidth;
    if (wrapperWidth <= visibleWidth) return { start: 0, end: peaks.duration };
    const scrollLeft = wavesurfer.getScroll();
    const start = (scrollLeft / wrapperWidth) * peaks.duration;
    const end = ((scrollLeft + visibleWidth) / wrapperWidth) * peaks.duration;
    return { start, end };
  }, [wavesurfer, peaks.duration]);

  const syncOverlayTransform = useCallback(() => {
    if (!wavesurfer || !overlayTransformRef.current) return;
    const scrollLeft = wavesurfer.getScroll();
    const wrapperWidth = wavesurfer.getWrapper()?.clientWidth ?? containerWidth;
    overlayTransformRef.current.style.width = `${wrapperWidth}px`;
    overlayTransformRef.current.style.transform = `translateX(-${scrollLeft}px)`;
    setTotalScrollWidth(wrapperWidth);
  }, [wavesurfer, containerWidth]);

  // Reposition the drag overlay from the stored time range
  const repositionSelectionOverlay = useCallback(() => {
    const overlay = dragOverlayRef.current;
    const container = containerRef.current;
    const range = selectionRangeRef.current;
    if (!overlay || !container || !range) return;
    const viewport = computeViewport();
    const visibleDuration = viewport.end - viewport.start;
    if (visibleDuration <= 0) return;
    const rect = container.getBoundingClientRect();
    const left = ((range.startTime - viewport.start) / visibleDuration) * rect.width;
    const right = ((range.endTime - viewport.start) / visibleDuration) * rect.width;
    if (right <= 0 || left >= rect.width) {
      overlay.style.display = "none";
      return;
    }
    overlay.style.display = "block";
    const clippedLeft = Math.max(0, left);
    const clippedRight = Math.min(rect.width, right);
    overlay.style.left = `${clippedLeft}px`;
    overlay.style.width = `${clippedRight - clippedLeft}px`;
  }, [computeViewport]);

  const reportViewport = useCallback(() => {
    const viewport = computeViewport();
    onViewportChange?.(viewport.start, viewport.end);
    const zoomed = viewport.end - viewport.start < peaks.duration * 0.99;
    setIsZoomed(zoomed);
    repositionSelectionOverlay();
  }, [computeViewport, onViewportChange, peaks.duration, repositionSelectionOverlay]);

  // After wavesurfer.zoom(), its reRender() adjusts scroll based on the playback
  // cursor — not the mouse. We override by listening for the 'zoom' event (which
  // fires synchronously after reRender finishes) and then forcing our target scroll.
  // A second pass via rAF catches any async scroll resets from the renderer.
  const zoomAndScroll = useCallback((newPxPerSec: number, targetScrollLeft: number) => {
    if (!wavesurfer) return;
    const applyScroll = () => {
      wavesurfer.setScroll(targetScrollLeft);
      syncOverlayTransform();
      reportViewport();
    };
    wavesurfer.once("zoom", applyScroll);
    wavesurfer.zoom(newPxPerSec);
    // rAF pass to override any async scroll resets from the renderer
    requestAnimationFrame(applyScroll);
  }, [wavesurfer, syncOverlayTransform, reportViewport]);

  // Zoom to a specific time range with padding
  const zoomToRange = useCallback((start: number, end: number) => {
    if (!wavesurfer || !containerRef.current) return;
    const padding = (end - start) * 0.1;
    const rangeStart = Math.max(0, start - padding);
    const rangeEnd = Math.min(peaks.duration, end + padding);
    const rangeDuration = rangeEnd - rangeStart;
    if (rangeDuration <= 0) return;

    const newPxPerSec = Math.min(MAX_PX_PER_SEC, containerWidth / rangeDuration);
    pxPerSecRef.current = newPxPerSec;
    zoomAndScroll(newPxPerSec, rangeStart * newPxPerSec);
  }, [wavesurfer, peaks.duration, containerWidth, zoomAndScroll]);

  const zoomToRangeExact = useCallback((start: number, end: number) => {
    if (!wavesurfer || !containerRef.current) return;
    const rangeStart = Math.max(0, start);
    const rangeEnd = Math.min(peaks.duration, end);
    const rangeDuration = rangeEnd - rangeStart;
    if (rangeDuration <= 0) return;

    const newPxPerSec = Math.min(MAX_PX_PER_SEC, containerWidth / rangeDuration);
    pxPerSecRef.current = newPxPerSec;
    zoomAndScroll(newPxPerSec, rangeStart * newPxPerSec);
  }, [wavesurfer, peaks.duration, containerWidth, zoomAndScroll]);

  const resetZoom = useCallback(() => {
    if (!wavesurfer) return;
    const base = getBasePxPerSec();
    pxPerSecRef.current = base;
    zoomAndScroll(base, 0);
  }, [wavesurfer, getBasePxPerSec, zoomAndScroll]);

  const clearSelection = useCallback(() => {
    selectionRangeRef.current = null;
    if (dragOverlayRef.current) dragOverlayRef.current.style.display = "none";
  }, []);

  const scrollToTime = useCallback((time: number) => {
    if (!wavesurfer) return;
    const scrollLeft = time * pxPerSecRef.current;
    wavesurfer.setScroll(Math.max(0, scrollLeft));
    syncOverlayTransform();
    reportViewport();
  }, [wavesurfer, syncOverlayTransform, reportViewport]);

  useImperativeHandle(ref, () => ({ zoomToRange, zoomToRangeExact, resetZoom, scrollToTime, clearSelection }), [zoomToRange, zoomToRangeExact, resetZoom, scrollToTime, clearSelection]);

  // Wheel zoom handler
  useEffect(() => {
    const container = containerRef.current;
    if (!isReady || !wavesurfer || !container) return;

    const basePxPerSec = getBasePxPerSec();
    if (pxPerSecRef.current === 0) pxPerSecRef.current = basePxPerSec;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const cursorRelX = (e.clientX - rect.left) / rect.width;

      const viewportBefore = computeViewport();
      const cursorTime = viewportBefore.start + cursorRelX * (viewportBefore.end - viewportBefore.start);

      const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY;
      const factor = Math.pow(2, zoomDelta);
      const newPxPerSec = Math.max(basePxPerSec, Math.min(MAX_PX_PER_SEC, pxPerSecRef.current * factor));
      pxPerSecRef.current = newPxPerSec;

      const visibleWidth = wavesurfer.getWidth();
      const totalWidth = peaks.duration * newPxPerSec;
      const cursorPx = cursorTime * newPxPerSec;
      const targetScroll = totalWidth <= visibleWidth ? 0 : cursorPx - cursorRelX * visibleWidth;

      zoomAndScroll(newPxPerSec, Math.max(0, targetScroll));
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [isReady, wavesurfer, peaks.duration, getBasePxPerSec, computeViewport, zoomAndScroll]);

  // Track viewport via wavesurfer's scroll event (fires on the real scroll container)
  useEffect(() => {
    if (!wavesurfer || !isReady) return;

    const onScroll = () => {
      syncOverlayTransform();
      reportViewport();
    };

    wavesurfer.on("scroll", onScroll);
    // Initial sync
    syncOverlayTransform();
    reportViewport();
    return () => { wavesurfer.un("scroll", onScroll); };
  }, [wavesurfer, isReady, syncOverlayTransform, reportViewport]);

  // Snap helper: find nearest section/loop boundary within threshold
  const snapToNearestBoundary = useCallback(
    (time: number, altKeyHeld: boolean): number => {
      if (altKeyHeld) return time;

      const container = containerRef.current;
      if (!container || peaks.duration <= 0) return time;
      const viewport = computeViewport();
      const visibleDuration = viewport.end - viewport.start;
      const pixelsPerSecond = container.clientWidth / (visibleDuration > 0 ? visibleDuration : peaks.duration);
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
    [sections, loops, peaks.duration, computeViewport],
  );

  // Drag-to-select bookmark creation + click-to-seek
  useEffect(() => {
    const container = containerRef.current;
    const overlay = dragOverlayRef.current;
    if (!isReady || !container || !overlay) return;

    const DRAG_THRESHOLD = 4;
    let startX = 0;
    let isDragging = false;
    let dragStartTime = 0;

    const pxToTime = (px: number): number => {
      const rect = container.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (px - rect.left) / rect.width));
      const viewport = computeViewport();
      return viewport.start + relX * (viewport.end - viewport.start);
    };

    const updateOverlayFromTime = (t0: number, t1: number) => {
      const viewport = computeViewport();
      const visibleDuration = viewport.end - viewport.start;
      if (visibleDuration <= 0) return;
      const rect = container.getBoundingClientRect();
      const left = ((Math.min(t0, t1) - viewport.start) / visibleDuration) * rect.width;
      const right = ((Math.max(t0, t1) - viewport.start) / visibleDuration) * rect.width;
      overlay.style.left = `${Math.max(0, left)}px`;
      overlay.style.width = `${Math.min(rect.width, right) - Math.max(0, left)}px`;
      overlay.style.display = "block";
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      overlay.style.display = "none";
      selectionRangeRef.current = null;
      startX = e.clientX;
      dragStartTime = pxToTime(e.clientX);
      isDragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (startX === 0) return;
      if (!isDragging && Math.abs(e.clientX - startX) > DRAG_THRESHOLD) {
        isDragging = true;
      }
      if (isDragging) {
        const currentTime = pxToTime(e.clientX);
        selectionRangeRef.current = {
          startTime: Math.min(dragStartTime, currentTime),
          endTime: Math.max(dragStartTime, currentTime),
        };
        updateOverlayFromTime(dragStartTime, currentTime);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (startX === 0) return;

      if (isDragging) {
        const endTime = pxToTime(e.clientX);
        const t0 = Math.min(dragStartTime, endTime);
        const t1 = Math.max(dragStartTime, endTime);
        selectionRangeRef.current = { startTime: t0, endTime: t1 };
        if (t1 - t0 > 0.1 && onBookmarkDragEnd) {
          const snappedStart = snapToNearestBoundary(t0, e.altKey);
          const snappedEnd = snapToNearestBoundary(t1, e.altKey);
          selectionRangeRef.current = { startTime: snappedStart, endTime: snappedEnd };
          updateOverlayFromTime(snappedStart, snappedEnd);
          requestAnimationFrame(() => {
            onBookmarkDragEnd(snappedStart, snappedEnd);
          });
        }
      } else {
        overlay.style.display = "none";
        selectionRangeRef.current = null;
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
  }, [isReady, peaks.duration, onSeek, onBookmarkDragEnd, snapToNearestBoundary, computeViewport]);

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

  // Handle double-click on sections/loops to zoom
  const handleSectionDoubleClick = useCallback(
    (section: SectionRecord) => {
      zoomToRange(section.startSeconds, section.endSeconds);
    },
    [zoomToRange],
  );

  const handleLoopDoubleClick = useCallback(
    (loop: LoopRecord) => {
      zoomToRange(loop.startSeconds, loop.endSeconds);
    },
    [zoomToRange],
  );

  // Keyboard seek state for ARIA live announcements
  const [seekAnnouncement, setSeekAnnouncement] = useState("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZoomed) {
        e.preventDefault();
        e.stopPropagation();
        resetZoom();
        return;
      }

      const currentTime = useTransportStore.getState().currentTime;
      const dur = peaks.duration;
      let seekTo: number | null = null;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 30 : 5;
        seekTo = Math.max(0, currentTime - step);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 30 : 5;
        seekTo = Math.min(dur, currentTime + step);
      }

      if (seekTo !== null) {
        onSeek(seekTo);
        setSeekAnnouncement(formatDuration(seekTo));
      }
    },
    [peaks.duration, onSeek, isZoomed, resetZoom],
  );

  const currentTime = useTransportStore((s) => s.currentTime);

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
        role="slider"
        tabIndex={0}
        aria-label="Waveform — scroll to zoom, use arrow keys to seek"
        aria-valuemin={0}
        aria-valuemax={peaks.duration}
        aria-valuenow={currentTime}
        aria-valuetext={formatDuration(currentTime)}
        onKeyDown={handleKeyDown}
        className="relative w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
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
        {/* Scrolling overlay container for section/loop markers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            ref={overlayTransformRef}
            className="relative h-full"
            style={{ width: `${totalScrollWidth || containerWidth}px` }}
          >
            {(totalScrollWidth || containerWidth) > 0 && sections.length > 0 && (
              <div className="pointer-events-auto">
                <SectionMarkers
                  sections={sections}
                  totalDuration={peaks.duration}
                  containerWidth={totalScrollWidth || containerWidth}
                  showLabels
                  onSectionClick={onSectionClick}
                  onSectionDoubleClick={handleSectionDoubleClick}
                />
              </div>
            )}
            {(totalScrollWidth || containerWidth) > 0 && loops.length > 0 && (
              <div className="pointer-events-auto">
                <LoopBrackets
                  loops={loops}
                  totalDuration={peaks.duration}
                  containerWidth={totalScrollWidth || containerWidth}
                  onLoopClick={onLoopClick}
                  onLoopDoubleClick={handleLoopDoubleClick}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Reset zoom button */}
      {isZoomed && (
        <button
          type="button"
          onClick={resetZoom}
          className="absolute right-2 top-2 z-20 rounded bg-[#1D2129]/80 px-2 py-1 text-xs text-[#E8863A] transition-opacity hover:bg-[#1D2129] hover:text-white"
        >
          Reset Zoom
        </button>
      )}
      {/* ARIA live region for seek announcements */}
      <div aria-live="polite" className="sr-only">{seekAnnouncement}</div>
    </div>
  );
});
