"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
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

export function KeySelect() {
  const [open, setOpen] = useState(false);
  const { filter, setFilter } = useLibraryStore();
  const selected = filter.keys ?? [];

  const { data: options } = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 30_000,
  });

  const keys = options?.keys ?? [];

  const toggle = (key: string) => {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    setFilter({ keys: next.length > 0 ? next : undefined });
  };

  const label = selected.length > 0 ? `Key (${selected.length})` : "Key";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[#272C36]",
          selected.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
        style={{ background: "#1D2129" }}
      >
        {label}
        <ChevronDown size={14} strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-0"
        style={{ background: "#1D2129" }}
        align="start"
      >
        <Command style={{ background: "#1D2129" }}>
          <CommandInput placeholder="Search keys..." className="text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
              No keys found
            </CommandEmpty>
            <CommandGroup>
              {keys.map((key) => (
                <CommandItem
                  key={key}
                  value={key}
                  onSelect={() => toggle(key)}
                  className="cursor-pointer"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                      selected.includes(key)
                        ? "border-[#E8863A] bg-[#E8863A] text-white"
                        : "border-muted-foreground",
                    )}
                  >
                    {selected.includes(key) && (
                      <Check size={12} strokeWidth={2} />
                    )}
                  </div>
                  {key}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
