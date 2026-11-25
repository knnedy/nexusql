import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/shared/lib/cx";

/** An applied filter: "column is value" with a remove button. */
export function FilterChip({ children, onRemove, removeLabel, className }: { children: ReactNode; onRemove: () => void; removeLabel: string; className?: string }) {
  return (
    <span className={cx("inline-flex h-[28px] items-center gap-[4px] rounded-full border border-accent-line bg-accent-tint pr-[3px] pl-[10px] text-label font-normal text-fg [&_b]:font-medium", className)}>
      {children}
      <button
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
        className="grid size-[22px] cursor-pointer place-items-center rounded-full text-fg-muted hover:bg-panel/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
        <X size={13} aria-hidden />
      </button>
    </span>
  );
}

export type BadgeTone = "neutral" | "accent" | "relation" | "warn" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-sunk text-fg-muted",
  accent: "border-accent-line/60 bg-accent-tint text-accent",
  relation: "border-relation-faint bg-relation-tint text-relation",
  warn: "border-warn/30 bg-warn-tint text-warn",
  danger: "border-danger/30 bg-danger-tint text-danger",
};

/** A small label: key kinds (PK, FK, CHECK), states, counts. */
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-[18px] items-center rounded-[4px] border px-[5px] text-caption font-semibold whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}
