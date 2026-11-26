"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/shared/hooks/use-mounted";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "./button";

/** Flips light and dark; renders the moon until mounted so server and client agree. */
export function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <IconButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </IconButton>
  );
}
