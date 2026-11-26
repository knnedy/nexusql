import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

/** What a region shows when it has nothing yet: what this is, and the next step. */
export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center gap-2 px-6 py-8 text-center", className)}>
      {icon && <span className="mb-1 grid size-10 place-items-center rounded-card bg-sunk text-fg-subtle [&_svg]:size-5">{icon}</span>}
      <p className="text-title font-semibold text-fg">{title}</p>
      {children && <p className="max-w-[44ch] text-body text-fg-muted">{children}</p>}
      {action && <div className="mt-2 flex gap-2">{action}</div>}
    </div>
  );
}
