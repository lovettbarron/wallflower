"use client";

import {
  Play,
  Pause,
  ChevronFirst,
  ChevronLast,
} from "lucide-react";
import { useTransportStore } from "@/lib/stores/transport";
import { formatDuration } from "@/lib/format";

export function TransportBar() {
  const {
    currentJamId,
    currentJamName,
    isPlaying,
    currentTime,
    duration,
    setPlaying,
    setCurrentTime,
  } = useTransportStore();

  if (currentJamId === null) return null;

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handleSkipBack = () => {
    setCurrentTime(0);
  };

  const handleSkipForward = () => {
    setCurrentTime(duration);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center border-t px-8"
      style={{
        background: "#1D2129",
        borderColor: "#323844",
      }}
    >
      {/* Skip back */}
      <button
        type="button"
        onClick={handleSkipBack}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#272C36] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
        aria-label="Skip to start"
      >
        <ChevronFirst size={18} />
      </button>

      {/* Play/pause */}
      <button
        type="button"
        onClick={handlePlayPause}
        className="mx-2 flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#1D2129]"
        style={{ background: "#E8863A", width: "44px", height: "44px" }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
      </button>

      {/* Skip forward */}
      <button
        type="button"
        onClick={handleSkipForward}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#272C36] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
        aria-label="Skip to end"
      >
        <ChevronLast size={18} />
      </button>

      {/* Jam name */}
      <div className="mx-4 min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {currentJamName}
        </p>
      </div>

      {/* Time display */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>
    </div>
  );
}
