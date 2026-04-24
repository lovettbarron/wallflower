"use client";

import { Slider } from "@/components/ui/slider";
import {
  useExploreStore,
  type DimensionWeights,
} from "@/lib/stores/explore";
import { ColorLegend } from "./ColorLegend";

const DIMENSION_CONFIG: {
  key: keyof DimensionWeights;
  label: string;
}[] = [
  { key: "key", label: "Key" },
  { key: "tempo", label: "Tempo" },
  { key: "date", label: "Date" },
  { key: "instruments", label: "Gear" },
  { key: "collaborators", label: "Collaborators" },
];

interface DimensionPanelProps {
  /** All unique categories for categorical color scales. */
  categories: string[];
}

/**
 * Right sidebar with dimension weight sliders (per D-03).
 * Each slider controls how strongly that musical dimension
 * influences node clustering in the spatial map.
 * Fixed width 280px with secondary background.
 */
export function DimensionPanel({ categories }: DimensionPanelProps) {
  const weights = useExploreStore((s) => s.weights);
  const setWeight = useExploreStore((s) => s.setWeight);

  return (
    <aside
      aria-label="Dimension controls"
      className="w-[280px] shrink-0 overflow-y-auto bg-[#1D2129] p-4 pt-6"
    >
      <h2 className="mb-6 text-[20px] font-semibold text-foreground">
        Dimensions
      </h2>

      <div className="flex flex-col gap-5">
        {DIMENSION_CONFIG.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                className="text-xs text-muted-foreground"
                htmlFor={`dim-${key}`}
              >
                {label}
              </label>
              <span className="text-xs text-muted-foreground">
                {weights[key]}
              </span>
            </div>
            <Slider
              id={`dim-${key}`}
              aria-label={`${label} weight`}
              min={0}
              max={100}
              step={5}
              value={[weights[key]]}
              onValueChange={(val: number | readonly number[]) => {
                const v = Array.isArray(val) ? val[0] : val;
                setWeight(key, v);
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <ColorLegend categories={categories} />
      </div>
    </aside>
  );
}
