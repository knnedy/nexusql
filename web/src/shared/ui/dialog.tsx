"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cx } from "@/shared/lib/cx";

export { Dialog };

interface DialogContentProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions along the bottom, primary last. */
  footer?: ReactNode;
  className?: string;
}

/** A centred modal for decisions that must block, such as confirming a write. */
export function DialogContent({ title, description, children, footer, className }: DialogContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ease-out-strong data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <Dialog.Popup
        className={cx(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-panel border border-line-strong bg-raised text-body text-fg shadow-float outline-none",
          "transition-[transform,opacity] duration-200 ease-out-strong data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0",
          className,
        )}>
        <div className="flex items-start gap-3 px-5 pt-4.5 pb-1">
          <div className="flex-1">
            <Dialog.Title className="text-subheading font-semibold">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-1 text-body text-fg-muted">{description}</Dialog.Description>}
          </div>
          <Dialog.Close aria-label="Close" className="-mr-1.5 grid size-7 cursor-pointer place-items-center rounded-control text-fg-subtle hover:bg-sunk hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
            <X size={16} aria-hidden />
          </Dialog.Close>
        </div>
        {children && <div className="min-h-0 overflow-auto px-5 py-3">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
