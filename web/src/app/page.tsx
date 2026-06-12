"use client";

import { useState } from "react";
import { HardDrive, Loader2, ArrowRight } from "lucide-react";
import {
  PROVIDERS,
  type DatabaseProvider,
  type ProviderMeta,
} from "@/lib/types";
import TopNav from "./components/top-nav";
import RecentProjects from "./components/recent-projects";
import { useConnect } from "@/hooks/use-connect";

function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: ProviderMeta;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={[
        "relative flex flex-col gap-1.5 rounded-lg px-3 py-3 text-left transition-colors w-full cursor-pointer",
        selected
          ? "border-[1.5px] border-coral bg-coral-subtle"
          : "border-[0.5px] border-border bg-surface-2",
      ].join(" ")}>
      <div className="flex items-center gap-2">
        <div
          className={[
            "w-2 h-2 rounded-full shrink-0",
            selected ? "bg-coral" : "bg-border-strong",
          ].join(" ")}
        />
        <span
          className={[
            "text-sm font-semibold",
            selected ? "text-coral" : "text-text-primary",
          ].join(" ")}>
          {provider.label}
        </span>
      </div>
      <span
        className={[
          "text-xs leading-tight font-mono",
          selected ? "text-coral opacity-75" : "text-text-tertiary",
        ].join(" ")}>
        {provider.uriPrefixes[0]}
      </span>
    </button>
  );
}

export default function HomePage() {
  const [selectedProvider, setSelectedProvider] =
    useState<DatabaseProvider>("postgres");
  const [projectName, setProjectName] = useState("");
  const [uri, setUri] = useState("");
  const [uriError, setUriError] = useState<string | null>(null);

  const connect = useConnect();
  const activeProvider = PROVIDERS.find((p) => p.id === selectedProvider)!;

  function validateUri(value: string): boolean {
    if (!value.trim()) {
      setUriError("Connection URI is required");
      return false;
    }
    const valid = activeProvider.uriPrefixes.some((prefix) =>
      value.startsWith(prefix),
    );
    if (!valid) {
      setUriError(
        `URI must start with ${activeProvider.uriPrefixes.join(" or ")}`,
      );
      return false;
    }
    setUriError(null);
    return true;
  }

  function handleConnect() {
    if (!validateUri(uri)) return;
    if (projectName.trim()) {
      sessionStorage.setItem("nexusql_project_name", projectName.trim());
    }
    connect.mutate({
      uri,
      provider: selectedProvider,
      name: projectName.trim(),
    });
  }

  return (
    <>
      <TopNav />
      <main className="flex flex-col items-center justify-center min-h-screen pb-8 px-4 pt-16 bg-canvas-bg">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-text-primary tracking-[-0.03em]">
              Connect a database
            </h1>
            <p className="text-sm mt-1.5 text-text-secondary">
              Paste your URI and start exploring your schema
            </p>
          </div>

          <div className="rounded-xl p-5 flex flex-col gap-5 bg-node-bg border-[0.5px] border-border">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary">
                Database type
              </label>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${PROVIDERS.length}, 1fr)`,
                }}>
                {PROVIDERS.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    selected={selectedProvider === p.id}
                    onSelect={() => {
                      setSelectedProvider(p.id);
                      setUri("");
                      setUriError(null);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-name"
                className="text-sm font-medium text-text-secondary">
                Project name
              </label>
              <input
                id="project-name"
                type="text"
                placeholder="e.g. Production DB"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none bg-surface-2 border-[0.5px] border-border text-text-primary focus:border-border-strong transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="uri"
                className="text-sm font-medium text-text-secondary">
                Connection URI
              </label>
              <input
                id="uri"
                type="text"
                placeholder={activeProvider.uriPlaceholder}
                value={uri}
                onChange={(e) => {
                  setUri(e.target.value);
                  if (uriError) validateUri(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                className={[
                  "w-full rounded-md px-3 py-2.5 text-sm outline-none font-mono bg-surface-2 text-text-primary transition-colors",
                  uriError
                    ? "border-[0.5px] border-red-500 focus:border-red-500"
                    : "border-[0.5px] border-border focus:border-border-strong",
                ].join(" ")}
              />
              {uriError && <p className="text-xs text-red-500">{uriError}</p>}
            </div>

            {connect.isError && (
              <p className="text-xs text-red-500">
                {connect.error instanceof Error
                  ? connect.error.message
                  : "Connection failed"}
              </p>
            )}

            <button
              onClick={handleConnect}
              disabled={connect.isPending}
              className="flex items-center justify-center gap-2 w-full rounded-md px-4 py-2 text-sm font-medium bg-coral hover:bg-coral-hover text-white transition-colors disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer border-none">
              {connect.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Connecting…
                </>
              ) : (
                <>
                  <ArrowRight size={14} aria-hidden />
                  Connect
                </>
              )}
            </button>
          </div>

          <RecentProjects />

          <div className="flex items-center justify-center gap-1.5 text-xs pb-4 text-text-tertiary">
            <HardDrive size={12} aria-hidden />
            Projects are stored locally on your machine
          </div>
        </div>
      </main>
    </>
  );
}
