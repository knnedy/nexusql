"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface ModeSwitcherProps {
  className?: string;
}

export default function ModeSwitcher({ className = "" }: ModeSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isCanvas = pathname === "/studio/canvas";

  return (
    <div
      className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-node-header-bg/60 dark:bg-node-header-bg/40 border border-node-border/60 dark:border-node-border/30 ${className}`}>
      <button
        onClick={() => router.push("/studio/canvas")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 border-none cursor-pointer ${
          isCanvas
            ? "bg-node-bg text-text-primary shadow-sm"
            : "bg-transparent text-text-tertiary hover:text-text-secondary"
        }`}>
        <LayoutGrid size={11} aria-hidden />
        <span>Canvas</span>
      </button>
      <button
        onClick={() => router.push("/studio/explorer")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 border-none cursor-pointer ${
          !isCanvas
            ? "bg-node-bg text-text-primary shadow-sm"
            : "bg-transparent text-text-tertiary hover:text-text-secondary"
        }`}>
        <Table2 size={11} aria-hidden />
        <span>Explorer</span>
      </button>
    </div>
  );
}
