"use client";

import { X, Key, Link, Hash, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Field, Relation } from "@/lib/types";
import { FIELD_TYPE_BADGE_MAP } from "@/lib/types";
import { normalizeFieldType } from "@/lib/utils";
import { useStudioStore } from "@/lib/store/studio-store";
import { rowLookupQueryOptions } from "@/hooks/use-row-lookup";
import { api } from "@/lib/api";

interface RowDrawerProps {
  row: Record<string, unknown> | null;
  fields: Field[];
  relations: Relation[];
  rowIndex: number | null;
  tableName: string | null;
  onClose: () => void;
  onNavigate: (tableName: string) => void;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function formatValue(value: unknown): string {
  if (isNullish(value)) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function FieldEntry({
  field,
  value,
  relation,
  onNavigate,
}: {
  field: Field;
  value: unknown;
  relation: Relation | undefined;
  onNavigate: (tableName: string) => void;
}) {
  const provider = useStudioStore((s) => s.provider);
  const qc = useQueryClient();
  const [isNavigating, setIsNavigating] = useState(false);

  const canonicalType = normalizeFieldType(field.type, provider);
  const variant = FIELD_TYPE_BADGE_MAP[canonicalType] ?? "gray";
  const nullish = isNullish(value);
  const formatted = formatValue(value);
  const isLong = formatted.length > 60;
  const canNavigate = field.isForeignKey && relation && !nullish;

  const badgeStyles = {
    teal: "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal border-black/2 dark:border-white/2",
    coral:
      "bg-badge-coral-bg/15 text-badge-coral-text dark:bg-badge-coral-bg/20 dark:text-coral border-black/2 dark:border-white/2",
    gray: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20 dark:text-text-secondary border-black/2 dark:border-white/2",
  } as const;

  async function handleNavigate() {
    if (!canNavigate || !relation) return;
    setIsNavigating(true);
    try {
      await qc.prefetchQuery(
        rowLookupQueryOptions(
          relation.targetTable,
          relation.targetField,
          String(value),
          true,
        ),
      );
      onNavigate(relation.targetTable);
    } finally {
      setIsNavigating(false);
    }
  }

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
        {canNavigate && (
          <span className="text-[9px] font-mono text-text-tertiary">
            → {relation.targetTable}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider border font-mono ml-auto shrink-0 ${badgeStyles[variant]}`}>
          {field.type}
        </span>
      </div>

      <div className="flex items-start gap-2 ml-5.5">
        {nullish ? (
          <span className="text-[11px] font-mono italic text-text-tertiary/50">
            null
          </span>
        ) : isLong ? (
          <pre className="flex-1 text-[10.5px] font-mono text-text-secondary/90 whitespace-pre-wrap break-all leading-relaxed select-text bg-black/5 dark:bg-black/30 rounded-lg px-3 py-2 border border-node-border/40">
            {formatted}
          </pre>
        ) : (
          <span className="flex-1 text-[11px] font-mono text-text-secondary/90 select-text break-all">
            {formatted}
          </span>
        )}

        {canNavigate && (
          <button
            onClick={handleNavigate}
            disabled={isNavigating}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-teal hover:bg-teal/10 transition-colors border-none bg-transparent cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed mt-0.5"
            aria-label={`Navigate to ${relation?.targetTable}`}>
            {isNavigating ? (
              <Loader2 size={11} className="animate-spin" aria-hidden />
            ) : (
              <ExternalLink size={11} aria-hidden />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RowDrawer({
  row,
  fields,
  relations,
  rowIndex,
  tableName,
  onClose,
  onNavigate,
}: RowDrawerProps) {
  if (!row) return null;

  const relLookup = new Map(
    relations.map((r) => [`${r.sourceTable}.${r.sourceField}`, r]),
  );

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
              relation={relLookup.get(`${tableName}.${field.name}`)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </>
  );
}
