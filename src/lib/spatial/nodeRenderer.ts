import type { SpatialJam } from "../types";
import {
  getNodeColor,
  createKeyColorScale,
  createTempoColorScale,
  createDateColorScale,
  createCategoricalColorScale,
} from "./colorScales";

/** Default node radius in pixels. */
const DEFAULT_RADIUS = 12;
/** Expanded node radius for hover/selected state (per D-01). */
const EXPANDED_RADIUS = 48;

interface PaintNodeOptions {
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  dominantDimension: string;
  colorScales: {
    key: ReturnType<typeof createKeyColorScale>;
    tempo: ReturnType<typeof createTempoColorScale>;
    date: ReturnType<typeof createDateColorScale>;
    categorical: ReturnType<typeof createCategoricalColorScale>;
  };
  isHighContrast: boolean;
  peaksCache: Record<string, number[]>;
}

/**
 * Draw a mini waveform thumbnail inside an expanded node.
 * Downsamples peaks to ~40 bars for the thumbnail.
 */
export function drawMiniWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  if (!peaks || peaks.length === 0) return;

  const barCount = 40;
  const binSize = Math.max(1, Math.floor(peaks.length / barCount));
  const bars: number[] = [];

  for (let i = 0; i < barCount && i * binSize < peaks.length; i++) {
    let maxVal = 0;
    for (let j = 0; j < binSize && i * binSize + j < peaks.length; j++) {
      maxVal = Math.max(maxVal, Math.abs(peaks[i * binSize + j]));
    }
    bars.push(maxVal);
  }

  const maxPeak = Math.max(...bars, 0.01);
  const barWidth = width / bars.length;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.4;

  for (let i = 0; i < bars.length; i++) {
    const normalized = bars[i] / maxPeak;
    const barHeight = normalized * height;
    const bx = x + i * barWidth;
    const by = y + (height - barHeight) / 2;
    ctx.fillRect(bx, by, Math.max(barWidth - 1, 1), barHeight);
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Factory function that returns a `nodeCanvasObject`-compatible painter.
 * Handles default circles, expanded nodes with waveform thumbnails,
 * high contrast mode, and keyboard focus indicators.
 */
export function paintNode(options: PaintNodeOptions) {
  const {
    hoveredNodeId,
    selectedNodeId,
    focusedNodeId,
    dominantDimension,
    colorScales,
    isHighContrast,
    peaksCache,
  } = options;

  return (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const jam = node as SpatialJam & { x: number; y: number };
    const isExpanded =
      jam.id === hoveredNodeId || jam.id === selectedNodeId;
    const isFocused = jam.id === focusedNodeId;

    const fillColor = getNodeColor(
      {
        keyName: jam.keyName,
        tempoBpm: jam.tempoBpm,
        createdAt: jam.createdAt ?? jam.importedAt,
        instruments: jam.instruments,
        collaborators: jam.collaborators,
      },
      dominantDimension,
      colorScales,
    );

    const radius = (isExpanded ? EXPANDED_RADIUS : DEFAULT_RADIUS) / globalScale;

    ctx.beginPath();
    ctx.arc(jam.x, jam.y, radius, 0, 2 * Math.PI);

    if (isHighContrast) {
      // D-10: outlined only, no fill, thick border
      ctx.fillStyle = "transparent";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3 / globalScale;
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Stroke
      if (isExpanded) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2 / globalScale;
      } else {
        ctx.strokeStyle = "#3D4556";
        ctx.lineWidth = 1 / globalScale;
      }
      ctx.stroke();
    }

    // Keyboard focus ring
    if (isFocused) {
      ctx.beginPath();
      ctx.arc(jam.x, jam.y, radius + 3 / globalScale, 0, 2 * Math.PI);
      ctx.strokeStyle = "#E8863A";
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    // Expanded state: waveform thumbnail + metadata (per D-01)
    if (isExpanded || (isHighContrast && true)) {
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      if (isExpanded) {
        // Draw waveform thumbnail if peaks available
        const peaks = peaksCache[jam.id];
        const waveWidth = (radius * 2) * 0.8;
        const waveHeight = radius * 0.5;
        const waveX = jam.x - waveWidth / 2;
        const waveY = jam.y - radius * 0.5;

        if (peaks && peaks.length > 0) {
          drawMiniWaveform(ctx, peaks, waveX, waveY, waveWidth, waveHeight, fillColor);
        } else {
          // Placeholder line
          ctx.strokeStyle = fillColor;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1 / globalScale;
          ctx.beginPath();
          ctx.moveTo(waveX, jam.y - radius * 0.25);
          ctx.lineTo(waveX + waveWidth, jam.y - radius * 0.25);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        // Jam name (truncated to 16 chars)
        const name = (jam.filename ?? "Untitled").replace(/\.[^.]+$/, "");
        const truncatedName =
          name.length > 16 ? name.slice(0, 16) + "..." : name;

        ctx.fillStyle = isHighContrast ? "#FFFFFF" : "#E0E0E0";
        ctx.fillText(truncatedName, jam.x, jam.y + radius * 0.15);

        // Key + BPM text
        const keyStr = jam.keyName
          ? `${jam.keyName}${jam.keyScale === "minor" ? "m" : ""}`
          : "";
        const bpmStr = jam.tempoBpm ? `${Math.round(jam.tempoBpm)} BPM` : "";
        const metaStr = [keyStr, bpmStr].filter(Boolean).join(" / ");

        if (metaStr) {
          ctx.fillStyle = isHighContrast ? "#CCCCCC" : "#9CA3AF";
          const smallFontSize = Math.max(8, 10 / globalScale);
          ctx.font = `${smallFontSize}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillText(metaStr, jam.x, jam.y + radius * 0.15 + fontSize * 1.3);
        }
      }

      // High contrast always-visible labels (per D-10)
      if (isHighContrast && !isExpanded) {
        const name = (jam.filename ?? "Untitled").replace(/\.[^.]+$/, "");
        const truncatedName =
          name.length > 12 ? name.slice(0, 12) + "..." : name;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(truncatedName, jam.x, jam.y + radius + 2 / globalScale);
      }
    }
  };
}
