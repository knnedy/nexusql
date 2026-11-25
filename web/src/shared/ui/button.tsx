"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { Tooltip } from "./tooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-control text-body font-medium select-none " +
  "transition-[transform,background-color,border-color,color] duration-150 ease-out-strong active:scale-[0.97] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-fill text-on-accent hover:bg-accent-fill/90",
  secondary: "border border-line-strong bg-panel text-fg hover:border-fg-subtle",
  ghost: "text-fg-muted hover:bg-sunk hover:text-fg",
  danger: "border border-danger/40 bg-danger-tint text-danger hover:border-danger",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-[28px] px-[10px]",
  md: "h-[30px] px-[12px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A text button; defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = "secondary", size = "md", type = "button", className, ...rest }: ButtonProps) {
  return <button type={type} className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...rest} />;
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  size?: ButtonSize;
  children: ReactNode;
}

/** An icon-only button; `label` is its accessible name and its tooltip. */
export function IconButton({ label, size = "md", type = "button", className, ...rest }: IconButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type={type}
        aria-label={label}
        className={cx(BASE, VARIANTS.ghost, size === "sm" ? "size-[28px]" : "size-[32px]", className)}
        {...rest}
      />
    </Tooltip>
  );
}
