"use client";

import { Search, X } from "lucide-react";
import { useLibraryStore } from "@/lib/stores/library";

export function SearchInput() {
  const { filter, setFilter, clearFilterField } = useLibraryStore();
  const value = filter.query ?? "";

  return (
    <div
      className="relative flex w-60 items-center rounded-lg border border-border"
      style={{ background: "#1D2129" }}
    >
      <Search
        className="absolute left-2.5 text-muted-foreground"
        size={14}
        strokeWidth={1.5}
      />
      <input
        type="text"
        placeholder="Search jams..."
        value={value}
        onChange={(e) => setFilter({ query: e.target.value })}
        className="h-8 w-full bg-transparent pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => clearFilterField("query")}
          className="absolute right-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
