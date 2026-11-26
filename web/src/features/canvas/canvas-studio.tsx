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
import { ImageDown, LayoutGrid, Loader2, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/shared/ui/empty-state";
import { buildCanvasGraph, reapplyLayout } from "@/features/canvas/lib/canvas-utils";
import { IconButton } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { useSchema } from "@/shared/hooks/use-schema";
import TableNode from "@/features/canvas/_components/table-node";
import GroupNode from "@/features/canvas/_components/group-node";
import { GroupOverlay } from "@/features/canvas/_components/group-overlay";
import { firstView, type GroupLink } from "@/features/canvas/lib/overview";
import RelationEdge from "@/features/canvas/_components/relation-edge";
import { DetailsCard } from "@/features/canvas/_components/details-card";
import type { GroupNodeData, RelationEdgeData, TableNodeData } from "@/features/canvas/types";
import { Relation } from "@/shared/types/schema";
import { DatabaseProvider } from "@/shared/types/provider";
import { studioSession } from "@/shared/lib/session-storage";
import { useCanvasFocus } from "@/features/canvas/lib/focus-store";

const nodeTypes: NodeTypes = { tableNode: TableNode, groupNode: GroupNode };
// The floating toolbar's bottom edge, from the top of the canvas.
const TOOLBAR_CLEARANCE = 64;
type CanvasNode = Node<TableNodeData> | Node<GroupNodeData>;

// Regions sit behind their tables and let clicks and drags through to the canvas.
const withRegions = (groups: Node<GroupNodeData>[], tables: Node<TableNodeData>[]): CanvasNode[] => [
  ...groups.map((g) => ({ ...g, style: { pointerEvents: "none" as const } })),
  ...tables,
];
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
  detailsOpen: boolean;
  onCloseDetails: () => void;
  onOpenData: (table: string) => void;
}

export default function CanvasStudio(props: CanvasStudioProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ selectedTable: selectedName, onSelectTable, detailsOpen, onCloseDetails, onOpenData }: CanvasStudioProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<
    Edge<RelationEdgeData>
  >([]);
  const [graphReady, setGraphReady] = useState(false);
  const [overview, setOverview] = useState<{ groups: Node<GroupNodeData>[]; links: GroupLink[] }>({ groups: [], links: [] });
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(
    null,
  );
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { getViewport, setViewport, getNodes, getNodesBounds, fitView } = useReactFlow();
  // Set when the selection came from a click here, so the view does not jump.
  const clickedRef = useRef<string | null>(null);
  const viewSetRef = useRef(false);
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
    buildCanvasGraph(schema, provider).then(({ nodes, edges, groups, links }) => {
      setNodes(withRegions(groups, nodes));
      setEdges(edges);
      setOverview({ groups, links });
      setGraphReady(true);
    });
  }, [schema, provider, setNodes, setEdges]);

  // The opening view, once. Regions cover every table, so their bounds need no measuring.
  useEffect(() => {
    const pane = canvasWrapperRef.current;
    if (!graphReady || viewSetRef.current || !pane || !overview.groups.length) return;
    viewSetRef.current = true;
    const b = getNodesBounds(overview.groups);
    const tables = overview.groups.reduce((n, g) => n + g.data.count, 0);
    const room = { w: pane.clientWidth, h: pane.clientHeight };
    setViewport(firstView({ x: b.x, y: b.y, w: b.width, h: b.height }, room, tables, TOOLBAR_CLEARANCE));
  }, [graphReady, overview, getNodesBounds, setViewport]);

  useEffect(() => setFocusSelected(selectedName), [selectedName, setFocusSelected]);

  // A table chosen elsewhere (sidebar, links) is brought into view.
  useEffect(() => {
    if (!graphReady || !selectedName) return;
    if (clickedRef.current === selectedName) return;
    if (!getNodes().some((n) => n.id === selectedName)) return;
    fitView({ nodes: [{ id: selectedName }], duration: 300, maxZoom: Math.max(getViewport().zoom, 0.8) });
  }, [graphReady, selectedName, fitView, getNodes, getViewport]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: CanvasNode) => {
      if (node.type !== "tableNode") return;
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

  const toast = useToast();
  const handleAutoLayout = useCallback(async () => {
    if (!schema) return;
    const laid = await reapplyLayout(schema, provider);
    setNodes(withRegions(laid.groups, laid.nodes));
    setEdges(laid.edges);
    setOverview({ groups: laid.groups, links: laid.links });
  }, [schema, provider, setNodes, setEdges]);

  const handleGeneratePng = useCallback(async () => {
    if (!canvasWrapperRef.current) return;

    setIsGeneratingPng(true);

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
        backgroundColor: getCssVar("--nx-ground"),
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

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "schema.png";
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
      toast({ title: "Could not save the image", description: String(err), tone: "danger" });
    } finally {
      wrapper.style.width = previousStyle.width;
      wrapper.style.height = previousStyle.height;
      setViewport(previousViewport, { duration: 0 });
      setIsGeneratingPng(false);
    }
  }, [getViewport, setViewport, getNodes, getNodesBounds, toast]);

  if (isError) {
    return (
      <div className="grid h-full w-full place-items-center bg-ground">
        <EmptyState icon={<TriangleAlert aria-hidden />} title="The schema did not load">
          Check the connection, then reload the page.
        </EmptyState>
      </div>
    );
  }

  if (isLoading || !graphReady) {
    return (
      <div role="status" className="grid h-full w-full place-items-center bg-ground text-body text-fg-subtle">
        <span className="flex items-center gap-2.5">
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          Arranging the schema…
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div data-export-exclude="true" className="absolute top-3 left-3 z-10 flex gap-0.5 rounded-card border border-line bg-panel p-0.5 shadow-card">
        <IconButton label="Auto-layout" onClick={handleAutoLayout}>
          <LayoutGrid aria-hidden />
        </IconButton>
        <IconButton label="Save as PNG" onClick={handleGeneratePng} disabled={isGeneratingPng}>
          <ImageDown aria-hidden />
        </IconButton>
      </div>

      {detailsOpen && (
        <DetailsCard
          table={selectedRelation ? null : selectedTable}
          relation={selectedRelation}
          tables={schema?.tables ?? []}
          relations={schema?.relations ?? []}
          onSelectTable={(name) => {
            setSelectedRelation(null);
            onSelectTable(name);
          }}
          onOpenData={onOpenData}
          onClose={onCloseDetails}
        />
      )}

      <div ref={canvasWrapperRef} className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeMouseEnter={(_, node) => node.type === "tableNode" && setHovered(node.id)}
          onNodeMouseLeave={() => setHovered(null)}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          forceColorMode={resolvedTheme === "light" ? "light" : "dark"} // follow the app theme, not the OS
          onlyRenderVisibleElements
          minZoom={0.02} // low enough that the first view fits a few hundred tables
          maxZoom={2}
          proOptions={{ hideAttribution: true }}>
          <GroupOverlay groups={overview.groups} links={overview.links} />
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--nx-grid-dot)" bgColor="var(--nx-ground)" />
          <MiniMap
            position="bottom-left"
            nodeColor={(n) => (n.type === "groupNode" ? "var(--nx-sunk)" : "var(--nx-line-strong)")}
            nodeBorderRadius={4}
            maskColor="color-mix(in srgb, var(--nx-ground) 70%, transparent)"
            style={{ background: "var(--nx-panel)", border: "1px solid var(--nx-line-strong)", borderRadius: "var(--radius-card)", width: 168, height: 104 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
