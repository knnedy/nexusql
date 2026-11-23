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
import { Field, FIELD_TYPE_BADGE_MAP } from "@/shared/types/schema";
import { DatabaseProvider } from "@/shared/types/provider";
import { TableNodeData } from "@/features/canvas/types";

// Field type badge
function TypeBadge({ type }: { type: string }) {
  const variant = FIELD_TYPE_BADGE_MAP[type] ?? "gray";

  const styles = {
    teal: "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal",
    coral:
      "bg-badge-coral-bg/15 text-badge-coral-text dark:bg-badge-coral-bg/20 dark:text-coral",
    gray: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20 dark:text-text-secondary",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold font-mono tracking-wide border border-black/3 dark:border-white/3 ${styles[variant]}`}>
      {type}
    </span>
  );
}

// PK / FK indicator badge
function KeyBadge({ kind }: { kind: "PK" | "FK" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider shrink-0 border",
        kind === "PK"
          ? "bg-coral/10 text-coral border-coral/20 dark:bg-coral/20"
          : "bg-badge-teal-bg/15 text-badge-teal-text border-badge-teal-text/10 dark:bg-badge-teal-bg/20 dark:text-teal dark:border-teal/20",
      ].join(" ")}>
      {kind}
    </span>
  );
}

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
      className="nodrag nopan inline-flex items-center gap-0.5 max-w-24 rounded-md px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wide shrink-0 border cursor-pointer bg-badge-teal-bg/15 text-badge-teal-text border-badge-teal-text/10 dark:bg-badge-teal-bg/20 dark:text-teal dark:border-teal/20 hover:bg-badge-teal-bg/30 transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]">
      <span aria-hidden>→</span>
      <span className="truncate">{target}</span>
    </button>
  );
}

// Individual field row
function FieldRow({
  field,
  tableId,
  referenced,
  hubTarget,
}: {
  field: Field;
  tableId: string;
  referenced: boolean;
  hubTarget?: string;
}) {
  const handleId = `${tableId}__${field.name}`;
  const isKey = field.isPrimaryKey || field.isForeignKey;

  return (
    <div
      style={{ height: NODE_ROW }}
      className="relative flex items-center gap-3 px-3.5 border-t-[0.5px] border-node-row-border/60 hover:bg-black/1 dark:hover:bg-white/1 transition-colors group">
      {(field.isPrimaryKey || referenced) && (
        <Handle
          type="target"
          position={Position.Left}
          id={`${handleId}__target`}
          className="w-2! h-2! bg-teal! border-2! border-node-bg! rounded-full! transition-transform group-hover:scale-125"
        />
      )}

      {field.isForeignKey && (
        <Handle
          type="source"
          position={Position.Right}
          id={`${handleId}__source`}
          className="w-2! h-2! bg-teal! border-2! border-node-bg! rounded-full! transition-transform group-hover:scale-125"
        />
      )}

      <span
        className={[
          "text-[12px] flex-1 truncate font-mono tracking-tight",
          isKey
            ? "text-text-primary font-semibold antialiased"
            : "text-text-secondary/90",
        ].join(" ")}>
        {field.name}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        <TypeBadge type={field.type} />
        {field.isPrimaryKey && <KeyBadge kind="PK" />}
        {hubTarget ? (
          <HubChip target={hubTarget} />
        ) : (
          field.isForeignKey && <KeyBadge kind="FK" />
        )}
      </div>
    </div>
  );
}

// Provider label shown in the node header
function ProviderLabel({ provider }: { provider: DatabaseProvider }) {
  const styles = {
    postgres:
      "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal",
    mysql:
      "bg-badge-blue-bg/15 text-badge-blue-text dark:bg-badge-blue-bg/20 dark:text-blue-400",
    sqlite: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wider border border-black/2 dark:border-white/2 ${styles[provider]}`}>
      {provider}
    </span>
  );
}

// Table node
function TableNode({ data, selected }: NodeProps<Node<TableNodeData>>) {
  const { table, provider } = data;

  const displayName =
    table.schema && table.schema !== "public"
      ? `${table.schema}.${table.name}`
      : table.name;

  return (
    <div
      className={[
        // Exact size and a constant border: the layout routes edges to these rows.
        "rounded-xl overflow-hidden border transition-[box-shadow,border-color] duration-100",
        selected
          ? "border-coral shadow-[0_0_0_1px_var(--coral)]"
          : "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] border-node-border/80 dark:border-node-border/40",
      ].join(" ")}
      style={{ width: NODE_WIDTH, height: getNodeHeight(table.fields.length) }}>
      {/* Header */}
      <div
        style={{ height: NODE_HEADER }}
        className="flex items-center justify-between gap-3 px-3.5 bg-node-header-bg border-b-[0.5px] border-node-border/80 dark:border-node-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-coral shrink-0 shadow-sm shadow-coral/40" />
          <span className="text-[13px] font-bold text-text-primary truncate tracking-tight antialiased">
            {displayName}
          </span>
        </div>
        <ProviderLabel provider={provider} />
      </div>

      {/* Fields */}
      <div className="bg-node-bg" style={{ paddingBottom: NODE_PAD_BOTTOM }}>
        {table.fields.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            tableId={table.name}
            referenced={data.referenced?.includes(field.name) ?? false}
            hubTarget={data.hubRefs?.[field.name]}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
