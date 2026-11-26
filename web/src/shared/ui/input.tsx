import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "@/shared/lib/cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** An icon before the text. */
  leading?: ReactNode;
  /** A hint after the text, such as a shortcut. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
}

/** A 32px text field; give it a label or aria-label. */
export function Input({ leading, trailing, className, wrapperClassName, ...rest }: InputProps) {
  return (
    <span
      className={cx(
        "flex h-8 items-center gap-2 rounded-control border border-line-strong bg-ground px-2.5 text-fg-subtle transition-[border-color,box-shadow] duration-150",
        "focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-tint has-aria-invalid:border-danger has-disabled:opacity-50 [&_svg]:size-3.75 [&_svg]:shrink-0",
        wrapperClassName,
      )}>
      {leading}
      <input className={cx("min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle", className)} {...rest} />
      {trailing}
    </span>
  );
}
