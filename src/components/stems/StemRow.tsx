"use client";

import { useRef, useEffect } from "react";
import { Headphones, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StemRowProps {
  name: string;
  color: string;
  soloed: boolean;
  muted: boolean;
  onSolo: () => void;
  onMute: () => void;
  audioBuffer: AudioBuffer | null;
  anySoloed: boolean;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer | null,
  color: string,
  dimmed: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (!buffer) {
    // Loading shimmer
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(50, 56, 68, 0.3)");
    gradient.addColorStop(0.5, "rgba(50, 56, 68, 0.6)");
    gradient.addColorStop(1, "rgba(50, 56, 68, 0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const mid = height / 2;

  ctx.globalAlpha = dimmed ? 0.3 : 1;
  ctx.fillStyle = color;

  for (let i = 0; i < width; i++) {
    let min = 1;
    let max = -1;
    const start = i * step;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const val = data[start + j];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    const top = mid + min * mid;
    const barHeight = (max - min) * mid;
    ctx.fillRect(i, top, 1, Math.max(barHeight, 1));
  }

  ctx.globalAlpha = 1;
}

export function StemRow({
  name,
  color,
  soloed,
  muted,
  onSolo,
  onMute,
  audioBuffer,
  anySoloed,
}: StemRowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDimmed = muted || (anySoloed && !soloed);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Match canvas pixel size to display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    drawWaveform(
      canvas,
      audioBuffer,
      color,
      isDimmed,
    );
  }, [audioBuffer, color, isDimmed]);

  return (
    <div
      className="flex h-9 items-center gap-2 pl-4 pr-2"
      style={{ opacity: isDimmed ? 0.5 : 1 }}
    >
      {/* Stem color dot + name */}
      <div
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className={`w-16 shrink-0 truncate text-sm ${
          muted ? "line-through text-muted-foreground" : isDimmed ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {name}
      </span>

      {/* Mini waveform */}
      <canvas
        ref={canvasRef}
        className="h-6 flex-grow rounded"
        style={{ display: "block" }}
      />

      {/* Solo button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-9 shrink-0"
        style={
          soloed
            ? { backgroundColor: color, color: "white" }
            : undefined
        }
        onClick={onSolo}
        title={`Solo ${name}`}
      >
        <Headphones className="size-3.5" />
      </Button>

      {/* Mute button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={`size-9 shrink-0 ${muted ? "bg-destructive text-white hover:bg-destructive/90" : ""}`}
        onClick={onMute}
        title={`Mute ${name}`}
      >
        <VolumeX className="size-3.5" />
      </Button>
    </div>
  );
}
