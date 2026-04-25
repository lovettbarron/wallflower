"use client";

import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSampleBrowserStore } from "@/lib/stores/sample-browser";

export function SidebarToggle() {
  const { sidebarExpanded, toggleSidebar, hasActiveFilters, filter } =
    useSampleBrowserStore();

  // Count active filters
  const activeCount = Object.values(filter).filter(
    (v) =>
      v !== undefined &&
      v !== null &&
      (Array.isArray(v) ? v.length > 0 : v !== ""),
  ).length;

  if (sidebarExpanded) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={toggleSidebar}
              className="absolute right-0 top-4 flex h-6 w-6 items-center justify-center rounded-l-md text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Hide filters"
            >
              <ChevronLeft size={16} />
            </button>
          }
        />
        <TooltipContent side="right">Hide filters</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={toggleSidebar}
            className="flex h-full w-10 flex-col items-center gap-2 border-r border-border pt-4 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
            style={{ background: "#1D2129" }}
            aria-label="Show filters"
          >
            <SlidersHorizontal size={16} />
            {hasActiveFilters && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs text-white"
                style={{ backgroundColor: "#E8863A" }}
              >
                {activeCount}
              </span>
            )}
          </button>
        }
      />
      <TooltipContent side="right">Show filters</TooltipContent>
    </Tooltip>
  );
}
