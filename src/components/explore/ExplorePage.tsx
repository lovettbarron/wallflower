"use client";

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSpatialJams } from "@/lib/tauri";
import { useExploreStore } from "@/lib/stores/explore";
import { useLibraryStore } from "@/lib/stores/library";
import { SpatialCanvas, type GraphNode } from "./SpatialCanvas";
import { SpatialAccessibilityOverlay } from "./SpatialAccessibilityOverlay";
import { DimensionPanel } from "./DimensionPanel";

/**
 * Explore tab page orchestrating the spatial canvas, dimension panel,
 * and accessibility overlay. Fetches spatial jam data and transforms
 * it into the graph format consumed by react-force-graph-2d.
 */
export function ExplorePage() {
  const { data: jams = [], isLoading } = useQuery({
    queryKey: ["spatial-jams"],
    queryFn: getSpatialJams,
  });

  const selectedNodeId = useExploreStore((s) => s.selectedNodeId);
  const setSelectedNode = useExploreStore((s) => s.setSelectedNode);
  const focusedNodeId = useExploreStore((s) => s.focusedNodeId);
  const setFocusedNode = useExploreStore((s) => s.setFocusedNode);
  const setSelectedJam = useLibraryStore((s) => s.setSelectedJam);

  // Transform SpatialJam[] into graph data (no links -- clustering via positional forces only)
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = jams.map((jam) => ({
      ...jam,
    }));
    return { nodes, links: [] as never[] };
  }, [jams]);

  // Collect all unique categories for categorical color scales
  const categories = useMemo(() => {
    const instruments = new Set<string>();
    const collaborators = new Set<string>();
    for (const jam of jams) {
      jam.instruments.forEach((i) => instruments.add(i));
      jam.collaborators.forEach((c) => collaborators.add(c));
    }
    return [...instruments, ...collaborators];
  }, [jams]);

  // First click selects, second click on same node navigates to detail
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (selectedNodeId === node.id) {
        // Second click -- navigate to jam detail
        setSelectedJam(node.id);
      } else {
        setSelectedNode(node.id);
      }
    },
    [selectedNodeId, setSelectedNode, setSelectedJam],
  );

  const handleNodeHover = useCallback((_node: GraphNode | null) => {
    // Hover handling is done inside SpatialCanvas via store
  }, []);

  const handleNodeFocus = useCallback(
    (id: string) => {
      setFocusedNode(id);
    },
    [setFocusedNode],
  );

  const handleNodeActivate = useCallback(
    (id: string) => {
      if (selectedNodeId === id) {
        setSelectedJam(id);
      } else {
        setSelectedNode(id);
      }
    },
    [selectedNodeId, setSelectedNode, setSelectedJam],
  );

  const handleDeselect = useCallback(() => {
    setSelectedNode(null);
    setFocusedNode(null);
  }, [setSelectedNode, setFocusedNode]);

  // Count jams with analysis data (have key or tempo)
  const analyzedCount = jams.filter(
    (j) => j.keyName != null || j.tempoBpm != null,
  ).length;

  // Empty state: fewer than 3 jams with analysis data
  if (!isLoading && analyzedCount < 3) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-12 py-24">
        <h2 className="text-xl font-semibold text-foreground">
          Not enough jams to explore
        </h2>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          The spatial explorer needs at least 3 jams with analysis data to
          create a meaningful map. Import and analyze more jams to unlock
          this view.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading spatial data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Spatial map canvas */}
      <div className="relative flex-1">
        <SpatialCanvas
          graphData={graphData}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />
        <SpatialAccessibilityOverlay
          nodes={graphData.nodes}
          focusedNodeId={focusedNodeId}
          onNodeFocus={handleNodeFocus}
          onNodeActivate={handleNodeActivate}
          onDeselect={handleDeselect}
        />
      </div>

      {/* Dimension control panel */}
      <DimensionPanel categories={categories} />
    </div>
  );
}
