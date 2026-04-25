"use client";

import { Badge } from "@/components/ui/badge";
import type { SampleType } from "@/lib/types";

const TYPE_CONFIG: Record<SampleType, { label: string; bg: string; text: string }> = {
  bookmark: { label: "Bookmark", bg: "hsla(28, 90%, 58%, 0.15)", text: "hsl(28, 90%, 58%)" },
  loop:     { label: "Loop",     bg: "hsla(175, 55%, 45%, 0.15)", text: "hsl(175, 55%, 45%)" },
  section:  { label: "Section",  bg: "hsla(255, 50%, 60%, 0.15)", text: "hsl(255, 50%, 60%)" },
};

export function TypeBadge({ type }: { type: SampleType }) {
  const config = TYPE_CONFIG[type];
  return (
    <Badge
      variant="secondary"
      className="text-xs font-normal"
      style={{ backgroundColor: config.bg, color: config.text }}
      role="status"
      aria-label={config.label}
    >
      {config.label}
    </Badge>
  );
}
