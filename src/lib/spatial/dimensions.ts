import * as d3 from "d3";
import type { SpatialJam } from "../types";

/**
 * Musical key to numeric value in circle-of-fifths order.
 * Keys that are enharmonic equivalents share the same value.
 */
const KEY_ORDER: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  Gb: 6,
  Db: 7,
  "C#": 7,
  Ab: 8,
  "G#": 8,
  Eb: 9,
  "D#": 9,
  Bb: 10,
  "A#": 10,
  F: 11,
};

/** Extract a numeric value from a jam for a given dimension. */
export function getDimensionValue(jam: SpatialJam, dimension: string): number {
  switch (dimension) {
    case "key":
      return KEY_ORDER[jam.keyName ?? "C"] ?? 0;
    case "tempo":
      return jam.tempoBpm ?? 120;
    case "date":
      return new Date(jam.createdAt ?? jam.importedAt).getTime();
    case "instruments":
      return jam.instruments.length;
    case "collaborators":
      return jam.collaborators.length;
    default:
      return 0;
  }
}

/** Create a d3 forceX for a dimension. Strength proportional to weight/100. */
export function createDimensionForceX(
  dimension: string,
  weight: number,
  jams: SpatialJam[],
  canvasWidth: number,
) {
  const values = jams.map((j) => getDimensionValue(j, dimension));
  const extent = d3.extent(values) as [number, number];
  const scale = d3
    .scaleLinear()
    .domain(extent)
    .range([canvasWidth * 0.1, canvasWidth * 0.9]);

  return d3
    .forceX((node: any) => scale(getDimensionValue(node, dimension)))
    .strength((weight / 100) * 0.6);
}

/** Create a d3 forceY for a dimension. Strength proportional to weight/100. */
export function createDimensionForceY(
  dimension: string,
  weight: number,
  jams: SpatialJam[],
  canvasHeight: number,
) {
  const values = jams.map((j) => getDimensionValue(j, dimension));
  const extent = d3.extent(values) as [number, number];
  const scale = d3
    .scaleLinear()
    .domain(extent)
    .range([canvasHeight * 0.1, canvasHeight * 0.9]);

  return d3
    .forceY((node: any) => scale(getDimensionValue(node, dimension)))
    .strength((weight / 100) * 0.6);
}
