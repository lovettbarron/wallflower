import * as d3 from "d3";

/**
 * Key: circle-of-fifths hue rotation.
 * 12 keys mapped to evenly-spaced hues around the color wheel.
 */
export function createKeyColorScale(): d3.ScaleOrdinal<string, string> {
  const keys = [
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "Db",
    "Ab",
    "Eb",
    "Bb",
    "F",
  ];
  const hues = keys.map((_, i) => `hsl(${(i * 30) % 360}, 70%, 55%)`);
  return d3.scaleOrdinal<string, string>().domain(keys).range(hues);
}

/**
 * Tempo: blue (slow) to red (fast).
 * Three-stop gradient: 40 BPM -> 120 BPM -> 200 BPM.
 */
export function createTempoColorScale(): d3.ScaleLinear<string, string> {
  return d3
    .scaleLinear<string>()
    .domain([40, 120, 200])
    .range([
      "hsl(220, 60%, 50%)",
      "hsl(30, 70%, 55%)",
      "hsl(0, 80%, 55%)",
    ]);
}

/**
 * Date: faded grey-blue (old) to accent amber (new).
 */
export function createDateColorScale(
  minDate: Date,
  maxDate: Date,
): d3.ScaleTime<string, string> {
  return d3
    .scaleTime<string>()
    .domain([minDate, maxDate])
    .range(["hsl(220, 10%, 35%)", "hsl(28, 90%, 58%)"]);
}

/** Categorical palette for instruments/collaborators (up to 8 distinct hues). */
const CATEGORICAL_PALETTE = [
  "hsl(28, 70%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(280, 50%, 55%)",
  "hsl(45, 80%, 50%)",
  "hsl(340, 60%, 50%)",
  "hsl(150, 50%, 45%)",
  "hsl(200, 70%, 50%)",
  "hsl(60, 60%, 50%)",
];

export function createCategoricalColorScale(
  categories: string[],
): d3.ScaleOrdinal<string, string> {
  return d3
    .scaleOrdinal<string, string>()
    .domain(categories)
    .range(CATEGORICAL_PALETTE);
}

/** Returns the right color for a node based on dominant dimension. */
export function getNodeColor(
  jam: {
    keyName?: string | null;
    tempoBpm?: number | null;
    createdAt: string;
    instruments: string[];
    collaborators: string[];
  },
  dimension: string,
  scales: {
    key: ReturnType<typeof createKeyColorScale>;
    tempo: ReturnType<typeof createTempoColorScale>;
    date: ReturnType<typeof createDateColorScale>;
    categorical: ReturnType<typeof createCategoricalColorScale>;
  },
): string {
  switch (dimension) {
    case "key":
      return scales.key(jam.keyName ?? "C");
    case "tempo":
      return scales.tempo(jam.tempoBpm ?? 120);
    case "date":
      return scales.date(new Date(jam.createdAt));
    case "instruments":
      return jam.instruments[0]
        ? scales.categorical(jam.instruments[0])
        : "hsl(220, 10%, 50%)";
    case "collaborators":
      return jam.collaborators[0]
        ? scales.categorical(jam.collaborators[0])
        : "hsl(220, 10%, 50%)";
    default:
      return "hsl(28, 90%, 58%)";
  }
}
