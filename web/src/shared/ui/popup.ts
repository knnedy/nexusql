// Shared look and motion for floating popups: 150ms scale from the trigger.
export const POPUP =
  "rounded-card border border-line-strong bg-raised p-[4px] text-body text-fg shadow-float outline-none " +
  "origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-out-strong " +
  "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0";

export const ITEM =
  "flex h-[32px] cursor-default items-center gap-[10px] rounded-[7px] px-[10px] outline-none select-none " +
  "data-highlighted:bg-sunk data-disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0";
