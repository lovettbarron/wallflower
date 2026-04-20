"use client";

import { useMemo } from "react";
import type { LoopRecord } from "@/lib/types";

const LOOP_COLOR = "hsl(270 50% 65%)";
const LOOP_COLOR_ACTIVE = "hsl(270 60% 75%)";

interface LoopBracketsProps {
  loops: LoopRecord[];
  totalDuration: number;
  containerWidth: number;
  activeLoopLabel?: string | null;
  onLoopClick?: (loop: LoopRecord) => void;
}

export function LoopBrackets({
  loops,
  totalDuration,
  containerWidth,
  activeLoopLabel,
  onLoopClick,
}: LoopBracketsProps) {
  const brackets = useMemo(() => {
    if (totalDuration <= 0 || containerWidth <= 0) return [];

    return loops.map((loop) => {
      const startX = (loop.startSeconds / totalDuration) * containerWidth;
      const endX = (loop.endSeconds / totalDuration) * containerWidth;
      const width = endX - startX;
      const label = loop.evolving
        ? `${loop.label} x${loop.repeatCount} (evolving)`
        : `${loop.label} x${loop.repeatCount}`;
      const showLabel = width >= 60;
      return { loop, startX, width, label, showLabel };
    });
  }, [loops, totalDuration, containerWidth]);

  return (
    <div className="absolute left-0 right-0" style={{ top: "-12px", height: "12px" }}>
      {brackets.map(({ loop, startX, width, label, showLabel }) => {
        const isActive = activeLoopLabel === loop.label;
        const color = isActive ? LOOP_COLOR_ACTIVE : LOOP_COLOR;
        const opacity = isActive ? 0.8 : 0.4;

        return (
          <div
            key={loop.id}
            className="absolute cursor-pointer"
            style={{ left: `${startX}px`, width: `${width}px`, height: "12px" }}
            onClick={() => onLoopClick?.(loop)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onLoopClick?.(loop);
              }
            }}
            title={`Play ${label}`}
          >
            {/* Horizontal bracket line */}
            <div
              className="absolute top-1/2 w-full"
              style={{ height: "2px", backgroundColor: color, opacity }}
            />
            {/* Left tick */}
            <div
              className="absolute left-0"
              style={{ top: "2px", width: "2px", height: "8px", backgroundColor: color, opacity }}
            />
            {/* Right tick */}
            <div
              className="absolute right-0"
              style={{ top: "2px", width: "2px", height: "8px", backgroundColor: color, opacity }}
            />
            {/* Label */}
            {showLabel && (
              <span
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs"
                style={{ top: "-14px", color, fontSize: "12px" }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
