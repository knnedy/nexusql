"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SlidersHorizontal } from "lucide-react";
import { buildCanvasGraph } from "@/lib/canvas-utils";
import { MOCK_SCHEMA, MOCK_PROVIDER } from "@/lib/mock-schema";
import type { TableNodeData, RelationEdgeData } from "@/lib/types";
import TableNode from "./table-node";
import RelationEdge from "./relation-edge";
import CanvasToolbar from "./canvas-toolbar";
import CanvasSidebar from "./canvas-sidebar";

const nodeTypes: NodeTypes = { tableNode: TableNode };
const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export default function DiagramCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<
    Edge<RelationEdgeData>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    buildCanvasGraph(MOCK_SCHEMA, MOCK_PROVIDER).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
      setIsLoading(false);
    });
  }, [setNodes, setEdges]);

  const handleLayoutApply = useCallback(
    (laid: Node<TableNodeData>[]) => {
      setNodes(laid);
    },
    [setNodes],
  );

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          <span className="text-sm text-text-tertiary">Arranging schema…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Sidebar trigger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="absolute top-4 left-4 z-10 flex items-center justify-center w-9 h-9 rounded-xl bg-surface-1 border-[0.5px] border-border shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
        aria-label="Open sidebar">
        <SlidersHorizontal size={15} aria-hidden />
      </button>

      <CanvasToolbar />

      <CanvasSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        nodes={nodes}
        edges={edges}
        onLayoutApply={handleLayoutApply}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}>
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-dot)"
        />
        <MiniMap
          nodeColor={() => getCssVar("--minimap-node")}
          maskColor={getCssVar("--minimap-mask")}
          style={{
            background: getCssVar("--minimap-bg"),
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        />
      </ReactFlow>
    </div>
  );
}
