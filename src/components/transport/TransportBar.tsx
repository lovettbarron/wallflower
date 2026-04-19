"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  ChevronFirst,
  ChevronLast,
  Circle,
  Square,
  AlertTriangle,
} from "lucide-react";
import { useTransportStore } from "@/lib/stores/transport";
import { useRecordingStore } from "@/lib/stores/recording";
import { formatDuration } from "@/lib/format";
import { StopRecordingDialog } from "@/components/recording/StopRecordingDialog";

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function TransportBar() {
  const {
    currentJamId,
    currentJamName,
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    setPlaying,
    setCurrentTime,
    setDuration,
  } = useTransportStore();

  const {
    isRecording,
    elapsedSeconds,
    deviceName,
    rmsDb,
    deviceDisconnected,
    requestStop,
    startRec,
  } = useRecordingStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    if (audio.src !== audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl, setCurrentTime, setDuration, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // Hide transport bar only when nothing is loaded and not recording
  if (currentJamId === null && !isRecording) return null;

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handleSkipBack = () => {
    setCurrentTime(0);
  };

  const handleSkipForward = () => {
    setCurrentTime(duration);
  };

  // Compute level meter fill width from rmsDb
  // Maps -60dB..0dB to 0%..100%
  const levelFillPercent = Math.min(
    100,
    Math.max(0, ((rmsDb + 60) / 60) * 100),
  );

  // Recording mode
  if (isRecording) {
    const borderColor = deviceDisconnected ? "#D93636" : "#E53E3E";

    return (
      <>
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center border-t px-8"
          style={{
            background: "#1D2129",
            borderColor: "#323844",
            borderLeftWidth: "3px",
            borderLeftColor: borderColor,
          }}
        >
          {/* Recording indicator dot */}
          <div
            className={deviceDisconnected ? "" : "animate-pulse-recording"}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#E53E3E",
              flexShrink: 0,
            }}
          />

          {/* REC label */}
          <span
            className="ml-2 text-xs font-semibold uppercase"
            style={{ color: "#E53E3E", fontSize: "12px" }}
          >
            REC
          </span>

          {/* Elapsed time */}
          <span
            className="ml-3 text-xs text-foreground"
            style={{ fontFeatureSettings: '"tnum"', fontSize: "12px" }}
          >
            {formatElapsed(elapsedSeconds)}
          </span>

          {/* Device name or disconnect warning */}
          <div className="mx-4 min-w-0 flex-1">
            {deviceDisconnected ? (
              <div className="flex items-center gap-1">
                <AlertTriangle size={14} style={{ color: "#D93636" }} />
                <span className="text-sm" style={{ color: "#D93636" }}>
                  Reconnect device
                </span>
              </div>
            ) : (
              <p
                className="truncate text-sm text-muted-foreground"
                style={{ fontSize: "14px" }}
              >
                {deviceName}
              </p>
            )}
          </div>

          {/* Input level meter */}
          <div
            className="mr-4 shrink-0"
            style={{
              width: "120px",
              height: "4px",
              backgroundColor: "#323844",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            {!deviceDisconnected && (
              <div
                style={{
                  width: `${levelFillPercent}%`,
                  height: "100%",
                  background: "linear-gradient(to right, #E53E3E, #E8863A)",
                  borderRadius: "2px",
                  transition: "width 50ms ease-out",
                }}
              />
            )}
          </div>

          {/* Stop button */}
          <button
            type="button"
            onClick={requestStop}
            className="shrink-0 text-sm text-foreground transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
            style={{
              background: "#272C36",
              borderRadius: "8px",
              paddingLeft: "16px",
              paddingRight: "16px",
              paddingTop: "6px",
              paddingBottom: "6px",
            }}
          >
            Stop
          </button>
        </div>

        <StopRecordingDialog />

        {/* Pulse animation for recording dot */}
        <style jsx global>{`
          @keyframes pulse-recording {
            0%,
            100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
          .animate-pulse-recording {
            animation: pulse-recording 1.5s ease-in-out infinite;
          }
        `}</style>
      </>
    );
  }

  // Playback mode
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
        {isPlaying ? (
          <Pause size={20} />
        ) : (
          <Play size={20} className="ml-0.5" />
        )}
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
        <p className="truncate text-sm text-foreground">{currentJamName}</p>
      </div>

      {/* Time display */}
      <span className="shrink-0 text-xs text-muted-foreground" style={{ fontFeatureSettings: '"tnum"' }}>
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>

      {/* Record button */}
      <button
        type="button"
        onClick={() => startRec()}
        className="ml-4 flex items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
        style={{
          width: "36px",
          height: "36px",
          border: "2px solid #E53E3E",
          background: "transparent",
        }}
        aria-label="Start Recording"
      >
        <Circle size={14} fill="#E53E3E" stroke="#E53E3E" />
      </button>
    </div>
  );
}
