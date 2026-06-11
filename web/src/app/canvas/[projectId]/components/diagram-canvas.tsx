"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
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
import { useSchema } from "@/hooks/use-schema";
import type {
  TableNodeData,
  RelationEdgeData,
  Table,
  DatabaseProvider,
  Relation,
} from "@/lib/types";
import TableNode from "./table-node";
import RelationEdge from "./relation-edge";
import CanvasToolbar from "./canvas-toolbar";
import CanvasSidebar from "./canvas-sidebar";
import ExportPreviewDrawer from "./export-preview-drawer";
import InspectorPanel from "./inspector-panel";

const nodeTypes: NodeTypes = { tableNode: TableNode };
const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

const emptySubscribe = () => () => {};

export default function DiagramCanvas() {
  const { projectId } = useParams<{ projectId: string }>();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<
    Edge<RelationEdgeData>
  >([]);
  const [graphReady, setGraphReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeExport, setActiveExport] = useState<
    "png" | "prisma" | "drizzle" | null
  >(null);
  const [selectedTable, setSelectedTable] = useState<{
    table: Table;
    provider: DatabaseProvider;
  } | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(
    null,
  );

  const { data: schema, isLoading, isError } = useSchema(projectId);

  const provider = useSyncExternalStore<DatabaseProvider>(
    emptySubscribe,
    () =>
      (sessionStorage.getItem("nexusql_provider") as DatabaseProvider) ??
      "postgres",
    () => "postgres",
  );

  useEffect(() => {
    if (!schema) return;
    buildCanvasGraph(schema, provider).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
      setGraphReady(true);
    });
  }, [schema, provider, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TableNodeData>) => {
      setSelectedRelation(null);
      setSelectedTable({
        table: node.data.table,
        provider: node.data.provider,
      });
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    },
    [setEdges],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge<RelationEdgeData>) => {
      setSelectedTable(null);
      if (edge.data?.relation) setSelectedRelation(edge.data.relation);
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    },
    [setNodes],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedTable(null);
    setSelectedRelation(null);
  }, []);

  const handleLayoutApply = useCallback(
    (laid: Node<TableNodeData>[]) => setNodes(laid),
    [setNodes],
  );

  if (isLoading || !graphReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          <span className="text-sm text-text-tertiary">Arranging schema…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas-bg">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-text-tertiary">
            Failed to load schema.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <button
        onClick={() => setSidebarOpen(true)}
        className="absolute top-4 left-4 z-10 flex items-center justify-center w-9 h-9 rounded-xl bg-surface-1 border-[0.5px] border-border shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
        aria-label="Open sidebar">
        <SlidersHorizontal size={15} aria-hidden />
      </button>

      <CanvasToolbar projectId={projectId} />

      <CanvasSidebar
        open={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false);
          setActiveExport(null);
        }}
        onLayoutApply={handleLayoutApply}
        onSelectExport={(type) => setActiveExport(type)}
        activeExport={activeExport}
      />

      <ExportPreviewDrawer
        key={activeExport}
        type={activeExport}
        sidebarOpen={sidebarOpen}
        onClose={() => setActiveExport(null)}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.38, includeHiddenNodes: false }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}>
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-dot)"
        />
        <InspectorPanel
          table={selectedTable?.table ?? null}
          provider={selectedTable?.provider ?? null}
          relation={selectedRelation}
          projectId={projectId}
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
