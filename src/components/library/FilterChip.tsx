"use client";

import { X } from "lucide-react";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ background: "#E8863A" }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center rounded-full hover:opacity-80"
        aria-label={`Remove ${label} filter`}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </span>
  );
}
