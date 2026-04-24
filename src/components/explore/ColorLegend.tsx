"use client";

import { useMemo } from "react";
import { useExploreStore, getDominantDimension } from "@/lib/stores/explore";

interface ColorLegendProps {
  categories: string[];
}

/** Circle-of-fifths key names for the key legend. */
const KEY_NAMES = [
  "C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F",
];

/**
 * Shows the active dimension's color scale (per D-05).
 * The dominant dimension (highest weight) drives which legend is shown.
 */
export function ColorLegend({ categories }: ColorLegendProps) {
  const weights = useExploreStore((s) => s.weights);
  const dominant = getDominantDimension(weights);

  // Check if all weights are zero
  const allZero = Object.values(weights).every((v) => v === 0);

  const keyHues = useMemo(
    () => KEY_NAMES.map((_, i) => `hsl(${(i * 30) % 360}, 70%, 55%)`),
    [],
  );

  if (allZero) {
    return (
      <div className="text-xs text-muted-foreground">
        No dimension selected
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {dominant === "key" && (
        <>
          <span className="text-xs text-muted-foreground">
            Key -- circle of fifths
          </span>
          <div className="flex h-6 w-full overflow-hidden rounded">
            {KEY_NAMES.map((key, i) => (
              <div
                key={key}
                className="flex-1"
                style={{ background: keyHues[i] }}
                title={key}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>C</span>
            <span>F</span>
          </div>
        </>
      )}

      {dominant === "tempo" && (
        <>
          <span className="text-xs text-muted-foreground">
            Tempo -- slow to fast
          </span>
          <div
            className="h-6 w-full rounded"
            style={{
              background:
                "linear-gradient(to right, hsl(220, 60%, 50%), hsl(30, 70%, 55%), hsl(0, 80%, 55%))",
            }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>40</span>
            <span>200+</span>
          </div>
        </>
      )}

      {dominant === "date" && (
        <>
          <span className="text-xs text-muted-foreground">
            Date -- oldest to newest
          </span>
          <div
            className="h-6 w-full rounded"
            style={{
              background:
                "linear-gradient(to right, hsl(220, 10%, 35%), hsl(28, 90%, 58%))",
            }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Oldest</span>
            <span>Newest</span>
          </div>
        </>
      )}

      {dominant === "instruments" && (
        <>
          <span className="text-xs text-muted-foreground">Gear</span>
          <div className="flex flex-wrap gap-1.5">
            {categories
              .filter((c) =>
                // Show instrument categories only
                true
              )
              .slice(0, 8)
              .map((cat, i) => (
                <div key={cat} className="flex items-center gap-1">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{
                      background: getCategoricalColor(i),
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {cat}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {dominant === "collaborators" && (
        <>
          <span className="text-xs text-muted-foreground">
            Collaborators
          </span>
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 8).map((cat, i) => (
              <div key={cat} className="flex items-center gap-1">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{
                    background: getCategoricalColor(i),
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {cat}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const CATEGORICAL_COLORS = [
  "hsl(28, 70%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(280, 50%, 55%)",
  "hsl(45, 80%, 50%)",
  "hsl(340, 60%, 50%)",
  "hsl(150, 50%, 45%)",
  "hsl(200, 70%, 50%)",
  "hsl(60, 60%, 50%)",
];

function getCategoricalColor(index: number): string {
  return CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
}
