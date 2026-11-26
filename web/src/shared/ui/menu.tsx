"use client";

import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { cx } from "@/shared/lib/cx";
import { ITEM, POPUP } from "./popup";

export { Menu };

/** The popup of a Menu.Root, placed under its trigger. */
export function MenuContent({ children, align = "start", className }: { children: ReactNode; align?: "start" | "center" | "end"; className?: string }) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={6} align={align} className="z-50 outline-none">
        <Menu.Popup className={cx(POPUP, "min-w-45", className)}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  /** A shortcut hint shown at the end, such as "Ctrl C". */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ children, onClick, icon, hint, danger, disabled }: MenuItemProps) {
  return (
    <Menu.Item onClick={onClick} disabled={disabled} className={cx(ITEM, danger ? "text-danger [&_svg]:text-danger" : "[&_svg]:text-fg-subtle")}>
      {icon}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-label text-fg-subtle">{hint}</span>}
    </Menu.Item>
  );
}

export function MenuSeparator() {
  return <Menu.Separator className="mx-1.5 my-1 h-px bg-line" />;
}

export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Menu.Group>
      <Menu.GroupLabel className="px-2.5 pt-1.5 pb-0.5 text-label font-medium text-fg-subtle">{label}</Menu.GroupLabel>
      {children}
    </Menu.Group>
  );
}
