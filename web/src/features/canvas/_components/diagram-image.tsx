"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ReactFlow, ReactFlowProvider, useNodesInitialized, type Node } from "@xyflow/react";
import { useTheme } from "next-themes";
import { buildCanvasGraph, getNodeHeight, NODE_WIDTH, type CanvasGraph } from "@/features/canvas/lib/canvas-utils";
import { capturePng, cssVar } from "@/features/canvas/lib/capture";
import type { TableNodeData } from "@/features/canvas/types";
import type { DatabaseProvider } from "@/shared/types/provider";
import type { SchemaResponse } from "@/shared/types/schema";
import { edgeTypes, nodeTypes } from "./flow-types";

const PAD = 60;

export interface DiagramPng {
  url: string;
  /** Pixels, at the 2x the image is saved at. */
  width: number;
  height: number;
}

export interface ImageOptions {
  regions: boolean;
  transparent: boolean;
}

type Rect = { x: number; y: number; w: number; h: number };

function bounds(graph: CanvasGraph, regions: boolean): Rect {
  const rects = graph.nodes.map((n: Node<TableNodeData>) => ({ x: n.position.x, y: n.position.y, w: NODE_WIDTH, h: getNodeHeight(n.data.table.fields.length) }));
  if (regions) rects.push(...graph.groups.map((g) => ({ x: g.position.x, y: g.position.y, w: g.width ?? 0, h: g.height ?? 0 })));
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

// Waits for every card to be measured and the lines routed, then photographs the stage.
function Capture({ target, size, transparent, onDone }: { target: RefObject<HTMLDivElement | null>; size: { w: number; h: number }; transparent: boolean; onDone: (png: DiagramPng | null) => void }) {
  const ready = useNodesInitialized();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const { w, h } = size;
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    (async () => {
      await document.fonts.ready;
      await frame();
      await frame();
      if (!live || !target.current) return;
      const url = await capturePng(target.current, { w, h }, transparent ? undefined : cssVar("--nx-ground"));
      if (live) done.current({ url, width: w * 2, height: h * 2 });
    })().catch(() => live && done.current(null));
    return () => {
      live = false;
    };
  }, [ready, target, w, h, transparent]);
  return null;
}

/**
 * The diagram of a schema as a PNG, laid out like the canvas. Render `stage` while
 * `png` is pending; it draws off-screen at full size and is photographed once.
 */
export function useDiagramImage(schema: SchemaResponse | undefined, provider: DatabaseProvider, options: ImageOptions, enabled: boolean) {
  const { resolvedTheme } = useTheme();
  const [graph, setGraph] = useState<{ for: SchemaResponse; graph: CanvasGraph; n: number } | null>(null);
  const [result, setResult] = useState<{ key: string; for: CanvasGraph; png: DiagramPng | null } | null>(null);
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !schema || graph?.for === schema) return;
    let live = true;
    buildCanvasGraph(schema, provider).then((g) => live && setGraph((p) => ({ for: schema, graph: g, n: (p?.n ?? 0) + 1 })));
    return () => {
      live = false;
    };
  }, [enabled, schema, provider, graph]);

  const laid = graph && graph.for === schema ? graph.graph : null;
  const key = `${options.regions}:${options.transparent}:${resolvedTheme}`;
  const current = laid && result?.key === key && result.for === laid ? result : null;
  const empty = !!laid && laid.nodes.length === 0;
  const pending = enabled && !current && !empty;

  let stage: ReactNode = null;
  if (pending && laid) {
    const b = bounds(laid, options.regions);
    const size = { w: Math.ceil(b.w + PAD * 2), h: Math.ceil(b.h + PAD * 2) };
    const nodes = options.regions ? [...laid.groups.map((g) => ({ ...g, style: { pointerEvents: "none" as const } })), ...laid.nodes] : laid.nodes;
    stage = (
      // Uncontrolled, so React Flow keeps the sizes it measures; a new key starts afresh.
      <div key={`${graph?.n}:${key}`} aria-hidden inert style={{ position: "fixed", top: 0, left: -size.w - 1000, width: size.w, height: size.h, pointerEvents: "none" }}>
        <div ref={target} style={{ width: size.w, height: size.h }}>
          <ReactFlowProvider>
            <ReactFlow
              defaultNodes={nodes}
              defaultEdges={laid.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultViewport={{ x: PAD - b.x, y: PAD - b.y, zoom: 1 }}
              forceColorMode={resolvedTheme === "light" ? "light" : "dark"}
              style={{ background: "transparent" }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}>
              <Capture target={target} size={size} transparent={options.transparent} onDone={(png) => setResult({ key, for: laid, png })} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    );
  }

  return {
    png: current?.png ?? null,
    /** Drawing failed; `png` stays null. */
    failed: !!current && current.png === null,
    empty,
    pending,
    stage,
  };
}
