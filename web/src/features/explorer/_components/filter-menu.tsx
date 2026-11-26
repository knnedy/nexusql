"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ListFilter, Plus, X } from "lucide-react";
import { cx } from "@/shared/lib/cx";
import type { EnumType, Field } from "@/shared/types/schema";
import { Button, IconButton } from "@/shared/ui/button";
import { POPUP } from "@/shared/ui/popup";
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

// Native selects keep keyboard and type-ahead; explicit colours for Windows dark mode.
const control =
  "h-7.5 rounded-control border border-line-strong bg-panel px-2 text-label text-fg outline-none hover:border-fg-subtle focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-tint";

/** Edits every filter at once; Apply writes them to the URL. */
export default function FilterMenu({ fields, enums, filters, onApply }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RowFilter[]>([]);

  function blank(): RowFilter {
    const f = fields[0];
    return { column: f?.name ?? "", op: f ? opsFor(kindOf(f, enums))[0] : "eq", values: [] };
  }
  function change(i: number, next: RowFilter) {
    setDraft((d) => d.map((f, j) => (j === i ? next : f)));
  }
  const canApply = draft.every(isComplete);
  function apply() {
    if (!canApply) return;
    onApply(draft);
    setOpen(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(filters.length ? filters : [blank()]);
        setOpen(next);
      }}>
      <Popover.Trigger render={<Button size="sm" variant="ghost" />}>
        <ListFilter aria-hidden />
        Filter
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50 outline-none">
          <Popover.Popup aria-label="Filters" className={cx(POPUP, "w-max max-w-[min(38rem,calc(100vw-2rem))] min-w-90 p-0")}>
            <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto overscroll-contain p-2.5">
              {draft.length === 0 && <p className="px-1 py-1.5 text-label text-fg-subtle">No filters. Every row is shown.</p>}
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
            <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">
              <Button size="sm" variant="ghost" onClick={() => setDraft((d) => [...d, blank()])}>
                <Plus aria-hidden />
                Add filter
              </Button>
              <div className="flex-1" />
              {draft.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setDraft([])}>
                  Clear all
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={apply} disabled={!canApply}>
                Apply
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
      <select aria-label="Filter column" value={filter.column} onChange={(e) => setColumn(e.target.value)} className={cx(control, "w-36 font-mono")}>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      <select aria-label="Filter operator" value={filter.op} onChange={(e) => setOp(e.target.value as FilterOp)} className={cx(control, "w-28")}>
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>
      <div className="min-w-36 flex-1">
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
                  className={cx(
                    "h-7.5 cursor-pointer rounded-control border px-2 font-mono text-label transition-transform duration-150 ease-out-strong active:scale-97",
                    on ? "border-accent-line bg-accent-tint text-accent" : "border-line-strong text-fg-muted hover:text-fg",
                  )}>
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
            className={cx(control, "w-full")}>
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
            placeholder={kind === "temporal" ? "2026-01-31…" : kind === "number" ? "0…" : "Value…"}
            onChange={(e) => onChange({ ...filter, values: [e.target.value] })}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            className={cx(control, "w-full")}
          />
        )}
      </div>
      <IconButton label={`Remove filter on ${filter.column}`} size="sm" onClick={onRemove} className="size-7.5">
        <X aria-hidden />
      </IconButton>
    </div>
  );
}
