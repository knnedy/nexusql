"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { ChevronDown, FolderOpen, Moon, Sun, Unplug } from "lucide-react";
import icon from "@/app/icon.png";
import { useDisconnect } from "@/features/studio/hooks/use-disconnect";
import { cx } from "@/shared/lib/cx";
import { useReadOnly } from "@/shared/hooks/use-read-only";
import { useSchema } from "@/shared/hooks/use-schema";
import { useStudioStore } from "@/shared/store/studio-store";
import { PROVIDERS } from "@/shared/types/provider";
import { IconButton } from "@/shared/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator } from "@/shared/ui/menu";

const noop = () => () => {};

function ConnectionStatus() {
  const { isSuccess, isError } = useSchema();
  const [dot, label] = isError ? ["bg-danger", "Not connected"] : isSuccess ? ["bg-relation-line", "Connected"] : ["bg-warn", "Connecting…"];
  return (
    <span className="inline-flex items-center gap-1.75 text-label text-fg-muted" role="status">
      <i aria-hidden className={cx("size-1.75 rounded-full", dot)} />
      {label}
    </span>
  );
}

function AccessSwitch() {
  const { readOnly, setReadOnly, isPending } = useReadOnly();
  const seg = (on: boolean) =>
    cx(
      "h-full cursor-pointer px-2.5 text-label transition-colors duration-150 disabled:cursor-default",
      on ? "bg-sunk font-medium text-fg" : "text-fg-muted hover:text-fg",
    );
  return (
    <div role="group" aria-label="Access" className="inline-flex h-7.5 overflow-hidden rounded-control border border-line-strong">
      <button type="button" aria-pressed={readOnly} disabled={isPending} onClick={() => setReadOnly(true)} className={seg(readOnly)}>
        Read-only
      </button>
      <button type="button" aria-pressed={!readOnly} disabled={isPending} onClick={() => setReadOnly(false)} className={seg(!readOnly)}>
        Read-write
      </button>
    </div>
  );
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <IconButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </IconButton>
  );
}

/** The app bar: project menu, connection, access and theme. */
export function TopBar() {
  const router = useRouter();
  const disconnect = useDisconnect();
  const projectName = useStudioStore((s) => s.projectName);
  const provider = useStudioStore((s) => s.provider);
  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;

  return (
    <header className="col-span-2 flex h-13 items-center gap-3 border-b border-line bg-panel pr-3 pl-3.5">
      <Image src={icon} alt="NexusQL" width={28} height={28} className="shrink-0" priority />
      <Menu.Root>
        <Menu.Trigger className="flex h-8.5 cursor-pointer items-center gap-2 rounded-control px-2.5 hover:bg-sunk focus-visible:outline-2 focus-visible:outline-accent data-popup-open:bg-sunk">
          <span className="text-title font-semibold">{projectName}</span>
          <span className="text-label text-fg-subtle">{providerLabel}</span>
          <ChevronDown aria-hidden className="size-3.75 text-fg-subtle" />
        </Menu.Trigger>
        <MenuContent>
          <MenuItem icon={<FolderOpen aria-hidden />} onClick={() => router.push("/projects")}>
            All projects
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Unplug aria-hidden />} onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            Disconnect
          </MenuItem>
        </MenuContent>
      </Menu.Root>
      <div className="flex-1" />
      <ConnectionStatus />
      <AccessSwitch />
      <ThemeButton />
    </header>
  );
}
