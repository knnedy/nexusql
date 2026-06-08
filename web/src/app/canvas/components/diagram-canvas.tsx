"use client";

import { useEffect, useState } from "react";
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
import { SmartStepEdge } from "@tisoap/react-flow-smart-edge";
import "@xyflow/react/dist/style.css";
import { buildCanvasGraph } from "@/lib/canvas-utils";
import { MOCK_SCHEMA, MOCK_PROVIDER } from "@/lib/mock-schema";
import type { TableNodeData, RelationEdgeData } from "@/lib/types";
import TableNode from "./table-node";

// Stable references outside component
const nodeTypes: NodeTypes = { tableNode: TableNode };
const edgeTypes: EdgeTypes = { relationEdge: SmartStepEdge };

export default function DiagramCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<
    Edge<RelationEdgeData>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    buildCanvasGraph(MOCK_SCHEMA, MOCK_PROVIDER).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
      setIsLoading(false);
    });
  }, [setNodes, setEdges]);

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
    <div className="w-full h-full">
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
          nodeColor="var(--minimap-node)"
          maskColor="var(--minimap-mask)"
          style={{ background: "var(--minimap-bg)" }}
        />
      </ReactFlow>
    </div>
  );
}
