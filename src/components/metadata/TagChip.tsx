"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagChipProps {
  label: string;
  onRemove: () => void;
  variant?: "tag" | "collaborator" | "instrument";
}

export function TagChip({ label, onRemove, variant = "tag" }: TagChipProps) {
  const [isHovered, setIsHovered] = useState(false);

  const displayLabel = variant === "collaborator" ? `@${label}` : label;

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-xl px-2 text-xs",
        "bg-secondary text-foreground border border-transparent",
        "transition-colors cursor-default select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isHovered && "border-primary"
      )}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onRemove();
        }
      }}
    >
      <span className="truncate max-w-[120px]">{displayLabel}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}
        tabIndex={-1}
        aria-label={`Remove ${displayLabel}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
