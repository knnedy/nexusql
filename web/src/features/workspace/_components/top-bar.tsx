"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, FolderOpen, Search, Unplug } from "lucide-react";
import icon from "@/app/icon.png";
import { useDisconnect } from "@/features/studio/hooks/use-disconnect";
import { cx } from "@/shared/lib/cx";
import { useReadOnly } from "@/shared/hooks/use-read-only";
import { useSchema } from "@/shared/hooks/use-schema";
import { useStudioStore } from "@/shared/store/studio-store";
import { PROVIDERS } from "@/shared/types/provider";
import { Kbd } from "@/shared/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuSeparator } from "@/shared/ui/menu";
import { ThemeButton } from "@/shared/ui/theme-button";

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

/** The app bar: project menu, connection, access and theme. */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const router = useRouter();
  const disconnect = useDisconnect();
  const projectName = useStudioStore((s) => s.projectName);
  const provider = useStudioStore((s) => s.provider);
  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;

  return (
    <header className="col-span-2 flex h-13 items-center gap-3 border-b border-line bg-panel pr-3 pl-3.5">
      {/* The icon file has 17% clear padding; the negative margin takes it back. */}
      <Image src={icon} alt="NexusQL" width={44} height={44} className="-mx-2 shrink-0" priority />
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
      <div className="flex min-w-0 flex-1 justify-center px-4">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onSearch}
          className="flex h-9 w-full max-w-140 cursor-pointer items-center gap-2.5 rounded-card border border-line-strong bg-ground pr-2 pl-3 text-left text-body text-fg-subtle transition-colors duration-150 hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-accent">
          <Search aria-hidden className="size-3.75 shrink-0" />
          <span className="flex-1 truncate">Go to a table, column or action</span>
          <span className="flex gap-0.5" aria-hidden>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>
      <ConnectionStatus />
      <AccessSwitch />
      <ThemeButton />
    </header>
  );
}
