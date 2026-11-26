"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Columns3, CornerDownLeft, Search, Table2, Zap, LayoutPanelTop } from "lucide-react";
import { cx } from "@/shared/lib/cx";
import { Kbd } from "@/shared/ui/kbd";
import { rankItems, type SearchItem, type SearchKind } from "../lib/search";

const GROUPS: Record<SearchKind, { label: string; icon: ReactNode }> = {
  table: { label: "Tables", icon: <Table2 aria-hidden /> },
  column: { label: "Columns", icon: <Columns3 aria-hidden /> },
  view: { label: "Views", icon: <LayoutPanelTop aria-hidden /> },
  action: { label: "Actions", icon: <Zap aria-hidden /> },
};
const MAX_RESULTS = 60;

interface SearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SearchItem[];
  onRun: (item: SearchItem) => void;
}

/** Go to a table, column, view or action by typing; opened with Ctrl+K. */
export function SearchPanel({ open, onOpenChange, items, onRun }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Opened from the keyboard many times a day, so it appears without motion. */}
        <Dialog.Backdrop className="fixed inset-0 top-13 z-50 bg-black/20" />
        <Dialog.Popup
          initialFocus={inputRef}
          className="fixed top-11 left-1/2 z-50 flex max-h-[min(39rem,calc(100vh-4rem))] w-[min(37.5rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-panel border border-line-strong bg-raised text-body text-fg shadow-float outline-none">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Results
            inputRef={inputRef}
            items={items}
            onRun={(item) => {
              onOpenChange(false);
              onRun(item);
            }}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Results({ inputRef, items, onRun }: { inputRef: React.RefObject<HTMLInputElement | null>; items: SearchItem[]; onRun: (item: SearchItem) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  // Grouped by kind, groups in the order of their best match; the flat list follows suit.
  const groups = useMemo(() => {
    const byKind = new Map<SearchKind, SearchItem[]>();
    for (const item of rankItems(query, items).slice(0, MAX_RESULTS)) {
      byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
    }
    return [...byKind.entries()];
  }, [query, items]);
  const flat = groups.flatMap(([, list]) => list);
  const current = Math.min(active, flat.length - 1);

  function onKeyDown(e: React.KeyboardEvent) {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = (current + step + flat.length) % flat.length;
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView?.({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      onRun(flat[current]);
    }
  }

  let index = -1;
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
        <input
          ref={inputRef}
          autoFocus
          role="combobox"
          aria-label="Search"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat.length ? optionId(current) : undefined}
          placeholder="Go to a table, column or action"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-title text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>

      <div id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {flat.length === 0 && <p className="px-3 py-6 text-center text-body text-fg-subtle">Nothing matches “{query.trim()}”.</p>}
        {groups.map(([kind, list]) => (
          <div key={kind} role="group" aria-label={GROUPS[kind].label}>
            <p aria-hidden className="flex px-2.5 pt-2.5 pb-1 text-label font-medium text-fg-subtle">
              {GROUPS[kind].label}
              <span className="ml-auto font-normal tabular-nums">{list.length}</span>
            </p>
            {list.map((item) => {
              const i = ++index;
              const on = i === current;
              return (
                <div
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={on}
                  onMouseMove={() => setActive(i)}
                  onClick={() => onRun(item)}
                  className={cx(
                    "flex h-9 cursor-pointer items-center gap-2.5 rounded-control px-2.5 [&_svg]:size-3.75 [&_svg]:shrink-0",
                    on ? "bg-accent-tint [&>svg]:text-accent" : "[&>svg]:text-fg-subtle",
                  )}>
                  {GROUPS[kind].icon}
                  <span className={cx("truncate", kind === "column" && "font-mono text-label")}>{item.label}</span>
                  {item.detail && <span className="ml-auto shrink-0 text-label text-fg-subtle">{item.detail}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <footer className="flex shrink-0 items-center gap-4 border-t border-line bg-sunk px-3.5 py-2 text-label whitespace-nowrap text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>
            <CornerDownLeft aria-label="Enter" className="size-2.5" />
          </Kbd>
          open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          close
        </span>
      </footer>
    </>
  );
}
