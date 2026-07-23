"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getNodesBounds,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { SlidersHorizontal } from "lucide-react";
import { buildCanvasGraph } from "@/lib/canvas-utils";
import { useSchema } from "@/hooks/use-schema";
import TableNode from "./components/table-node";
import RelationEdge from "./components/relation-edge";
import CanvasToolbar from "./components/canvas-toolbar";
import CanvasSidebar from "./components/canvas-sidebar";
import ExportPreviewDrawer from "./components/export-preview-drawer";
import InspectorPanel from "./components/inspector-panel";
import SqlConsoleModal from "./components/sql-console-modal";
import { RelationEdgeData, TableNodeData } from "@/lib/types/canvas";
import { Relation, Table } from "@/lib/types/schema";
import { DatabaseProvider } from "@/lib/types/provider";
import SeedDataModal from "./components/seed-data-modal";

const nodeTypes: NodeTypes = { tableNode: TableNode };
const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

const emptySubscribe = () => () => {};

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
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
  const [seedOpen, setSeedOpen] = useState(false);
  const [sqlConsoleOpen, setSqlConsoleOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<{
    table: Table;
    provider: DatabaseProvider;
  } | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(
    null,
  );
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { getViewport, setViewport, getNodes } = useReactFlow();

  const { data: schema, isLoading, isError } = useSchema();

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

  const handleGeneratePng = useCallback(async () => {
    if (!canvasWrapperRef.current) return;

    setIsGeneratingPng(true);
    setPngDataUrl(null);

    const wrapper = canvasWrapperRef.current;
    const previousViewport = getViewport();
    const allNodes = getNodes();

    const previousStyle = {
      width: wrapper.style.width,
      height: wrapper.style.height,
      position: wrapper.style.position,
    };

    try {
      const bounds = getNodesBounds(allNodes);
      const padding = 60;
      const exportZoom = 1;

      const imageWidth = Math.ceil(bounds.width * exportZoom + padding * 2);
      const imageHeight = Math.ceil(bounds.height * exportZoom + padding * 2);

      // resize wrapper to match the full diagram bounds
      wrapper.style.width = `${imageWidth}px`;
      wrapper.style.height = `${imageHeight}px`;

      setViewport(
        {
          x: -bounds.x * exportZoom + padding,
          y: -bounds.y * exportZoom + padding,
          zoom: exportZoom,
        },
        { duration: 0 },
      );

      await new Promise((resolve) => setTimeout(resolve, 250));

      const dataUrl = await toPng(wrapper, {
        backgroundColor: getCssVar("--canvas-bg"),
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.getAttribute("data-export-exclude") === "true") {
              return false;
            }
            const cls = node.className;
            if (typeof cls === "string") {
              return (
                !cls.includes("react-flow__minimap") &&
                !cls.includes("react-flow__controls") &&
                !cls.includes("react-flow__attribution")
              );
            }
          }
          return true;
        },
      });

      setPngDataUrl(dataUrl);
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      wrapper.style.width = previousStyle.width;
      wrapper.style.height = previousStyle.height;
      setViewport(previousViewport, { duration: 0 });
      setIsGeneratingPng(false);
    }
  }, [getViewport, setViewport, getNodes]);

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

      <CanvasToolbar />

      <CanvasSidebar
        open={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false);
          setActiveExport(null);
        }}
        onLayoutApply={handleLayoutApply}
        onSelectExport={(type) => setActiveExport(type)}
        activeExport={activeExport}
        onOpenSqlConsole={() => setSqlConsoleOpen(true)}
        onOpenSeedGenerator={() => setSeedOpen(true)}
      />

      <ExportPreviewDrawer
        key={activeExport}
        type={activeExport}
        sidebarOpen={sidebarOpen}
        onClose={() => setActiveExport(null)}
        pngDataUrl={pngDataUrl}
        isGeneratingPng={isGeneratingPng}
        onGeneratePng={handleGeneratePng}
      />

      <SqlConsoleModal
        open={sqlConsoleOpen}
        onClose={() => setSqlConsoleOpen(false)}
      />

      <SeedDataModal open={seedOpen} onClose={() => setSeedOpen(false)} />

      <div ref={canvasWrapperRef} className="absolute inset-0">
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
    </div>
  );
}
