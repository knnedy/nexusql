import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

/** One key of a shortcut; render several for a chord. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cx("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-b-2 border-line-strong bg-sunk px-[4px] font-sans text-caption font-medium text-fg-muted", className)}>
      {children}
    </kbd>
  );
}
