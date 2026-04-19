"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listJams, attachPhoto } from "@/lib/tauri";
import { useLibraryStore } from "@/lib/stores/library";
import type { JamRecord } from "@/lib/types";
import { DateGroup } from "./DateGroup";
import { JamCard } from "./JamCard";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"];

/** Compute a human-readable date group label for a jam. */
function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

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
    const weekStart = new Date(target);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return `Week of ${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }
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

function findJamCardAtPosition(x: number, y: number): { id: string; name: string } | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const card = el.closest("[data-jam-id]") as HTMLElement | null;
  if (!card) return null;
  return {
    id: card.dataset.jamId!,
    name: card.dataset.jamName || "this jam",
  };
}

interface TimelineProps {
  onImportClick: () => void;
}

export function Timeline({ onImportClick }: TimelineProps) {
  const { setSelectedJam } = useLibraryStore();
  const [dropTargetJamId, setDropTargetJamId] = useState<string | null>(null);
  const dropTargetRef = useRef<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const attachMutation = useMutation({
    mutationFn: ({ jamId, filePath }: { jamId: string; filePath: string }) =>
      attachPhoto(jamId, filePath),
    onSuccess: (_data, variables) => {
      const name = dropTargetRef.current?.name || "jam";
      toast.success(`Photo attached to ${name}`, { duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["jam", variables.jamId] });
    },
    onError: (error: Error) => {
      toast.error(`Could not attach photo: ${error.message}`, { duration: 6000 });
    },
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    async function setup() {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const fn = await getCurrentWebview().onDragDropEvent((event) => {
          if (!mounted) return;

          if (event.payload.type === "over") {
            const pos = event.payload.position;
            const target = findJamCardAtPosition(pos.x, pos.y);
            dropTargetRef.current = target;
            setDropTargetJamId(target?.id ?? null);
          }

          if (event.payload.type === "drop") {
            const pos = event.payload.position;
            const target = findJamCardAtPosition(pos.x, pos.y);
            setDropTargetJamId(null);

            if (target) {
              const paths = event.payload.paths;
              let attached = 0;
              for (const path of paths) {
                const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
                if (IMAGE_EXTENSIONS.includes(ext)) {
                  dropTargetRef.current = target;
                  attachMutation.mutate({ jamId: target.id, filePath: path });
                  attached++;
                }
              }
              if (attached === 0 && paths.length > 0) {
                toast.error("No supported image files. Try .jpg, .png, .webp, or .heic.", { duration: 4000 });
              }
            }
          }

          if (event.payload.type === "leave") {
            setDropTargetJamId(null);
            dropTargetRef.current = null;
          }
        });
        unlisten = fn;
      } catch {
        // Not running in Tauri
      }
    }

    setup();
    return () => { mounted = false; unlisten?.(); };
  }, []);

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
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
              onClick={() => setSelectedJam(jam.id)}
              isDropTarget={dropTargetJamId === jam.id}
            />
          ))}
        </DateGroup>
      ))}
    </div>
  );
}
