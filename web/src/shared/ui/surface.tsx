import type { HTMLAttributes } from "react";
import { cx } from "@/shared/lib/cx";

/** A floating panel (details card, popover body): raised, rounded, Float shadow. */
export function FloatCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-panel border border-line-strong bg-raised shadow-float", className)} {...rest} />;
}

/** A placeholder block while content loads; still under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("rounded-sm bg-sunk motion-safe:animate-pulse", className)} />;
}
