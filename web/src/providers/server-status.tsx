"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { Terminal, Wifi, WifiOff } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { api } from "@/lib/api";

// Context
interface ServerStatusContextValue {
  isOnline: boolean;
  isChecking: boolean;
}

const ServerStatusContext = createContext<ServerStatusContextValue>({
  isOnline: false,
  isChecking: true,
});

export function useServerStatus(): ServerStatusContextValue {
  return useContext(ServerStatusContext);
}

// Restart command snippet
const RESTART_CMD = "nexusql";

function OfflineBanner() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(RESTART_CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-4 py-2 text-sm"
      style={{
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
      }}>
      {/* Left — status */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: "#EF4444" }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: "#EF4444" }}
          />
        </span>
        <WifiOff
          size={13}
          style={{ color: "var(--text-secondary)" }}
          aria-hidden
        />
        <span style={{ color: "var(--text-primary)" }}>
          NexusQL server is unreachable
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>—</span>
        <span style={{ color: "var(--text-secondary)" }}>
          restart the binary to reconnect
        </span>
      </div>

      {/* Right — copy command */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 rounded px-2.5 py-1 transition-colors"
        style={{
          background: "var(--surface-3)",
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-geist-mono)",
          fontSize: "12px",
          cursor: "pointer",
        }}>
        <Terminal size={11} aria-hidden />
        <span>{copied ? "Copied" : RESTART_CMD}</span>
      </button>
    </div>
  );
}

function OnlineIndicator() {
  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-end px-4 py-1.5"
      style={{
        background: "transparent",
        pointerEvents: "none",
      }}>
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
            style={{ background: "var(--teal)" }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--teal)" }}
          />
        </span>
        <Wifi size={11} style={{ color: "var(--teal)" }} aria-hidden />
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
          }}>
          connected
        </span>
      </div>
    </div>
  );
}

export function ServerStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, isLoading } = useQuery(
    queryOptions({
      queryKey: ["health"],
      queryFn: api.health,
      // Poll every 10 seconds to detect if the server goes down
      refetchInterval: 10_000,
      // Do not throw — we handle the offline state ourselves
      throwOnError: false,
    }),
  );

  const isOnline = !!data?.status;
  const isChecking = isLoading;

  return (
    <ServerStatusContext.Provider value={{ isOnline, isChecking }}>
      {isOnline ? <OnlineIndicator /> : <OfflineBanner />}
      {children}
    </ServerStatusContext.Provider>
  );
}
