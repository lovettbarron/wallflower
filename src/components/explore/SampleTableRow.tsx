"use client";

import { Play } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { TypeBadge } from "./TypeBadge";
import { PlayIndicator } from "./PlayIndicator";
import type { SampleRecord, BookmarkColor } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SampleTableRowProps {
  sample: SampleRecord;
  isSelected: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSelect: () => void;
  onNavigateToJam: (jamId: string) => void;
}

export function SampleTableRow({
  sample,
  isSelected,
  isPlaying,
  onPlay,
  onSelect,
  onNavigateToJam,
}: SampleTableRowProps) {
  const colorKey = sample.color as BookmarkColor | null;
  const colorInfo = colorKey ? BOOKMARK_COLORS[colorKey] : null;

  return (
    <TableRow
      className={`cursor-pointer h-10 transition-colors ${
        isSelected ? "bg-[hsl(220,14%,18%)]" : "hover:bg-muted/50"
      }`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect();
        } else if (e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
      aria-selected={isSelected}
    >
      {/* Play column - 40px */}
      <TableCell className="w-10 px-0 text-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          aria-label={isPlaying ? `Pause ${sample.name}` : `Play ${sample.name}`}
        >
          {isPlaying ? (
            <PlayIndicator />
          ) : (
            <Play size={16} />
          )}
        </button>
      </TableCell>

      {/* Name column - flex, min 120px */}
      <TableCell className="min-w-[120px]">
        <div className="flex items-center gap-1.5">
          {/* Color dot for bookmarks */}
          {sample.sampleType === "bookmark" && colorInfo && (
            <span
              className="flex-shrink-0 rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: colorInfo.solid,
              }}
            />
          )}
          <span className="truncate text-sm text-foreground">
            {sample.name}
          </span>
          {/* Loop repeat count */}
          {sample.sampleType === "loop" && sample.repeatCount != null && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              x{sample.repeatCount}
            </span>
          )}
          {/* Evolving indicator */}
          {sample.evolving && (
            <span className="flex-shrink-0 text-xs text-muted-foreground" aria-label="evolving">~</span>
          )}
        </div>
      </TableCell>

      {/* Type column - 80px */}
      <TableCell className="w-20">
        <TypeBadge type={sample.sampleType} />
      </TableCell>

      {/* Source column - flex, min 100px */}
      <TableCell className="min-w-[100px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToJam(sample.jamId);
          }}
          className="truncate text-sm text-foreground transition-colors hover:text-[#E8863A] hover:underline"
          aria-label={`Go to ${sample.sourceJamName}`}
        >
          {sample.sourceJamName}
        </button>
      </TableCell>

      {/* Key column - 72px */}
      <TableCell className="w-[72px] text-xs text-muted-foreground">
        {sample.keyDisplay ?? "--"}
      </TableCell>

      {/* BPM column - 56px */}
      <TableCell className="w-14 text-xs tabular-nums text-muted-foreground">
        {sample.tempoBpm ? Math.round(sample.tempoBpm) : "--"}
      </TableCell>

      {/* Duration column - 72px */}
      <TableCell className="w-[72px] text-xs tabular-nums text-muted-foreground">
        {formatDuration(sample.durationSeconds)}
      </TableCell>
    </TableRow>
  );
}
