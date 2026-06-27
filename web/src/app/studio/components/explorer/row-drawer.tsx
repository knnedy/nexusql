"use client";

import { X, Key, Link, Hash } from "lucide-react";
import type { Field } from "@/lib/types";
import { FIELD_TYPE_BADGE_MAP } from "@/lib/types";

interface RowDrawerProps {
  row: Record<string, unknown> | null;
  fields: Field[];
  rowIndex: number | null;
  onClose: () => void;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function formatValue(value: unknown): string {
  if (isNullish(value)) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function FieldEntry({ field, value }: { field: Field; value: unknown }) {
  const variant = FIELD_TYPE_BADGE_MAP[field.type] ?? "gray";
  const nullish = isNullish(value);
  const formatted = formatValue(value);
  const isLong = formatted.length > 60;

  const badgeStyles = {
    teal: "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal border-black/2 dark:border-white/2",
    coral:
      "bg-badge-coral-bg/15 text-badge-coral-text dark:bg-badge-coral-bg/20 dark:text-coral border-black/2 dark:border-white/2",
    gray: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20 dark:text-text-secondary border-black/2 dark:border-white/2",
  } as const;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-node-row-border/60 hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-3.5 shrink-0 flex items-center justify-center">
          {field.isPrimaryKey && (
            <Key size={9} className="text-coral" aria-hidden />
          )}
          {field.isForeignKey && !field.isPrimaryKey && (
            <Link size={9} className="text-teal" aria-hidden />
          )}
          {!field.isPrimaryKey && !field.isForeignKey && (
            <Hash size={9} className="text-text-tertiary" aria-hidden />
          )}
        </div>
        <span className="text-[11px] font-mono font-semibold text-text-primary tracking-tight">
          {field.name}
        </span>
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider border font-mono ml-auto shrink-0 ${badgeStyles[variant]}`}>
          {field.type}
        </span>
      </div>

      {nullish ? (
        <span className="ml-5.5 text-[11px] font-mono italic text-text-tertiary/50">
          null
        </span>
      ) : isLong ? (
        <pre className="ml-5.5 text-[10.5px] font-mono text-text-secondary/90 whitespace-pre-wrap break-all leading-relaxed select-text bg-black/5 dark:bg-black/30 rounded-lg px-3 py-2 border border-node-border/40">
          {formatted}
        </pre>
      ) : (
        <span className="ml-5.5 text-[11px] font-mono text-text-secondary/90 select-text break-all">
          {formatted}
        </span>
      )}
    </div>
  );
}

export default function RowDrawer({
  row,
  fields,
  rowIndex,
  onClose,
}: RowDrawerProps) {
  if (!row) return null;

  return (
    <>
      <div className="absolute inset-0 z-20" onClick={onClose} aria-hidden />

      <div className="absolute top-0 right-0 h-full w-96 z-30 flex flex-col border-l border-node-border/80 dark:border-node-border/40 bg-node-bg/98 dark:bg-node-bg/99 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right-8 duration-200">
        <div className="flex items-center justify-between px-4 py-4 border-b border-node-border/60 dark:border-node-border/30 bg-node-header-bg/60 shrink-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-bold text-text-primary tracking-tight antialiased">
              Row {rowIndex !== null ? rowIndex + 1 : ""}
            </span>
            <span className="text-[10px] font-mono text-text-tertiary mt-0.5">
              {fields.length} fields
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-node-border/30 transition-colors border-none bg-transparent cursor-pointer shrink-0">
            <X size={13} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {fields.map((field) => (
            <FieldEntry
              key={field.name}
              field={field}
              value={row[field.name]}
            />
          ))}
        </div>
      </div>
    </>
  );
}
