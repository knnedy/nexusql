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
    teal: "bg-badge-teal-bg text-badge-teal-text",
    coral: "bg-badge-coral-bg text-badge-coral-text",
    gray: "bg-badge-gray-bg text-badge-gray-text",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium font-mono ${styles[variant]}`}>
      {type}
    </span>
  );
}

// PK / FK indicator badge
function KeyBadge({ kind }: { kind: "PK" | "FK" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0",
        kind === "PK"
          ? "bg-coral text-white"
          : "bg-badge-teal-bg text-badge-teal-text",
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
    <div className="relative flex items-center gap-2 px-3 py-1.5 border-t-[0.5px] border-node-row-border">
      {field.isPrimaryKey && (
        <Handle
          type="target"
          position={Position.Left}
          id={`${handleId}__target`}
          className="w-2! h-2! bg-teal! border-2! border-node-bg! rounded-full!"
        />
      )}

      {field.isForeignKey && (
        <Handle
          type="source"
          position={Position.Right}
          id={`${handleId}__source`}
          className="w-2! h-2! bg-teal! border-2! border-node-bg! rounded-full!"
        />
      )}

      <span
        className={[
          "text-xs flex-1 truncate",
          isKey ? "text-text-primary font-medium" : "text-text-secondary",
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
    postgres: "bg-badge-teal-bg text-badge-teal-text",
    mysql: "bg-badge-blue-bg text-badge-blue-text",
    sqlite: "bg-badge-gray-bg text-badge-gray-text",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[provider]}`}>
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
        "rounded-xl overflow-hidden transition-shadow",
        selected
          ? "shadow-[0_0_0_1.5px_var(--coral)]"
          : "shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]",
      ].join(" ")}
      style={{ width: NODE_WIDTH }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-node-header-bg border-b-[0.5px] border-node-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-sm bg-coral shrink-0" />
          <span className="text-sm font-semibold text-text-primary truncate tracking-[-0.01em]">
            {displayName}
          </span>
        </div>
        <ProviderLabel provider={provider} />
      </div>

      {/* Fields */}
      <div className="bg-node-bg">
        {table.fields.map((field) => (
          <FieldRow key={field.name} field={field} tableId={table.name} />
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
