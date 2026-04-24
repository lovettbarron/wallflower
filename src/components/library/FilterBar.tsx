"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
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
import { getFilterOptions } from "@/lib/tauri";
import { useLibraryStore } from "@/lib/stores/library";
import { cn } from "@/lib/utils";
import { SearchInput } from "./SearchInput";
import { KeySelect } from "./KeySelect";
import { TempoRangeSlider } from "./TempoRangeSlider";
import { FilterChip } from "./FilterChip";
import type { SearchFilter } from "@/lib/types";

/** Reusable multi-select popover for tags, collaborators, instruments. */
function MultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel =
    selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[#272C36]",
          selected.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
        style={{ background: "#1D2129" }}
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

interface FilterBarProps {
  resultCount?: number;
}

export function FilterBar({ resultCount }: FilterBarProps) {
  const { filter, setFilter, hasActiveFilters, clearFilter, clearFilterField } =
    useLibraryStore();

  const { data: options } = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 30_000,
  });

  // Toggle helpers for multi-select filters
  const toggleArrayFilter = (
    field: "tags" | "collaborators" | "instruments",
    value: string,
  ) => {
    const current = filter[field] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilter({ [field]: next.length > 0 ? next : undefined });
  };

  // Collect active filter chips
  const chips: { label: string; field: keyof SearchFilter; index?: number }[] =
    [];
  if (filter.keys) {
    for (const k of filter.keys) {
      chips.push({ label: k, field: "keys" });
    }
  }
  if (filter.tempoMin !== undefined || filter.tempoMax !== undefined) {
    const min = Math.round(filter.tempoMin ?? 0);
    const max = Math.round(filter.tempoMax ?? 999);
    chips.push({ label: `${min}-${max} BPM`, field: "tempoMin" });
  }
  if (filter.tags) {
    for (const t of filter.tags) {
      chips.push({ label: t, field: "tags" });
    }
  }
  if (filter.collaborators) {
    for (const c of filter.collaborators) {
      chips.push({ label: c, field: "collaborators" });
    }
  }
  if (filter.instruments) {
    for (const i of filter.instruments) {
      chips.push({ label: i, field: "instruments" });
    }
  }
  if (filter.location) {
    chips.push({ label: `@ ${filter.location}`, field: "location" });
  }

  const removeChip = (chip: {
    label: string;
    field: keyof SearchFilter;
  }) => {
    const field = chip.field;
    if (field === "tempoMin") {
      // Clear both tempo bounds
      clearFilterField("tempoMin");
      clearFilterField("tempoMax");
      return;
    }
    // For array fields, remove the specific value
    const current = filter[field];
    if (Array.isArray(current)) {
      const next = (current as string[]).filter((v) => v !== chip.label);
      setFilter({ [field]: next.length > 0 ? next : undefined });
    } else {
      clearFilterField(field);
    }
  };

  return (
    <div
      role="search"
      aria-label="Filter jams"
      className="sticky top-0 z-20 mb-4 rounded-xl p-4"
      style={{ background: "#1D2129" }}
    >
      {/* Row 1: Filter controls */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput />
        <KeySelect />
        <TempoRangeSlider />
        <MultiSelect
          label="Tags"
          options={options?.tags ?? []}
          selected={filter.tags ?? []}
          onToggle={(v) => toggleArrayFilter("tags", v)}
        />

        {/* More dropdown: Collaborators, Instruments */}
        <Popover>
          <PopoverTrigger
            className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-[#272C36]"
            style={{ background: "#1D2129" }}
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} />
            More
          </PopoverTrigger>
          <PopoverContent
            className="w-64 space-y-3 p-3"
            style={{ background: "#1D2129" }}
            align="start"
          >
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Collaborators
              </p>
              <div className="flex flex-wrap gap-1">
                {(options?.collaborators ?? []).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleArrayFilter("collaborators", c)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-xs transition-colors",
                      (filter.collaborators ?? []).includes(c)
                        ? "bg-[#E8863A] text-white"
                        : "bg-[#272C36] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
                {(options?.collaborators ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No collaborators yet
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Instruments
              </p>
              <div className="flex flex-wrap gap-1">
                {(options?.instruments ?? []).map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleArrayFilter("instruments", i)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-xs transition-colors",
                      (filter.instruments ?? []).includes(i)
                        ? "bg-[#E8863A] text-white"
                        : "bg-[#272C36] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {i}
                  </button>
                ))}
                {(options?.instruments ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No instruments yet
                  </span>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Row 2: Active filter chips */}
      {hasActiveFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <FilterChip
              key={`${chip.field}-${chip.label}`}
              label={chip.label}
              onRemove={() => removeChip(chip)}
            />
          ))}
          <button
            type="button"
            onClick={clearFilter}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
          {resultCount !== undefined && (
            <span className="ml-auto text-xs text-muted-foreground">
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </span>
          )}
        </div>
      )}

      {/* Screen reader announcement for filter results */}
      <div aria-live="polite" className="sr-only">
        {resultCount !== undefined
          ? `${resultCount} ${resultCount === 1 ? "jam" : "jams"} matching`
          : ""}
      </div>
    </div>
  );
}
