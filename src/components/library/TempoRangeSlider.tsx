"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { getFilterOptions } from "@/lib/tauri";
import { useLibraryStore } from "@/lib/stores/library";
import { cn } from "@/lib/utils";

export function TempoRangeSlider() {
  const [open, setOpen] = useState(false);
  const { filter, setFilter } = useLibraryStore();

  const { data: options } = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 30_000,
  });

  const globalMin = options?.tempoMin ?? 60;
  const globalMax = options?.tempoMax ?? 200;
  const currentMin = filter.tempoMin ?? globalMin;
  const currentMax = filter.tempoMax ?? globalMax;

  const isActive =
    filter.tempoMin !== undefined || filter.tempoMax !== undefined;
  const label = isActive
    ? `${Math.round(currentMin)} - ${Math.round(currentMax)} BPM`
    : "Tempo";

  const handleChange = (value: number | readonly number[]) => {
    if (Array.isArray(value) && value.length >= 2) {
      setFilter({ tempoMin: value[0], tempoMax: value[1] });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[#272C36]",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
        style={{ background: "#1D2129" }}
      >
        {label}
        <ChevronDown size={14} strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-4"
        style={{ background: "#1D2129" }}
        align="start"
      >
        <div className="space-y-4">
          <Slider
            min={Math.floor(globalMin)}
            max={Math.ceil(globalMax)}
            value={[currentMin, currentMax]}
            onValueChange={handleChange}
          />
          <p className="text-center text-xs text-muted-foreground tabular-nums">
            {Math.round(currentMin)} - {Math.round(currentMax)} BPM
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
