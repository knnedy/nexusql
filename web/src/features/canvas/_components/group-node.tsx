"use client";

import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GroupNodeData } from "@/features/canvas/types";
import { useDetail } from "@/features/canvas/lib/use-detail";
import { useRegionFaded } from "@/features/canvas/lib/focus-store";
import { cx } from "@/shared/lib/cx";

/** A group's region: tables that reference each other, under their most-linked table's name. */
function GroupNode({ data, width, height }: NodeProps<Node<GroupNodeData>>) {
  // Zoomed out, the overlay draws the name at a readable size instead.
  const full = useDetail() === "full";
  const faded = useRegionFaded(data.tables);
  return (
    <div
      style={{ width, height }}
      className={cx("rounded-region border border-line bg-panel/55 transition-opacity duration-150 motion-reduce:transition-none", faded && "opacity-50")}>
      <p hidden={!full} translate="no" className="flex items-baseline gap-2 px-4.5 pt-3.5 whitespace-nowrap">
        <span className="text-title font-semibold text-fg">{data.name}</span>
        <span className="text-label text-fg-subtle tabular-nums">
          {data.count} {data.count === 1 ? "table" : "tables"}
        </span>
      </p>
    </div>
  );
}

export default memo(GroupNode);
