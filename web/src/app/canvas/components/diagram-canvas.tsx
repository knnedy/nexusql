"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildCanvasGraph, reapplyLayout } from "@/lib/canvas-utils";
import { MOCK_SCHEMA, MOCK_PROVIDER } from "@/lib/mock-schema";
import type { TableNodeData, RelationEdgeData } from "@/lib/types";
import type { Node, Edge } from "@xyflow/react";
import TableNode from "./table-node";
import RelationEdge from "./relation-edge";

// Stable references — defined outside component to prevent re-registration
// on every render which causes React Flow to flash
const nodeTypes: NodeTypes = { tableNode: TableNode };
const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };

export default function DiagramCanvas() {
  // Build the initial graph from mock schema
  const initialGraph = useMemo(
    () => buildCanvasGraph(MOCK_SCHEMA, MOCK_PROVIDER),
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(
    initialGraph.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<
    Edge<RelationEdgeData>
  >(initialGraph.edges);

  // Re-runs dagre and updates node positions
  const handleAutoLayout = useCallback(() => {
    setNodes((current) => reapplyLayout(current, edges));
  }, [edges, setNodes]);

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
