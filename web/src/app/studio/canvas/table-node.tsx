"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { TableNodeData, Field, DatabaseProvider } from "@/lib/types";
import { FIELD_TYPE_BADGE_MAP } from "@/lib/types";
import { NODE_WIDTH } from "@/lib/canvas-utils";

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

// Individual field row
function FieldRow({ field, tableId }: { field: Field; tableId: string }) {
  const handleId = `${tableId}__${field.name}`;
  const isKey = field.isPrimaryKey || field.isForeignKey;

  return (
    <div className="relative flex items-center gap-3 px-3.5 py-2 border-t-[0.5px] border-node-row-border/60 hover:bg-black/1 dark:hover:bg-white/1 transition-colors group">
      {field.isPrimaryKey && (
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
        {field.isForeignKey && <KeyBadge kind="FK" />}
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
        "rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-50",
        selected
          ? "shadow-[0_0_0_2px_var(--coral)] scale-[1.01]"
          : "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-node-border/80 dark:border-node-border/40",
      ].join(" ")}
      style={{ width: NODE_WIDTH }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 bg-node-header-bg/90 backdrop-blur-md border-b-[0.5px] border-node-border/80 dark:border-node-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-coral shrink-0 shadow-sm shadow-coral/40" />
          <span className="text-[13px] font-bold text-text-primary truncate tracking-tight antialiased">
            {displayName}
          </span>
        </div>
        <ProviderLabel provider={provider} />
      </div>

      {/* Fields */}
      <div className="bg-node-bg/95 backdrop-blur-md pb-1">
        {table.fields.map((field) => (
          <FieldRow key={field.name} field={field} tableId={table.name} />
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
