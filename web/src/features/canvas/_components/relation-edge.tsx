"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { RelationEdgeData } from "@/features/canvas/types";
import { routedPath } from "@/features/canvas/lib/edge-path";
import { useEdgeFocus } from "@/features/canvas/lib/focus-store";

function RelationEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<Edge<RelationEdgeData>>) {
  const [hovered, setHovered] = useState(false);
  const focus = useEdgeFocus(source, target);

  // ELK's route avoids tables; a dragged table falls back to a direct step until re-layout.
  const routed = routedPath(data?.points, { x: sourceX, y: sourceY }, { x: targetX, y: targetY }, 12);
  const [edgePath, labelX, labelY] = routed
    ? [routed.path, routed.label.x, routed.label.y]
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 16,
        offset: 40,
      });

  // Lines into a hub table stay hidden behind its chip unless either end is in focus.
  if (data?.hub && focus !== "on") return null;

  const strokeColor = selected ? "var(--coral)" : focus === "on" ? "var(--teal)" : "var(--edge-color)";
  const opacity = selected || focus === "on" ? 1 : focus === "off" ? 0.12 : 0.7;
  const showLabel = (hovered || selected) && data?.relation.constraintName;

  return (
    <>
      {/* Thick invisible path to make hovering/clicking effortless */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="cursor-pointer"
        data-routed={routed ? "true" : "false"}
        data-focus={focus}
        data-hub={data?.hub ? "" : undefined}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : focus === "on" ? 2 : 1.5,
          opacity,
          transition: "stroke 100ms ease, stroke-width 100ms ease, opacity 100ms ease",
        }}
      />

      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="pointer-events-none select-none px-3 py-1.5 rounded-lg text-xs font-mono tracking-normal bg-node-bg border-2 border-node-border dark:border-node-border text-text-primary shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all animate-in fade-in zoom-in-95 duration-50">
            {data.relation.constraintName}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(RelationEdge);
