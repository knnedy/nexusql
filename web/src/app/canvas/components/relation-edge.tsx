"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = selected ? "var(--edge-selected)" : "var(--edge-color)";
  const showLabel = (hovered || selected) && data?.relation.constraintName;

  return (
    <>
      {/* Invisible wider path for easier hover/click targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: "pointer" }}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2 : 1.5,
          transition: "stroke 0.15s, stroke-width 0.15s",
        }}
      />

      {/* Constraint name label, shown on hover or select state */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-node-bg border-[0.5px] border-border text-text-tertiary shadow-sm">
            {data.relation.constraintName}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(RelationEdge);
