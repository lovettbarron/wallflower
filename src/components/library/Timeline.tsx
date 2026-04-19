"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listJams } from "@/lib/tauri";
import type { JamRecord } from "@/lib/types";
import { DateGroup } from "./DateGroup";
import { JamCard } from "./JamCard";

/** Compute a human-readable date group label for a jam. */
function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Strip time for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  if (diffDays < 30) {
    // "Week of April 7"
    const weekStart = new Date(target);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return `Week of ${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }
  // Older: "March 2026"
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Group jams by their date label, preserving chronological order. */
function groupJamsByDate(
  jams: JamRecord[],
): { label: string; jams: JamRecord[] }[] {
  const groups: { label: string; jams: JamRecord[] }[] = [];
  const labelMap = new Map<string, JamRecord[]>();
  const labelOrder: string[] = [];

  for (const jam of jams) {
    const dateStr = jam.createdAt || jam.importedAt;
    const label = getDateGroupLabel(dateStr);
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
      labelOrder.push(label);
    }
    labelMap.get(label)!.push(jam);
  }

  for (const label of labelOrder) {
    groups.push({ label, jams: labelMap.get(label)! });
  }

  return groups;
}

interface TimelineProps {
  onImportClick: () => void;
}

export function Timeline({ onImportClick }: TimelineProps) {
  const router = useRouter();

  const {
    data: jams,
    isLoading,
    error,
  } = useQuery<JamRecord[]>({
    queryKey: ["jams"],
    queryFn: listJams,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">
          Could not load library. Please try again.
        </p>
      </div>
    );
  }

  if (!jams || jams.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="text-[28px] font-semibold leading-tight text-foreground">
          No jams in your library yet
        </h2>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          Drop audio files here or click Import Files to start building your
          collection.
        </p>
        <button
          type="button"
          onClick={onImportClick}
          className="mt-6 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#151921]"
          style={{ background: "#E8863A" }}
        >
          Import Files
        </button>
      </div>
    );
  }

  const groups = groupJamsByDate(jams);

  return (
    <div className="pb-14">
      {groups.map((group) => (
        <DateGroup key={group.label} label={group.label}>
          {group.jams.map((jam) => (
            <JamCard
              key={jam.id}
              jam={jam}
              onClick={() => router.push(`/jam/${jam.id}`)}
            />
          ))}
        </DateGroup>
      ))}
    </div>
  );
}
