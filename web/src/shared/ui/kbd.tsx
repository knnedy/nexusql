import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

/** One key of a shortcut; render several for a chord. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cx("inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border border-b-2 border-line-strong bg-sunk px-1 font-sans text-caption font-medium text-fg-muted", className)}>
      {children}
    </kbd>
  );
}
