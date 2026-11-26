"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import icon from "@/app/icon.png";
import { ThemeButton } from "@/shared/ui/theme-button";

const noop = () => () => {};

/** The bar above the connect and projects pages: brand, where the server runs, theme. */
export function AppBar({ children }: { children?: ReactNode }) {
  const host = useSyncExternalStore(noop, () => window.location.host, () => "");
  return (
    <header className="sticky top-0 z-20 flex h-13 items-center gap-3 border-b border-line bg-panel pr-3 pl-1.5">
      <a
        href="#main"
        className="sr-only rounded-control bg-panel px-3 py-1.5 text-body font-medium focus:not-sr-only focus:absolute focus:top-2.5 focus:left-2 focus:outline-2 focus:outline-accent">
        Skip to content
      </a>
      <Link href="/" className="flex items-center rounded-control pr-2 focus-visible:outline-2 focus-visible:outline-accent">
        {/* The icon file has 17% clear padding; the negative margin takes it back. */}
        <Image src={icon} alt="" width={44} height={44} className="-mr-1 shrink-0" priority />
        <span className="text-subheading font-semibold tracking-tight text-fg">NexusQL</span>
      </Link>
      <div className="flex-1" />
      {host && (
        <span className="hidden items-center gap-1.75 text-label text-fg-muted sm:inline-flex">
          <span aria-hidden className="size-1.75 rounded-full bg-relation-line" />
          Running on {host}
        </span>
      )}
      {children}
      <ThemeButton />
    </header>
  );
}
