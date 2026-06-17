"use client";

import { Unplug, Loader2 } from "lucide-react";
import { useDisconnect } from "@/hooks/use-disconnect";

interface DisconnectButtonProps {
  className?: string;
}

export default function DisconnectButton({
  className = "px-4 py-2", // Provides a safe fallback if used outside the toolbar without props
}: DisconnectButtonProps) {
  const disconnect = useDisconnect();

  return (
    <button
      onClick={() => disconnect.mutate()}
      disabled={disconnect.isPending}
      className={`flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-text-secondary dark:text-text-secondary/90 hover:text-coral transition-all duration-150 cursor-pointer border-none bg-transparent group disabled:opacity-60 ${className}`}
      aria-label="Disconnect">
      {disconnect.isPending ? (
        <Loader2 size={13} className="animate-spin text-text-tertiary" />
      ) : (
        <Unplug
          size={13}
          className="text-text-tertiary group-hover:text-coral transition-colors"
          aria-hidden
        />
      )}
      <span className="tracking-tight antialiased mt-px">Disconnect</span>
    </button>
  );
}
