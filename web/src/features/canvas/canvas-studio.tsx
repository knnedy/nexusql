"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import { SlidersHorizontal } from "lucide-react";
import { buildCanvasGraph } from "@/features/canvas/lib/canvas-utils";
import { useSchema } from "@/shared/hooks/use-schema";
import TableNode from "@/features/canvas/_components/table-node";
import RelationEdge from "@/features/canvas/_components/relation-edge";
import CanvasSidebar from "@/features/canvas/_components/canvas-sidebar";
import { ExportPreviewDrawer } from "@/features/export";
import InspectorPanel from "@/features/canvas/_components/inspector-panel";
import { SqlConsoleModal } from "@/features/console";
import { RelationEdgeData, TableNodeData } from "@/features/canvas/types";
import { Relation } from "@/shared/types/schema";
import { DatabaseProvider } from "@/shared/types/provider";
import { SeedDataModal } from "@/features/seed";
import { studioSession } from "@/shared/lib/session-storage";
import { useCanvasFocus } from "@/features/canvas/lib/focus-store";

const nodeTypes: NodeTypes = { tableNode: TableNode };
const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

const emptySubscribe = () => () => {};

interface CanvasStudioProps {
  /** The workspace's selected table; the diagram follows it. */
  selectedTable: string | null;
  onSelectTable: (table: string | null) => void;
}

export default function CanvasStudio(props: CanvasStudioProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ selectedTable: selectedName, onSelectTable }: CanvasStudioProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<
    Edge<RelationEdgeData>
  >([]);
  const [graphReady, setGraphReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeExport, setActiveExport] = useState<string | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);
  const [sqlConsoleOpen, setSqlConsoleOpen] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(
    null,
  );
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { getViewport, setViewport, getNodes, getNodesBounds, fitView } = useReactFlow();
  // Set when the selection came from a click here, so the view does not jump.
  const clickedRef = useRef<string | null>(null);
  const { resolvedTheme } = useTheme();

  const { data: schema, isLoading, isError } = useSchema();
  const selectedTable = useMemo(
    () => schema?.tables.find((t) => t.name === selectedName) ?? null,
    [schema, selectedName],
  );
  const setHovered = useCanvasFocus((s) => s.setHovered);
  const setFocusSelected = useCanvasFocus((s) => s.setSelected);
  useEffect(() => () => useCanvasFocus.getState().reset(), []);

  const provider = useSyncExternalStore<DatabaseProvider>(
    emptySubscribe,
    () =>
      studioSession.provider() ??
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

  useEffect(() => setFocusSelected(selectedName), [selectedName, setFocusSelected]);

  // A table chosen elsewhere (sidebar, links) is brought into view.
  useEffect(() => {
    if (!graphReady || !selectedName) return;
    if (clickedRef.current === selectedName) return;
    if (!getNodes().some((n) => n.id === selectedName)) return;
    fitView({ nodes: [{ id: selectedName }], duration: 300, maxZoom: Math.max(getViewport().zoom, 0.8) });
  }, [graphReady, selectedName, fitView, getNodes, getViewport]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TableNodeData>) => {
      setSelectedRelation(null);
      clickedRef.current = node.id;
      onSelectTable(node.id);
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    },
    [setEdges, onSelectTable],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge<RelationEdgeData>) => {
      if (edge.data?.relation) setSelectedRelation(edge.data.relation);
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    },
    [setNodes],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedRelation(null);
    clickedRef.current = null;
    onSelectTable(null);
  }, [onSelectTable]);

  const handleLayoutApply = useCallback(
    (laid: Node<TableNodeData>[], routed: Edge<RelationEdgeData>[]) => {
      setNodes(laid);
      setEdges(routed);
    },
    [setNodes, setEdges],
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
  }, [getViewport, setViewport, getNodes, getNodesBounds]);

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
          onNodeMouseEnter={(_, node) => setHovered(node.id)}
          onNodeMouseLeave={() => setHovered(null)}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          // v12's 0.38 padding: numbers are pixels since v13, so give the same share
          fitViewOptions={{ padding: "14%", includeHiddenNodes: false }}
          forceColorMode={resolvedTheme === "light" ? "light" : "dark"} // follow the app theme, not the OS
          onlyRenderVisibleElements
          minZoom={0.02} // low enough that the first view fits a few hundred tables
          maxZoom={2}
          proOptions={{ hideAttribution: true }}>
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--canvas-dot)"
          />
          <InspectorPanel
            table={selectedRelation ? null : selectedTable}
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
