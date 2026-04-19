"use client";

import { useRef, useEffect, useCallback } from "react";
import { useRecordingStore } from "@/lib/stores/recording";

interface RecordingWaveformProps {
  height?: number;
  className?: string;
}

export function RecordingWaveform({
  height = 200,
  className,
}: RecordingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDrawnLengthRef = useRef(0);

  const levelHistory = useRecordingStore((s) => s.levelHistory);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Resize canvas buffer if needed
    if (
      canvas.width !== displayWidth * dpr ||
      canvas.height !== displayHeight * dpr
    ) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (levelHistory.length === 0) {
      // Show "Preparing..." text
      ctx.fillStyle = "hsl(220, 10%, 50%)";
      ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Preparing...", displayWidth / 2, displayHeight / 2);
      return;
    }

    const barWidth = 3;
    const barGap = 1;
    const barStep = barWidth + barGap;
    const maxBars = Math.floor(displayWidth / barStep);

    // Take the most recent values that fit on screen
    const visibleHistory = levelHistory.slice(-maxBars);
    const startX = displayWidth - visibleHistory.length * barStep;

    ctx.fillStyle = "#E53E3E";

    for (let i = 0; i < visibleHistory.length; i++) {
      const rmsDb = visibleHistory[i];
      // Convert dB to linear height: -60dB = 0, 0dB = 1
      const linear = Math.max(0, Math.min(1, (rmsDb + 60) / 60));
      const barHeight = Math.max(1, linear * displayHeight * 0.9);
      const x = startX + i * barStep;
      const y = (displayHeight - barHeight) / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [levelHistory]);

  useEffect(() => {
    // Only redraw when levelHistory changes
    if (levelHistory.length !== lastDrawnLengthRef.current) {
      lastDrawnLengthRef.current = levelHistory.length;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        draw();
        rafRef.current = null;
      });
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [levelHistory, draw]);

  // Redraw on mount and resize
  useEffect(() => {
    draw();

    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: `${height}px`,
        display: "block",
      }}
    />
  );
}
