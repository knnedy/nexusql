"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip as Base } from "@base-ui/react/tooltip";

/** Wrap the app once so moving between tooltips is instant after the first. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Base.Provider delay={500}>{children}</Base.Provider>;
}

/** A supplementary hover label; never the only place important text lives. */
export function Tooltip({ label, side = "top", children }: { label: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactElement }) {
  return (
    <Base.Root>
      <Base.Trigger render={children} />
      <Base.Portal>
        <Base.Positioner side={side} sideOffset={6} className="z-50">
          <Base.Popup className="origin-(--transform-origin) rounded-md bg-fg px-2 py-1 text-label text-ground shadow-card transition-[transform,opacity] duration-125 ease-out-strong data-ending-style:scale-97 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-97 data-starting-style:opacity-0">
            {label}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
