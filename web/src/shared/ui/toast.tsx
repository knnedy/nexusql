"use client";

import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import { cx } from "@/shared/lib/cx";

export type ToastTone = "neutral" | "success" | "danger";

/** Wrap the app once; toasts stack at the bottom right. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-[16px] bottom-[16px] z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col-reverse gap-[8px] outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

const DOT: Record<ToastTone, string> = { neutral: "bg-fg-subtle", success: "bg-relation-line", danger: "bg-danger" };

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root
      key={t.id}
      toast={t}
      className="rounded-card border border-line-strong bg-raised shadow-float transition-[transform,opacity] duration-[400ms] ease-out-strong data-ending-style:translate-y-[12px] data-ending-style:opacity-0 data-starting-style:translate-y-[12px] data-starting-style:opacity-0">
      <Toast.Content className="flex items-start gap-[10px] px-[14px] py-[12px]">
        <span aria-hidden className={cx("mt-[6px] size-[7px] shrink-0 rounded-full", DOT[(t.type as ToastTone) ?? "neutral"] ?? DOT.neutral)} />
        <div className="min-w-0 flex-1">
          <Toast.Title className="text-body font-medium text-fg" />
          <Toast.Description className="text-label text-fg-muted" />
        </div>
        <Toast.Close aria-label="Dismiss" className="-mt-[2px] -mr-[4px] grid size-[24px] cursor-pointer place-items-center rounded-control text-fg-subtle hover:bg-sunk hover:text-fg">
          <X size={14} aria-hidden />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

/** Returns a function that shows a toast. */
export function useToast() {
  const manager = Toast.useToastManager();
  return ({ title, description, tone = "neutral" }: { title: string; description?: string; tone?: ToastTone }) =>
    manager.add({ title, description, type: tone });
}
