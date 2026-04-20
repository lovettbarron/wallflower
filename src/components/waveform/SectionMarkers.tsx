"use client";

import { useMemo } from "react";
import type { SectionRecord } from "@/lib/types";

const SECTION_COLORS: Record<string, string> = {
  Intro: "hsl(210 60% 65%)",
  Outro: "hsl(210 60% 65%)",
  Verse: "hsl(150 50% 55%)",
  Chorus: "hsl(340 60% 65%)",
  Bridge: "hsl(45 70% 60%)",
  Loop: "hsl(270 50% 65%)",
  default: "hsl(220 10% 50%)",
};

function getSectionColor(label: string): string {
  for (const [key, color] of Object.entries(SECTION_COLORS)) {
    if (key !== "default" && label.startsWith(key)) return color;
  }
  return SECTION_COLORS.default;
}

interface SectionMarkersProps {
  sections: SectionRecord[];
  totalDuration: number;
  containerWidth: number;
  showLabels?: boolean;
  onSectionClick?: (section: SectionRecord) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  containerWidth,
  showLabels = false,
  onSectionClick,
}: SectionMarkersProps) {
  const markers = useMemo(() => {
    if (totalDuration <= 0 || containerWidth <= 0) return [];

    const sorted = [...sections].sort(
      (a, b) => a.startSeconds - b.startSeconds,
    );

    let lastLabelX = -Infinity;
    return sorted.map((section) => {
      const x = (section.startSeconds / totalDuration) * containerWidth;
      const color = getSectionColor(section.label);
      const showLabel = showLabels && x - lastLabelX >= 40;
      if (showLabel) lastLabelX = x;
      return { section, x, color, showLabel };
    });
  }, [sections, totalDuration, containerWidth, showLabels]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {markers.map(({ section, x, color, showLabel }) => (
        <div key={section.id}>
          {/* Vertical line */}
          <div
            className="absolute top-0 h-full"
            style={{
              left: `${x}px`,
              width: "2px",
              backgroundColor: color,
              opacity: 0.6,
            }}
          />
          {/* Clickable label */}
          {showLabel && (
            <span
              className="pointer-events-auto absolute cursor-pointer text-xs transition-opacity hover:opacity-100"
              style={{
                left: `${x + 4}px`,
                top: "2px",
                color,
                fontSize: "12px",
                lineHeight: "16px",
                whiteSpace: "nowrap",
                opacity: 0.8,
              }}
              onClick={() => onSectionClick?.(section)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSectionClick?.(section);
                }
              }}
              title={`Jump to ${section.label}`}
            >
              {section.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
