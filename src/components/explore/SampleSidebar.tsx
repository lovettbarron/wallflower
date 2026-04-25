"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSampleBrowserStore } from "@/lib/stores/sample-browser";
import { getSampleFilterOptions } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import type { SampleType } from "@/lib/types";

/** Section header per UI-SPEC: label/12px, uppercase, letter-spacing 0.5px, muted-foreground */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/** Multi-select popover (reusing Command+Popover pattern from FilterBar) */
function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel =
    selected.length > 0 ? `${selected.length} selected` : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[#272C36]",
          selected.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
        style={{ background: "#1D2129" }}
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        {displayLabel}
        <ChevronDown size={14} strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-0"
        style={{ background: "#1D2129" }}
        align="start"
      >
        <Command style={{ background: "#1D2129" }}>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}...`}
            className="text-sm"
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
              No {label.toLowerCase()} found
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => onToggle(opt)}
                  className="cursor-pointer"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                      selected.includes(opt)
                        ? "border-[#E8863A] bg-[#E8863A] text-white"
                        : "border-muted-foreground",
                    )}
                  >
                    {selected.includes(opt) && (
                      <Check size={12} strokeWidth={2} />
                    )}
                  </div>
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const SAMPLE_TYPES: { value: SampleType; label: string }[] = [
  { value: "bookmark", label: "Bookmark" },
  { value: "loop", label: "Loop" },
  { value: "section", label: "Section" },
];

export function SampleSidebar() {
  const { filter, setFilter, hasActiveFilters, clearFilter } =
    useSampleBrowserStore();

  const { data: options } = useQuery({
    queryKey: ["sample-filter-options"],
    queryFn: getSampleFilterOptions,
    staleTime: 30_000,
  });

  // Debounced search
  const [searchValue, setSearchValue] = useState(filter.query ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter({ query: searchValue || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, setFilter]);

  // Type toggles
  const selectedTypes = filter.types ?? [];
  const toggleType = useCallback(
    (type: SampleType) => {
      const current = filter.types ?? [];
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      setFilter({ types: next.length > 0 ? next : undefined });
    },
    [filter.types, setFilter],
  );

  // Key multi-select toggle
  const toggleKey = useCallback(
    (key: string) => {
      const current = filter.keys ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      setFilter({ keys: next.length > 0 ? next : undefined });
    },
    [filter.keys, setFilter],
  );

  // Tag multi-select toggle
  const toggleTag = useCallback(
    (tag: string) => {
      const current = filter.tags ?? [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      setFilter({ tags: next.length > 0 ? next : undefined });
    },
    [filter.tags, setFilter],
  );

  // Tempo range
  const tempoMin = options?.tempoMin ?? 60;
  const tempoMax = options?.tempoMax ?? 200;
  const currentTempoMin = filter.tempoMin ?? tempoMin;
  const currentTempoMax = filter.tempoMax ?? tempoMax;

  const handleTempoChange = useCallback(
    (value: number | readonly number[]) => {
      if (Array.isArray(value) && value.length >= 2) {
        setFilter({ tempoMin: value[0], tempoMax: value[1] });
      }
    },
    [setFilter],
  );

  // Duration range
  const durationMin = options?.durationMin ?? 0;
  const durationMax = options?.durationMax ?? 120;
  const currentDurationMin = filter.durationMin ?? durationMin;
  const currentDurationMax = filter.durationMax ?? durationMax;

  const handleDurationChange = useCallback(
    (value: number | readonly number[]) => {
      if (Array.isArray(value) && value.length >= 2) {
        setFilter({ durationMin: value[0], durationMax: value[1] });
      }
    },
    [setFilter],
  );

  // Source jam
  const handleSourceJamChange = useCallback(
    (jamId: string | null) => {
      setFilter({ sourceJamId: !jamId || jamId === "__all__" ? undefined : jamId });
    },
    [setFilter],
  );

  return (
    <nav
      aria-label="Sample filters"
      className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-border"
      style={{ background: "#1D2129" }}
    >
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4 pt-6">
          {/* Search input */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search samples..."
              className="pl-8"
              aria-label="Search samples"
              role="searchbox"
            />
          </div>

          <Separator />

          {/* Type toggles */}
          <div className="flex flex-col gap-2">
            <SectionHeader>TYPE</SectionHeader>
            <div
              className="flex flex-col gap-1"
              role="group"
              aria-label="Filter by type"
            >
              {SAMPLE_TYPES.map(({ value, label }) => {
                const isChecked = selectedTypes.length === 0 || selectedTypes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground transition-colors hover:bg-muted/50"
                    role="checkbox"
                    aria-checked={isChecked}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        isChecked
                          ? "border-[#E8863A] bg-[#E8863A] text-white"
                          : "border-muted-foreground",
                      )}
                    >
                      {isChecked && <Check size={12} strokeWidth={2} />}
                    </div>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Key dropdown */}
          <div className="flex flex-col gap-2">
            <SectionHeader>KEY</SectionHeader>
            <MultiSelectFilter
              label="Key"
              options={options?.keys ?? []}
              selected={filter.keys ?? []}
              onToggle={toggleKey}
              placeholder="All keys"
            />
          </div>

          <Separator />

          {/* Tempo range slider */}
          <div className="flex flex-col gap-2">
            <SectionHeader>TEMPO</SectionHeader>
            <Slider
              min={Math.floor(tempoMin)}
              max={Math.ceil(tempoMax)}
              value={[currentTempoMin, currentTempoMax]}
              onValueChange={handleTempoChange}
              aria-label={`Tempo range, ${Math.round(currentTempoMin)} to ${Math.round(currentTempoMax)} BPM`}
            />
            <p className="text-center text-xs text-muted-foreground tabular-nums">
              {Math.round(currentTempoMin)} - {Math.round(currentTempoMax)} BPM
            </p>
          </div>

          <Separator />

          {/* Duration range slider */}
          <div className="flex flex-col gap-2">
            <SectionHeader>DURATION</SectionHeader>
            <Slider
              min={Math.floor(durationMin)}
              max={Math.ceil(durationMax)}
              value={[currentDurationMin, currentDurationMax]}
              onValueChange={handleDurationChange}
              aria-label={`Duration range, ${Math.round(currentDurationMin)} to ${Math.round(currentDurationMax)} seconds`}
            />
            <p className="text-center text-xs text-muted-foreground tabular-nums">
              {Math.round(currentDurationMin)}s - {Math.round(currentDurationMax)}s
            </p>
          </div>

          <Separator />

          {/* Source jam dropdown */}
          <div className="flex flex-col gap-2">
            <SectionHeader>SOURCE JAM</SectionHeader>
            <Select
              value={filter.sourceJamId ?? "__all__"}
              onValueChange={handleSourceJamChange}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter by source jam"
              >
                <SelectValue placeholder="All jams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All jams</SelectItem>
                {(options?.jams ?? []).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Tags multi-select */}
          <div className="flex flex-col gap-2">
            <SectionHeader>TAGS</SectionHeader>
            <MultiSelectFilter
              label="Tags"
              options={options?.tags ?? []}
              selected={filter.tags ?? []}
              onToggle={toggleTag}
              placeholder="Select tags..."
            />
          </div>

          {/* Clear all button */}
          {hasActiveFilters && (
            <>
              <Separator />
              <button
                type="button"
                onClick={clearFilter}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      </ScrollArea>
    </nav>
  );
}
