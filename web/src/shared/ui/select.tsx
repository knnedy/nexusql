"use client";

import { Select as Base } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cx } from "@/shared/lib/cx";
import { ITEM, POPUP } from "./popup";

export interface SelectItem {
  value: string;
  label: string;
}

interface SelectProps {
  items: SelectItem[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

/** A single-choice select; give it an aria-label or a visible label. */
export function Select({ items, value, onValueChange, placeholder, disabled, className, ...aria }: SelectProps) {
  return (
    <Base.Root items={items} value={value} onValueChange={(v) => v !== null && onValueChange(v as string)} disabled={disabled}>
      <Base.Trigger
        aria-label={aria["aria-label"]}
        className={cx(
          "inline-flex h-7.5 min-w-18 cursor-pointer items-center justify-between gap-2 rounded-control border border-line-strong bg-panel pr-1.5 pl-2.5 text-body text-fg select-none",
          "hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:opacity-50",
          className,
        )}>
        <Base.Value className="data-placeholder:text-fg-subtle" placeholder={placeholder} />
        <Base.Icon className="text-fg-subtle">
          <ChevronsUpDown size={14} aria-hidden />
        </Base.Icon>
      </Base.Trigger>
      <Base.Portal>
        <Base.Positioner sideOffset={4} className="z-50 outline-none select-none">
          <Base.Popup className={cx(POPUP, "min-w-(--anchor-width) data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100")}>
            <Base.List className="max-h-(--available-height) overflow-y-auto">
              {items.map((it) => (
                <Base.Item key={it.value} value={it.value} className={cx(ITEM, "grid grid-cols-[15px_1fr] pr-3.5")}>
                  <Base.ItemIndicator className="col-start-1 text-accent">
                    <Check aria-hidden />
                  </Base.ItemIndicator>
                  <Base.ItemText className="col-start-2">{it.label}</Base.ItemText>
                </Base.Item>
              ))}
            </Base.List>
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
