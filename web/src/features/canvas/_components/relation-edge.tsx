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

  // Lines into a hub or out of the group stay behind their chip unless either end is in focus.
  if ((data?.hub || data?.cross) && focus !== "on") return null;

  const strokeColor = selected ? "var(--nx-accent)" : focus === "on" ? "var(--nx-relation-line)" : "var(--nx-line-strong)";
  const opacity = focus === "off" && !selected ? 0.25 : 1;
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
          // A line between two groups is dashed: it leaves the region it starts in.
          strokeDasharray: data?.cross ? "5 4" : undefined,
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
            className="pointer-events-none rounded-full border border-line-strong bg-raised px-2.5 py-1 font-mono text-caption text-fg shadow-card select-none">
            {data.relation.constraintName}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(RelationEdge);
