"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Plus, X } from "lucide-react";

import type { EnumType, Field } from "@/shared/types/schema";
import {
  OP_LABELS,
  choicesFor,
  isComplete,
  kindOf,
  opsFor,
  takesNoValue,
  type FilterOp,
  type RowFilter,
} from "../lib/filters";

interface FilterMenuProps {
  fields: Field[];
  enums: EnumType[];
  filters: RowFilter[];
  onApply: (filters: RowFilter[]) => void;
}

const control =
  "h-7 rounded-md border border-node-border/60 dark:border-node-border/40 bg-node-bg text-[11px] font-mono text-text-primary px-1.5 outline-none focus:border-teal/60";
const pressable = "transition-[color,background-color,transform] duration-150 active:scale-[0.97]";

export default function FilterMenu({ fields, enums, filters, onApply }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RowFilter[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) setDraft(filters.length ? filters : [blank()]);
    setOpen((o) => !o);
  }

  function blank(): RowFilter {
    const f = fields[0];
    return { column: f?.name ?? "", op: f ? opsFor(kindOf(f, enums))[0] : "eq", values: [] };
  }

  function change(i: number, next: RowFilter) {
    setDraft((d) => d.map((f, j) => (j === i ? next : f)));
  }

  function apply() {
    if (!draft.every(isComplete)) return;
    onApply(draft);
    setOpen(false);
  }

  const canApply = draft.every(isComplete);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[11.5px] font-medium cursor-pointer bg-transparent ${pressable} ${
          open || filters.length
            ? "border-teal/40 text-teal bg-teal/5"
            : "border-node-border/60 dark:border-node-border/40 text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2"
        }`}>
        <ListFilter size={13} aria-hidden />
        <span>Filters</span>
        {filters.length > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal text-[9px] font-bold text-white leading-none">
            {filters.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filters"
          className="absolute top-full left-0 mt-1.5 w-max min-w-80 max-w-[min(36rem,calc(100vw-2rem))] origin-top-left rounded-xl border border-node-border/60 dark:border-node-border/40 bg-node-bg/98 dark:bg-node-bg/99 backdrop-blur-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col gap-1.5 p-2.5 max-h-80 overflow-y-auto">
            {draft.length === 0 && (
              <span className="px-1 py-1.5 text-[11px] text-text-tertiary">
                No filters. Every row is shown.
              </span>
            )}
            {draft.map((f, i) => (
              <FilterRow
                key={i}
                filter={f}
                fields={fields}
                enums={enums}
                onChange={(next) => change(i, next)}
                onRemove={() => setDraft((d) => d.filter((_, j) => j !== i))}
                onSubmit={apply}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 px-2.5 py-2 border-t border-node-border/40">
            <button
              onClick={() => setDraft((d) => [...d, blank()])}
              className={`flex items-center gap-1 h-7 px-2 rounded-md border-none bg-transparent text-[11px] font-medium text-teal hover:bg-teal/5 cursor-pointer ${pressable}`}>
              <Plus size={12} aria-hidden />
              Add filter
            </button>
            <div className="flex-1" />
            {draft.length > 0 && (
              <button
                onClick={() => setDraft([])}
                className={`h-7 px-2 rounded-md border-none bg-transparent text-[11px] font-medium text-text-tertiary hover:text-text-primary cursor-pointer ${pressable}`}>
                Clear all
              </button>
            )}
            <button
              onClick={apply}
              disabled={!canApply}
              className={`h-7 px-3 rounded-md border-none bg-teal text-white text-[11px] font-semibold hover:bg-teal-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${pressable}`}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterRowProps {
  filter: RowFilter;
  fields: Field[];
  enums: EnumType[];
  onChange: (f: RowFilter) => void;
  onRemove: () => void;
  onSubmit: () => void;
}

function FilterRow({ filter, fields, enums, onChange, onRemove, onSubmit }: FilterRowProps) {
  const field = fields.find((f) => f.name === filter.column);
  const kind = field ? kindOf(field, enums) : "other";
  const ops = opsFor(kind);
  const choices = field ? choicesFor(field, enums) : null;

  function setColumn(name: string) {
    const next = fields.find((f) => f.name === name);
    const nextOps = next ? opsFor(kindOf(next, enums)) : ops;
    onChange({ column: name, op: nextOps.includes(filter.op) ? filter.op : nextOps[0], values: [] });
  }

  function setOp(op: FilterOp) {
    const keep = !takesNoValue(op) && (op === "in") === (filter.op === "in");
    onChange({ ...filter, op, values: keep ? filter.values : [] });
  }

  return (
    <div className="flex items-start gap-1.5">
      <select aria-label="Filter column" value={filter.column} onChange={(e) => setColumn(e.target.value)} className={`${control} w-36`}>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      <select aria-label="Filter operator" value={filter.op} onChange={(e) => setOp(e.target.value as FilterOp)} className={`${control} w-28`}>
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>
      <div className="flex-1 min-w-36">
        {takesNoValue(filter.op) ? null : filter.op === "in" && choices ? (
          <div role="group" aria-label="Filter values" className="flex flex-wrap gap-1">
            {choices.map((c) => {
              const on = filter.values.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({ ...filter, values: on ? filter.values.filter((v) => v !== c) : [...filter.values, c] })
                  }
                  className={`h-7 px-2 rounded-md border text-[11px] font-mono cursor-pointer ${pressable} ${
                    on
                      ? "border-teal/60 bg-teal/10 text-teal"
                      : "border-node-border/60 dark:border-node-border/40 bg-transparent text-text-secondary hover:text-text-primary"
                  }`}>
                  {c}
                </button>
              );
            })}
          </div>
        ) : choices ? (
          <select
            aria-label="Filter value"
            value={filter.values[0] ?? ""}
            onChange={(e) => onChange({ ...filter, values: [e.target.value] })}
            className={`${control} w-full`}>
            <option value="" disabled>
              Pick a value
            </option>
            {choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Filter value"
            value={filter.values[0] ?? ""}
            inputMode={kind === "number" ? "decimal" : undefined}
            placeholder={kind === "temporal" ? "2026-01-31" : kind === "number" ? "0" : "value"}
            onChange={(e) => onChange({ ...filter, values: [e.target.value] })}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            className={`${control} w-full`}
          />
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove filter on ${filter.column}`}
        onClick={onRemove}
        className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-md border-none bg-transparent text-text-tertiary hover:text-text-primary cursor-pointer ${pressable}`}>
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}
