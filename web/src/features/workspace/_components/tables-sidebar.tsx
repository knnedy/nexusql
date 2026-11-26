"use client";

import { useMemo, useState, type ReactNode, type Ref } from "react";
import { ArrowLeft, ArrowRight, PanelLeftClose, PanelLeftOpen, Search, Table2 } from "lucide-react";
import { cx } from "@/shared/lib/cx";
import type { Relation, Table } from "@/shared/types/schema";
import { IconButton } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { linkedTables } from "@/shared/lib/linked-tables";

interface TablesSidebarProps {
  tables: Table[];
  relations: Relation[];
  selected: string | null;
  onSelect: (table: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  /** Tools pinned under the list. */
  footer?: ReactNode;
  /** The filter field, for the / shortcut. */
  filterRef?: Ref<HTMLInputElement>;
}

const ROW =
  "grid w-full cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2 rounded-control px-2 py-1.5 text-left text-body " +
  "hover:bg-sunk focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/** Every table, led by those linked to the selected one; filter with the field at the top. */
export function TablesSidebar({ tables, relations, selected, onSelect, collapsed, onToggle, footer, filterRef }: TablesSidebarProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  const linked = useMemo(() => (selected ? linkedTables(selected, relations) : []), [selected, relations]);
  const sorted = useMemo(() => [...tables].sort((a, b) => a.name.localeCompare(b.name)), [tables]);
  const shownLinked = linked.filter((l) => match(l.table));
  const shownAll = sorted.filter((t) => match(t.name));

  if (collapsed) {
    return (
      <aside aria-label="Tables" className="row-span-3 flex flex-col items-center border-r border-line-strong bg-panel pt-2">
        <IconButton label="Show tables" onClick={onToggle}>
          <PanelLeftOpen aria-hidden />
        </IconButton>
      </aside>
    );
  }

  return (
    <aside aria-label="Tables" className="row-span-3 flex min-h-0 flex-col border-r border-line-strong bg-panel">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line pr-2 pl-4">
        <span className="text-body font-semibold">Tables</span>
        <span className="text-label text-fg-subtle tabular-nums">{tables.length}</span>
        <IconButton label="Hide tables" onClick={onToggle} className="ml-auto">
          <PanelLeftClose aria-hidden />
        </IconButton>
      </div>
      <div className="shrink-0 px-2.5 pt-2.5 pb-1">
        <Input ref={filterRef} aria-label="Filter tables" placeholder="Filter tables" value={query} onChange={(e) => setQuery(e.target.value)} leading={<Search aria-hidden />} />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {shownLinked.length > 0 && (
          <section aria-label={`Linked to ${selected}`}>
            <h3 className="mx-2 mt-3 mb-1 flex text-label font-medium text-fg-subtle">
              Linked to {selected}
              <span className="ml-auto font-normal tabular-nums">{shownLinked.length}</span>
            </h3>
            {shownLinked.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => onSelect(l.table)}
                title={l.direction === "out" ? `${selected} points to ${l.table}` : `${l.table} points to ${selected}`}
                className={ROW}>
                {l.direction === "out" ? (
                  <ArrowRight aria-label="points to" className="size-3.5 text-relation" />
                ) : (
                  <ArrowLeft aria-label="pointed to by" className="size-3.5 text-relation" />
                )}
                <span className="truncate">{l.table}</span>
                <span className="col-start-2 truncate font-mono text-caption text-fg-subtle">{l.via}</span>
              </button>
            ))}
          </section>
        )}
        <section aria-label="All tables">
          <h3 className="mx-2 mt-3 mb-1 flex text-label font-medium text-fg-subtle">
            All tables
            <span className="ml-auto font-normal tabular-nums">{shownAll.length}</span>
          </h3>
          {shownAll.map((t) => {
            const on = t.name === selected;
            return (
              <button
                key={t.name}
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => onSelect(t.name)}
                className={cx(ROW, on && "bg-accent-tint font-semibold hover:bg-accent-tint")}>
                <Table2 aria-hidden className={cx("size-3.5", on ? "text-accent" : "text-fg-subtle")} />
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
          {shownAll.length === 0 && (
            <p className="px-2 py-4 text-label text-fg-subtle">{q ? `No table matches “${query.trim()}”.` : "This database has no tables yet."}</p>
          )}
        </section>
      </nav>
      {footer && <div className="flex flex-col gap-0.5 border-t border-line p-2">{footer}</div>}
    </aside>
  );
}
