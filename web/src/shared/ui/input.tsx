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
        "flex h-[32px] items-center gap-[8px] rounded-control border border-line-strong bg-ground px-[10px] text-fg-subtle transition-[border-color,box-shadow] duration-150",
        "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--nx-accent-tint)] has-[:disabled]:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0",
        wrapperClassName,
      )}>
      {leading}
      <input className={cx("min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle", className)} {...rest} />
      {trailing}
    </span>
  );
}
