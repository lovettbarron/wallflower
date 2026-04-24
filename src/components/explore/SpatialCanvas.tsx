"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import * as d3 from "d3";
import { useExploreStore, getDominantDimension } from "@/lib/stores/explore";
import { useHighContrast } from "@/components/accessibility";
import { paintNode } from "@/lib/spatial/nodeRenderer";
import {
  createDimensionForceX,
  createDimensionForceY,
} from "@/lib/spatial/dimensions";
import {
  createKeyColorScale,
  createTempoColorScale,
  createDateColorScale,
  createCategoricalColorScale,
} from "@/lib/spatial/colorScales";
import { getPeaks } from "@/lib/tauri";
import type { SpatialJam } from "@/lib/types";

// react-force-graph-2d uses Canvas -- must be dynamically imported with SSR disabled
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export interface GraphNode extends SpatialJam {
  x?: number;
  y?: number;
}

interface SpatialCanvasProps {
  graphData: { nodes: GraphNode[]; links: never[] };
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
}

export function SpatialCanvas({
  graphData,
  onNodeClick,
  onNodeHover,
}: SpatialCanvasProps) {
  const fgRef = useRef<any>(null);
  const isHighContrast = useHighContrast();

  const weights = useExploreStore((s) => s.weights);
  const hoveredNodeId = useExploreStore((s) => s.hoveredNodeId);
  const selectedNodeId = useExploreStore((s) => s.selectedNodeId);
  const focusedNodeId = useExploreStore((s) => s.focusedNodeId);
  const peaksCache = useExploreStore((s) => s.peaksCache);
  const setPeaks = useExploreStore((s) => s.setPeaks);
  const setHoveredNode = useExploreStore((s) => s.setHoveredNode);
  const setSelectedNode = useExploreStore((s) => s.setSelectedNode);

  // Build color scales
  const colorScales = useMemo(() => {
    const dates = graphData.nodes
      .map((n) => new Date(n.createdAt ?? n.importedAt))
      .filter((d) => !isNaN(d.getTime()));
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();

    const allInstruments = [
      ...new Set(graphData.nodes.flatMap((n) => n.instruments)),
    ];
    const allCollaborators = [
      ...new Set(graphData.nodes.flatMap((n) => n.collaborators)),
    ];

    return {
      key: createKeyColorScale(),
      tempo: createTempoColorScale(),
      date: createDateColorScale(minDate, maxDate),
      categorical: createCategoricalColorScale([
        ...allInstruments,
        ...allCollaborators,
      ]),
    };
  }, [graphData.nodes]);

  const dominantDimension = getDominantDimension(weights);

  // Reconfigure forces when weights change
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    const jams = graphData.nodes as SpatialJam[];
    const width = 800;
    const height = 600;

    // Find top two non-zero dimensions for X and Y axes
    const sorted = Object.entries(weights)
      .filter(([, w]) => w > 0)
      .sort(([, a], [, b]) => b - a);

    const xDim = sorted[0]?.[0] ?? "key";
    const xWeight = sorted[0]?.[1] ?? 50;
    const yDim = sorted[1]?.[0] ?? "tempo";
    const yWeight = sorted[1]?.[1] ?? 50;

    // Apply positional forces
    fg.d3Force(
      "x",
      createDimensionForceX(xDim, xWeight, jams, width),
    );
    fg.d3Force(
      "y",
      createDimensionForceY(yDim, yWeight, jams, height),
    );

    // Charge force for spacing
    fg.d3Force("charge", d3.forceManyBody().strength(-30));

    fg.d3ReheatSimulation();
  }, [weights, graphData.nodes]);

  // Load peaks when hovering a node
  const handleNodeHover = useCallback(
    (node: any) => {
      if (node) {
        setHoveredNode(node.id);
        // Lazy-load peaks for waveform thumbnail
        if (!peaksCache[node.id]) {
          getPeaks(node.id)
            .then((peakData) => {
              // Flatten the [min, max] tuples to a single array of max values
              const flatPeaks = peakData.peaks.map(([, max]) => max);
              setPeaks(node.id, flatPeaks);
            })
            .catch(() => {
              // Peaks may not be available -- fail silently
            });
        }
        onNodeHover(node);
      } else {
        setHoveredNode(null);
        onNodeHover(null);
      }
    },
    [peaksCache, setPeaks, setHoveredNode, onNodeHover],
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      onNodeClick(node);
    },
    [onNodeClick],
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Custom node painter
  const nodeCanvasObject = useMemo(
    () =>
      paintNode({
        hoveredNodeId,
        selectedNodeId,
        focusedNodeId,
        dominantDimension,
        colorScales,
        isHighContrast,
        peaksCache,
      }),
    [
      hoveredNodeId,
      selectedNodeId,
      focusedNodeId,
      dominantDimension,
      colorScales,
      isHighContrast,
      peaksCache,
    ],
  );

  return (
    <div className="relative h-full w-full" data-testid="spatial-canvas">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        cooldownTicks={300}
        d3AlphaDecay={0.02}
        backgroundColor="#151921"
        nodeId="id"
        nodeLabel={() => ""}
      />
    </div>
  );
}
