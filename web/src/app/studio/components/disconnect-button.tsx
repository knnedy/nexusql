"use client";

import { Unplug, Loader2 } from "lucide-react";
import { useDisconnect } from "@/hooks/use-disconnect";

interface DisconnectButtonProps {
  className?: string;
}

export default function DisconnectButton({
  className = "",
}: DisconnectButtonProps) {
  const disconnect = useDisconnect();

  return (
    <button
      onClick={() => disconnect.mutate()}
      disabled={disconnect.isPending}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium text-text-secondary dark:text-text-secondary/90 hover:text-coral hover:bg-coral/5 dark:hover:bg-coral/10 transition-all duration-150 cursor-pointer border-none bg-transparent group disabled:opacity-60 ${className}`}
      aria-label="Disconnect">
      {disconnect.isPending ? (
        <Loader2 size={12} className="animate-spin text-text-tertiary" />
      ) : (
        <Unplug
          size={12}
          className="text-text-tertiary group-hover:text-coral transition-colors"
          aria-hidden
        />
      )}
      <span className="tracking-tight antialiased">Disconnect</span>
    </button>
  );
}
