"use client";

import { memo } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { useCanvasFocus } from "@/features/canvas/lib/focus-store";
import {
  getNodeHeight,
  NODE_HEADER,
  NODE_PAD_BOTTOM,
  NODE_ROW,
  NODE_WIDTH,
} from "@/features/canvas/lib/canvas-utils";
import type { Field } from "@/shared/types/schema";
import type { TableNodeData } from "@/features/canvas/types";
import { cx } from "@/shared/lib/cx";

// Stands in for the line to a hub table; jumps there and keeps it in focus.
function HubChip({ target }: { target: string }) {
  const { getNode, getZoom, setCenter } = useReactFlow();
  return (
    <button
      type="button"
      aria-label={`Go to ${target}`}
      title={`Go to ${target}`}
      onClick={(e) => {
        e.stopPropagation();
        const node = getNode(target);
        if (!node) return;
        const w = node.measured?.width ?? NODE_WIDTH;
        const h = node.measured?.height ?? 0;
        useCanvasFocus.getState().setSelected(target);
        setCenter(node.position.x + w / 2, node.position.y + h / 2, {
          zoom: Math.max(getZoom(), 0.6),
          duration: 300,
        });
      }}
      className="nodrag nopan inline-flex max-w-24 shrink-0 cursor-pointer items-center gap-0.5 rounded-full bg-relation-tint px-1.5 font-mono text-caption text-relation hover:underline">
      <span aria-hidden>→</span>
      <span className="truncate">{target}</span>
    </button>
  );
}

const HANDLE = "size-1.5! min-h-0! min-w-0! border-0! bg-relation-line! opacity-0 group-hover/card:opacity-100";

function FieldRow({ field, tableId, referenced, hubTarget }: { field: Field; tableId: string; referenced: boolean; hubTarget?: string }) {
  const handleId = `${tableId}__${field.name}`;
  return (
    <div style={{ height: NODE_ROW }} className="relative flex items-center gap-2 border-t border-line px-3 first:border-t-0">
      {/* Keys flow right to left: a table's own keys leave on the left, lines arrive on the right. */}
      {field.isForeignKey && <Handle type="source" position={Position.Left} id={`${handleId}__source`} className={HANDLE} />}
      {(field.isPrimaryKey || referenced) && <Handle type="target" position={Position.Right} id={`${handleId}__target`} className={HANDLE} />}
      <span className={cx("w-4.5 shrink-0 text-caption font-semibold", field.isPrimaryKey ? "text-accent" : "text-relation")}>
        {field.isPrimaryKey ? "PK" : field.isForeignKey ? "FK" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-label text-fg">{field.name}</span>
      {hubTarget ? <HubChip target={hubTarget} /> : <span className="shrink-0 font-mono text-caption text-fg-subtle">{field.type}</span>}
    </div>
  );
}

function TableNode({ data, selected }: NodeProps<Node<TableNodeData>>) {
  const { table } = data;
  const name = table.schema && table.schema !== "public" ? `${table.schema}.${table.name}` : table.name;
  return (
    <div
      // Exact size: the layout routes lines to these rows.
      style={{ width: NODE_WIDTH, height: getNodeHeight(table.fields.length) }}
      className={cx(
        "group/card overflow-hidden rounded-card border bg-panel shadow-card transition-[border-color,box-shadow] duration-150",
        selected ? "border-accent ring-3 ring-accent-tint" : "border-line-strong",
      )}>
      <div style={{ height: NODE_HEADER }} className="flex items-center gap-2 border-b border-line bg-sunk px-3">
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-fg">{name}</span>
        <span className="shrink-0 text-caption text-fg-subtle tabular-nums">
          {table.fields.length} {table.fields.length === 1 ? "column" : "columns"}
        </span>
      </div>
      <div style={{ paddingBottom: NODE_PAD_BOTTOM }}>
        {table.fields.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            tableId={table.name}
            referenced={data.referenced?.includes(field.name) ?? false}
            hubTarget={data.chips?.[field.name]}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
