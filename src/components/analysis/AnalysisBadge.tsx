"use client";

import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisBadgeProps {
  label: string;
  pending?: boolean;
  manualOverride?: boolean;
  onEdit?: () => void;
  onClearOverride?: () => void;
  className?: string;
}

export function AnalysisBadge({
  label,
  pending,
  manualOverride,
  onEdit,
  onClearOverride,
  className,
}: AnalysisBadgeProps) {
  return (
    <span
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={onEdit ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } } : undefined}
      className={cn(
        "group relative inline-flex min-w-[52px] items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition-colors",
        onEdit ? "cursor-pointer hover:bg-[#323844]" : "cursor-default",
        className,
      )}
      style={{ background: "#272C36" }}
    >
      <span
        className={cn(
          pending ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {pending ? "--" : label}
      </span>

      {manualOverride && !pending && (
        <Pencil size={10} className="text-[#E8863A]" />
      )}

      {manualOverride && onClearOverride && !pending && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClearOverride();
          }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClearOverride(); } }}
          className="hidden group-hover:inline-flex items-center justify-center"
          title="Clear manual value"
        >
          <X size={10} className="text-muted-foreground hover:text-foreground" />
        </span>
      )}
    </span>
  );
}
