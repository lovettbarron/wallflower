import type { SpatialJam } from "../types";
import {
  getNodeColor,
  createKeyColorScale,
  createTempoColorScale,
  createDateColorScale,
  createCategoricalColorScale,
} from "./colorScales";

const DEFAULT_RADIUS = 12;
const EXPANDED_RADIUS = 48;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export interface PaintNodeOptions {
  getHoveredNodeId: () => string | null;
  getSelectedNodeId: () => string | null;
  getFocusedNodeId: () => string | null;
  dominantDimension: string;
  colorScales: {
    key: ReturnType<typeof createKeyColorScale>;
    tempo: ReturnType<typeof createTempoColorScale>;
    date: ReturnType<typeof createDateColorScale>;
    categorical: ReturnType<typeof createCategoricalColorScale>;
  };
  isHighContrast: boolean;
  getPeaksCache: () => Record<string, number[]>;
}

function getDisplayName(jam: SpatialJam): string {
  const raw = (jam.filename ?? "").replace(/\.[^.]+$/, "");
  if (!raw || UUID_RE.test(raw)) {
    const d = new Date(jam.createdAt ?? jam.importedAt);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return raw;
}

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

function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillStyle: string,
) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
}

export function paintNode(options: PaintNodeOptions) {
  const {
    getHoveredNodeId,
    getSelectedNodeId,
    getFocusedNodeId,
    dominantDimension,
    colorScales,
    isHighContrast,
    getPeaksCache,
  } = options;

  return (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const jam = node as SpatialJam & { x: number; y: number };
    const hoveredNodeId = getHoveredNodeId();
    const selectedNodeId = getSelectedNodeId();
    const focusedNodeId = getFocusedNodeId();
    const peaksCache = getPeaksCache();

    const isExpanded = jam.id === hoveredNodeId || jam.id === selectedNodeId;
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
      ctx.fillStyle = "transparent";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3 / globalScale;
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = fillColor;
      ctx.fill();

      if (isExpanded) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2 / globalScale;
      } else {
        ctx.strokeStyle = "#3D4556";
        ctx.lineWidth = 1 / globalScale;
      }
      ctx.stroke();
    }

    if (isFocused) {
      ctx.beginPath();
      ctx.arc(jam.x, jam.y, radius + 3 / globalScale, 0, 2 * Math.PI);
      ctx.strokeStyle = "#E8863A";
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    if (isExpanded || (isHighContrast && !isExpanded)) {
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `500 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      if (isExpanded) {
        const peaks = peaksCache[jam.id];
        const waveWidth = (radius * 2) * 0.8;
        const waveHeight = radius * 0.5;
        const waveX = jam.x - waveWidth / 2;
        const waveY = jam.y - radius * 0.35;

        if (peaks && peaks.length > 0) {
          drawMiniWaveform(ctx, peaks, waveX, waveY, waveWidth, waveHeight, fillColor);
        }

        const labelY = jam.y + radius + 6 / globalScale;
        const name = getDisplayName(jam);
        const truncatedName = name.length > 24 ? name.slice(0, 24) + "…" : name;
        drawTextWithShadow(ctx, truncatedName, jam.x, labelY, isHighContrast ? "#FFFFFF" : "#E0E0E0");

        const keyStr = jam.keyName
          ? `${jam.keyName}${jam.keyScale === "minor" ? "m" : ""}`
          : "";
        const bpmStr = jam.tempoBpm ? `${Math.round(jam.tempoBpm)} BPM` : "";
        const metaStr = [keyStr, bpmStr].filter(Boolean).join(" · ");

        if (metaStr) {
          const smallFontSize = Math.max(8, 10 / globalScale);
          ctx.font = `${smallFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
          drawTextWithShadow(ctx, metaStr, jam.x, labelY + fontSize * 1.2, isHighContrast ? "#CCCCCC" : "#9CA3AF");
        }
      }

      if (isHighContrast && !isExpanded) {
        const name = getDisplayName(jam);
        const truncatedName = name.length > 12 ? name.slice(0, 12) + "…" : name;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(truncatedName, jam.x, jam.y + radius + 2 / globalScale);
      }
    }
  };
}
