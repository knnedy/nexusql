"use client";

import { memo, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals, type NodeProps, type Node } from "@xyflow/react";
import { useCanvasFocus } from "@/features/canvas/lib/focus-store";
import {
  getNodeHeight,
  keyFields,
  keysCardHeight,
  KEYS_HEADER,
  KEYS_ROW,
  KEYS_SCALE,
  KEYS_WIDTH,
  NODE_HEADER,
  NODE_PAD_BOTTOM,
  NODE_ROW,
  NODE_WIDTH,
} from "@/features/canvas/lib/card";
import { useDetail } from "@/features/canvas/lib/use-detail";
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

// Keys flow right to left: a table's own keys leave on the left, lines arrive on the right.
function KeyHandles({ field, tableId, referenced }: { field: Field; tableId: string; referenced: boolean }) {
  const id = `${tableId}__${field.name}`;
  return (
    <>
      {field.isForeignKey && <Handle type="source" position={Position.Left} id={`${id}__source`} className={HANDLE} />}
      {(field.isPrimaryKey || referenced) && <Handle type="target" position={Position.Right} id={`${id}__target`} className={HANDLE} />}
    </>
  );
}

const keyLabel = (f: Field) => (f.isPrimaryKey ? "PK" : f.isForeignKey ? "FK" : "");

function FieldRow({ field, tableId, referenced, hubTarget }: { field: Field; tableId: string; referenced: boolean; hubTarget?: string }) {
  return (
    <div style={{ height: NODE_ROW }} className="relative flex items-center gap-2 border-t border-line px-3 first:border-t-0">
      <KeyHandles field={field} tableId={tableId} referenced={referenced} />
      <span className={cx("w-4.5 shrink-0 text-caption font-semibold", field.isPrimaryKey ? "text-accent" : "text-relation")}>
        {keyLabel(field)}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-label text-fg">{field.name}</span>
      {hubTarget ? <HubChip target={hubTarget} /> : <span className="shrink-0 font-mono text-caption text-fg-subtle">{field.type}</span>}
    </div>
  );
}

const cardFrame = (selected: boolean | undefined) =>
  cx(
    "group/card overflow-hidden rounded-card border bg-panel shadow-card transition-[border-color,box-shadow] duration-150",
    selected ? "border-accent ring-3 ring-accent-tint" : "border-line-strong",
  );

/** Zoomed out: only the keys, larger, so names and links stay readable. Blocks drop the text too. */
function KeysCard({ data, selected, blank }: { data: TableNodeData; selected?: boolean; blank: boolean }) {
  const { table } = data;
  const keys = keyFields(table.fields, data.referenced);
  const rest = table.fields.length - keys.length;
  const text = blank ? "invisible" : "";
  return (
    <div style={{ width: NODE_WIDTH, height: keysCardHeight(table.fields, data.referenced) }}>
      <div
        style={{ width: KEYS_WIDTH, transform: `scale(${KEYS_SCALE})`, transformOrigin: "0 0" }}
        className={cx(cardFrame(selected), selected && "ring-2")}>
        <div style={{ height: KEYS_HEADER }} className="flex items-center border-b border-line bg-sunk px-2.5">
          <span className={cx("min-w-0 truncate text-body font-semibold text-fg", text)}>{table.name}</span>
        </div>
        {keys.map((field) => (
          <div key={field.name} style={{ height: KEYS_ROW }} className="relative flex items-center gap-1.5 px-2.5 text-label">
            <KeyHandles field={field} tableId={table.name} referenced={data.referenced?.includes(field.name) ?? false} />
            <span className={cx("w-4 shrink-0 text-caption font-semibold", field.isPrimaryKey ? "text-accent" : "text-relation", text)}>
              {keyLabel(field)}
            </span>
            <span className={cx("min-w-0 flex-1 truncate font-mono text-fg", text)}>{field.name}</span>
            {data.chips?.[field.name] && !blank && <HubChip target={data.chips[field.name]} />}
          </div>
        ))}
        {rest > 0 && (
          <div style={{ height: KEYS_ROW }} className={cx("flex items-center pl-8 text-label text-fg-subtle tabular-nums", text)}>
            + {rest} more
          </div>
        )}
      </div>
    </div>
  );
}

function TableNode({ id, data, selected }: NodeProps<Node<TableNodeData>>) {
  const { table } = data;
  const detail = useDetail();
  const full = detail === "full";
  // Handles move with the card's rows: re-measure them when the card switches.
  const updateNodeInternals = useUpdateNodeInternals();
  const shown = useRef(full);
  useEffect(() => {
    if (shown.current === full) return;
    shown.current = full;
    updateNodeInternals(id);
  }, [full, id, updateNodeInternals]);

  if (!full) return <KeysCard data={data} selected={selected} blank={detail === "blocks"} />;
  const name = table.schema && table.schema !== "public" ? `${table.schema}.${table.name}` : table.name;
  return (
    <div
      // Exact size: the layout routes lines to these rows.
      style={{ width: NODE_WIDTH, height: getNodeHeight(table.fields.length) }}
      className={cardFrame(selected)}>
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
