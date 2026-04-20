"use client";

import { useMemo } from "react";
import type { LoopRecord } from "@/lib/types";

const LOOP_COLOR = "hsl(270 50% 65%)";

interface LoopBracketsProps {
  loops: LoopRecord[];
  totalDuration: number;
  containerWidth: number;
}

export function LoopBrackets({
  loops,
  totalDuration,
  containerWidth,
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
    <div className="pointer-events-none absolute left-0 right-0" style={{ top: "-12px", height: "12px" }}>
      {brackets.map(({ loop, startX, width, label, showLabel }) => (
        <div
          key={loop.id}
          className="absolute"
          style={{ left: `${startX}px`, width: `${width}px`, height: "12px" }}
        >
          {/* Horizontal bracket line */}
          <div
            className="absolute top-1/2 w-full"
            style={{
              height: "2px",
              backgroundColor: LOOP_COLOR,
              opacity: 0.4,
            }}
          />
          {/* Left tick */}
          <div
            className="absolute left-0"
            style={{
              top: "2px",
              width: "2px",
              height: "8px",
              backgroundColor: LOOP_COLOR,
              opacity: 0.4,
            }}
          />
          {/* Right tick */}
          <div
            className="absolute right-0"
            style={{
              top: "2px",
              width: "2px",
              height: "8px",
              backgroundColor: LOOP_COLOR,
              opacity: 0.4,
            }}
          />
          {/* Label */}
          {showLabel && (
            <span
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs"
              style={{
                top: "-14px",
                color: LOOP_COLOR,
                fontSize: "12px",
              }}
            >
              {label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
