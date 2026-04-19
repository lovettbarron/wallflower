"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AutocompletePopoverProps {
  suggestions: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
  placeholder: string;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutocompletePopover({
  suggestions,
  onSelect,
  onClose,
  placeholder,
  trigger,
  open,
  onOpenChange,
}: AutocompletePopoverProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().startsWith(query.toLowerCase())
  );

  const showCreateOption =
    query.trim().length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  const totalItems = filtered.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      // Focus input after popover opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
      setQuery("");
      onOpenChange(false);
      onClose();
    },
    [onSelect, onOpenChange, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (totalItems === 0 && query.trim()) {
        handleSelect(query.trim());
        return;
      }
      if (highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex]);
      } else if (showCreateOption) {
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      onClose();
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-56 p-2 bg-popover rounded-lg"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-7 text-xs"
        />
        {totalItems > 0 && (
          <div className="mt-1.5 max-h-40 overflow-y-auto">
            {filtered.map((item, index) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md transition-colors",
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(item)}
              >
                {item}
              </button>
            ))}
            {showCreateOption && (
              <button
                type="button"
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md transition-colors",
                  highlightedIndex === filtered.length
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
                onMouseEnter={() => setHighlightedIndex(filtered.length)}
                onClick={() => handleSelect(query.trim())}
              >
                Press Enter to add &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
