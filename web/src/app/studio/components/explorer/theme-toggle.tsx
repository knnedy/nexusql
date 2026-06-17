"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors cursor-pointer border-none bg-transparent ${className}`}
      aria-label="Toggle theme">
      {!mounted ? (
        <div className="w-3.5 h-3.5" />
      ) : resolvedTheme === "dark" ? (
        <Sun size={13} aria-hidden />
      ) : (
        <Moon size={13} aria-hidden />
      )}
    </button>
  );
}
