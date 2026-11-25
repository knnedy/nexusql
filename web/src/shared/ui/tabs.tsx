"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabsProps {
  label: string;
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Shared with TabPanel so tabs and panels point at each other. */
  idPrefix?: string;
  className?: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** Underlined view tabs; arrows, Home and End move and select (automatic activation). */
export function Tabs({ label, items, value, onChange, idPrefix, className }: TabsProps) {
  const fallback = useId();
  const prefix = idPrefix ?? fallback;
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function onKeyDown(e: KeyboardEvent) {
    const i = items.findIndex((t) => t.id === value);
    const last = items.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = items[next].id;
    onChange(id);
    refs.current.get(id)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cx("flex h-full items-stretch gap-[2px]", className)}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el);
              else refs.current.delete(t.id);
            }}
            type="button"
            role="tab"
            id={tabId(prefix, t.id)}
            aria-selected={on}
            aria-controls={panelId(prefix, t.id)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              "-mb-px inline-flex cursor-pointer items-center gap-[7px] border-b-2 px-[12px] text-body transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent [&_svg]:size-[15px]",
              on ? "border-accent font-medium text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}>
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** The region a tab controls. */
export function TabPanel({ idPrefix, id, className, children }: { idPrefix: string; id: string; className?: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} className={className}>
      {children}
    </div>
  );
}
