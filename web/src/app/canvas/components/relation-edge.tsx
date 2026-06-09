"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { RelationEdgeData } from "@/lib/types";

function RelationEdge({
  id,
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

  // Use ELK-calculated Y positions when available for precise field-level routing
  const resolvedSourceY = data?.sourceY ?? sourceY;
  const resolvedTargetY = data?.targetY ?? targetY;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY: resolvedSourceY,
    sourcePosition,
    targetX,
    targetY: resolvedTargetY,
    targetPosition,
    borderRadius: 16,
    offset: 40,
  });

  // Use your direct accent variables to ensure the active edge line pops out
  const strokeColor = selected ? "var(--coral)" : "var(--edge-color)";
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
      />

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : 1.5, // Thicker stroke lines for visibility
          opacity: selected ? 1 : 0.7,
          transition:
            "stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease",
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
