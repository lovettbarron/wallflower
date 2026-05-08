"use client";

import { useState, useEffect } from "react";
import { ArrowUpCircle, Download, X } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  checkForUpdate,
  dismissUpdate,
  type ReleaseInfo,
} from "@/lib/update-checker";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

export function UpdateBadge() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    checkForUpdate(APP_VERSION).then(setRelease).catch(() => {});
  }, []);

  if (!release) return null;

  const changelogLines = release.body
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(0, 12);

  return (
    <Popover>
      <PopoverTrigger
        className="relative flex items-center justify-center rounded-md p-1 text-[#E8863A] transition-colors hover:text-[#E8863A]/80 focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#1D2129]"
        aria-label={`Update available: v${release.version}`}
      >
        <ArrowUpCircle size={18} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#E8863A]" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 rounded-xl border p-0"
        style={{ background: "#1D2129", borderColor: "#323844" }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#323844" }}>
          <div>
            <p className="text-sm font-semibold text-foreground">
              v{release.version} available
            </p>
            <p className="text-xs text-muted-foreground">
              You're on v{APP_VERSION}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              dismissUpdate();
              setRelease(null);
            }}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss update"
          >
            <X size={14} />
          </button>
        </div>

        {changelogLines.length > 0 && (
          <div className="max-h-48 overflow-y-auto px-4 py-3 text-xs text-muted-foreground">
            {changelogLines.map((line, i) => (
              <p key={i} className="mb-1 last:mb-0">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="border-t px-4 py-3" style={{ borderColor: "#323844" }}>
          <a
            href={release.dmgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: "#E8863A" }}
          >
            <Download size={14} />
            Download v{release.version}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
