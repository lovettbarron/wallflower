"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { GraphNode } from "./SpatialCanvas";

interface SpatialAccessibilityOverlayProps {
  nodes: GraphNode[];
  focusedNodeId: string | null;
  onNodeFocus: (id: string) => void;
  onNodeActivate: (id: string) => void;
  onDeselect: () => void;
}

/**
 * Hidden DOM overlay for canvas accessibility (per D-07 and research Pattern 1).
 * Provides keyboard navigation (arrow keys) and screen reader announcements
 * for the force-directed spatial map.
 */
export function SpatialAccessibilityOverlay({
  nodes,
  focusedNodeId,
  onNodeFocus,
  onNodeActivate,
  onDeselect,
}: SpatialAccessibilityOverlayProps) {
  const [announcement, setAnnouncement] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Find nearest node in a direction using euclidean distance
  const findNearestInDirection = useCallback(
    (
      currentId: string,
      direction: "up" | "down" | "left" | "right",
    ): string | null => {
      const current = nodes.find((n) => n.id === currentId);
      if (!current || current.x == null || current.y == null) return null;

      let best: GraphNode | null = null;
      let bestDist = Infinity;

      for (const node of nodes) {
        if (node.id === currentId || node.x == null || node.y == null) continue;

        const dx = node.x - current.x;
        const dy = node.y - current.y;

        // Filter by direction
        const inDirection =
          (direction === "right" && dx > 0) ||
          (direction === "left" && dx < 0) ||
          (direction === "down" && dy > 0) ||
          (direction === "up" && dy < 0);

        if (!inDirection) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = node;
        }
      }

      return best?.id ?? null;
    },
    [nodes],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedNodeId && nodes.length > 0) {
        // Focus first node if nothing focused
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
          e.preventDefault();
          onNodeFocus(nodes[0].id);
          return;
        }
      }

      if (!focusedNodeId) return;

      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dirMap: Record<string, "up" | "down" | "left" | "right"> = {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right",
          };
          const nearestId = findNearestInDirection(
            focusedNodeId,
            dirMap[e.key],
          );
          if (nearestId) {
            onNodeFocus(nearestId);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          onNodeActivate(focusedNodeId);
          break;
        }
        case "Escape": {
          e.preventDefault();
          onDeselect();
          break;
        }
      }
    },
    [focusedNodeId, nodes, findNearestInDirection, onNodeFocus, onNodeActivate, onDeselect],
  );

  // Announce focused node for screen readers (per D-08)
  useEffect(() => {
    if (!focusedNodeId) {
      setAnnouncement("");
      return;
    }
    const node = nodes.find((n) => n.id === focusedNodeId);
    if (!node) return;

    const name = (node.filename ?? "Untitled").replace(/\.[^.]+$/, "");
    const duration = node.durationSeconds
      ? formatDuration(node.durationSeconds)
      : "";
    const key = node.keyName ?? "";
    const bpm = node.tempoBpm ? `${Math.round(node.tempoBpm)} BPM` : "";
    const parts = [name, duration, key, bpm].filter(Boolean);
    setAnnouncement(parts.join(", "));
  }, [focusedNodeId, nodes]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Jam library spatial explorer -- use arrow keys to navigate between jams"
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
    >
      <div
        role="listbox"
        aria-label="Jams"
        className="sr-only"
        onKeyDown={handleKeyDown}
      >
        {nodes.map((node) => {
          const name = (node.filename ?? "Untitled").replace(/\.[^.]+$/, "");
          const duration = node.durationSeconds
            ? formatDuration(node.durationSeconds)
            : "";
          const key = node.keyName ?? "";
          const bpm = node.tempoBpm ? `${Math.round(node.tempoBpm)} BPM` : "";
          const label = [name, duration, key, bpm].filter(Boolean).join(", ");

          return (
            <button
              key={node.id}
              role="option"
              aria-selected={focusedNodeId === node.id}
              aria-label={label}
              tabIndex={focusedNodeId === node.id ? 0 : -1}
              onFocus={() => onNodeFocus(node.id)}
              onClick={() => onNodeActivate(node.id)}
              style={{ pointerEvents: "auto" }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Screen reader live announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

/** Format seconds to "X minutes Y seconds" for screen readers. */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs} seconds`;
  if (secs === 0) return `${mins} minute${mins > 1 ? "s" : ""}`;
  return `${mins} minute${mins > 1 ? "s" : ""} ${secs} seconds`;
}
