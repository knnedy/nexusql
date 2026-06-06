"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Database, FolderOpen, Moon, Sun } from "lucide-react";

export default function TopNav() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <nav className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 h-12 bg-surface-1 border-b-[0.5px] border-border">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-coral">
          <Database size={13} color="#fff" aria-hidden />
        </div>
        <span className="text-base font-semibold text-text-primary tracking-[-0.02em]">
          NexusQL
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/projects")}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm text-text-secondary bg-surface-2 border-[0.5px] border-border hover:bg-surface-3 transition-colors cursor-pointer">
          <FolderOpen size={14} aria-hidden />
          All projects
        </button>

        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary bg-surface-2 border-[0.5px] border-border hover:bg-surface-3 transition-colors cursor-pointer"
          aria-label="Toggle theme">
          {!mounted ? (
            <div className="w-3.75 h-3.75" />
          ) : resolvedTheme === "dark" ? (
            <Sun size={15} aria-hidden />
          ) : (
            <Moon size={15} aria-hidden />
          )}
        </button>
      </div>
    </nav>
  );
}
