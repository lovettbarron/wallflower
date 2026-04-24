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
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weights = useExploreStore((s) => s.weights);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const focusedNodeIdRef = useRef<string | null>(null);
  const peaksCacheRef = useRef<Record<string, number[]>>({});
  const setPeaks = useExploreStore((s) => s.setPeaks);
  const setHoveredNode = useExploreStore((s) => s.setHoveredNode);
  const setSelectedNode = useExploreStore((s) => s.setSelectedNode);

  // Keep refs in sync with store
  useExploreStore.subscribe((s) => {
    hoveredNodeIdRef.current = s.hoveredNodeId;
    selectedNodeIdRef.current = s.selectedNodeId;
    focusedNodeIdRef.current = s.focusedNodeId;
    peaksCacheRef.current = s.peaksCache;
  });

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

    const sorted = Object.entries(weights)
      .filter(([, w]) => w > 0)
      .sort(([, a], [, b]) => b - a);

    const xDim = sorted[0]?.[0] ?? "key";
    const xWeight = sorted[0]?.[1] ?? 50;
    const yDim = sorted[1]?.[0] ?? "tempo";
    const yWeight = sorted[1]?.[1] ?? 50;

    fg.d3Force(
      "x",
      createDimensionForceX(xDim, xWeight, jams, width),
    );
    fg.d3Force(
      "y",
      createDimensionForceY(yDim, yWeight, jams, height),
    );

    fg.d3Force("charge", d3.forceManyBody().strength(-15));

    fg.d3ReheatSimulation();
  }, [weights, graphData.nodes]);

  // Debounced hover handler
  const handleNodeHover = useCallback(
    (node: any) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      if (node) {
        hoverTimerRef.current = setTimeout(() => {
          setHoveredNode(node.id);
          if (!peaksCacheRef.current[node.id]) {
            getPeaks(node.id)
              .then((peakData) => {
                const flatPeaks = peakData.peaks.map(([, max]) => max);
                setPeaks(node.id, flatPeaks);
              })
              .catch(() => {});
          }
          onNodeHover(node);
        }, 50);
      } else {
        hoverTimerRef.current = setTimeout(() => {
          setHoveredNode(null);
          onNodeHover(null);
        }, 30);
      }
    },
    [setPeaks, setHoveredNode, onNodeHover],
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

  // Stable painter — reads mutable state via refs, never recreated on hover/select
  const nodeCanvasObject = useMemo(
    () =>
      paintNode({
        getHoveredNodeId: () => hoveredNodeIdRef.current,
        getSelectedNodeId: () => selectedNodeIdRef.current,
        getFocusedNodeId: () => focusedNodeIdRef.current,
        dominantDimension,
        colorScales,
        isHighContrast,
        getPeaksCache: () => peaksCacheRef.current,
      }),
    [dominantDimension, colorScales, isHighContrast],
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
