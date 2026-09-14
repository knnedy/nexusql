"use client";

import { useState } from "react";
import {
  HardDrive,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Link as LinkIcon,
  FolderDot,
} from "lucide-react";
import TopNav from "./components/top-nav";
import RecentProjects from "./components/recent-projects";
import { useConnect } from "@/hooks/use-connect";
import {
  DatabaseProvider,
  ProviderMeta,
  PROVIDERS,
} from "@/lib/types/provider";

function ProviderTab({
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
      className={`flex-1 flex flex-col items-center gap-1 rounded-md py-2 px-2 transition-colors cursor-pointer outline-none ${
        selected
          ? "bg-surface-1 text-coral shadow-sm"
          : "text-text-tertiary hover:text-text-secondary"
      }`}>
      <span className="text-[12.5px] font-medium">{provider.label}</span>
      <span className="text-[10px] font-mono leading-none">
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
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [uriError, setUriError] = useState<string | null>(null);

  const connect = useConnect();
  const activeProvider = PROVIDERS.find((p) => p.id === selectedProvider)!;

  function handleProjectNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProjectName(e.target.value);
    setProjectNameError(null);
  }

  function handleUriChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setUri(value);
    setUriError(null);

    const detectedProvider = PROVIDERS.find((p) =>
      p.uriPrefixes.some((prefix) => value.startsWith(prefix)),
    );

    if (detectedProvider && detectedProvider.id !== selectedProvider) {
      setSelectedProvider(detectedProvider.id);
    }
  }

  function validateProjectName(value: string): boolean {
    if (!value.trim()) {
      setProjectNameError("Project name is required");
      return false;
    }
    setProjectNameError(null);
    return true;
  }

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
    const isNameValid = validateProjectName(projectName);
    const isUriValid = validateUri(uri);

    if (!isNameValid || !isUriValid) return;

    sessionStorage.setItem("nexusql_project_name", projectName.trim());

    connect.mutate({
      uri,
      provider: selectedProvider,
      name: projectName.trim(),
    });
  }

  return (
    <>
      <TopNav />
      <main className="flex flex-col items-center min-h-screen pt-24 pb-16 px-4 bg-canvas-bg selection:bg-coral/20">
        <div className="w-full max-w-110 flex flex-col gap-7">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="text-[16px] font-semibold text-text-primary tracking-tight">
              New connection
            </h1>
            <p className="text-[12.5px] text-text-secondary">
              Paste a connection string to explore its schema.
            </p>
          </div>

          {/* Main Panel */}
          <div className="rounded-xl p-5 flex flex-col gap-5 bg-surface-1 border border-border shadow-sm">
            {/* Provider Selection */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-2 border border-border">
              {PROVIDERS.map((p) => (
                <ProviderTab
                  key={p.id}
                  provider={p}
                  selected={selectedProvider === p.id}
                  onSelect={() => {
                    setSelectedProvider(p.id);
                    setUriError(null);
                  }}
                />
              ))}
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-name"
                  className="text-[12px] font-medium text-text-secondary flex items-center justify-between">
                  Project name
                  {projectNameError && (
                    <span className="text-red-500 flex items-center gap-1 text-[11px]">
                      <ShieldAlert size={10} /> Required
                    </span>
                  )}
                </label>
                <div className="relative flex items-center">
                  <FolderDot
                    size={14}
                    className={`absolute left-3 transition-colors ${projectNameError ? "text-red-500" : "text-text-tertiary"}`}
                  />
                  <input
                    id="project-name"
                    type="text"
                    placeholder="e.g. Production DB"
                    value={projectName}
                    onChange={handleProjectNameChange}
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    className={`w-full h-9 rounded-lg pl-8 pr-3 text-[13px] outline-none transition-colors border ${
                      projectNameError
                        ? "bg-red-500/5 border-red-500 text-red-500 placeholder:text-red-500/50 focus:ring-2 focus:ring-red-500/10"
                        : "bg-surface-2 border-border text-text-primary placeholder:text-text-tertiary focus:bg-surface-1 focus:border-coral focus:ring-2 focus:ring-coral/10"
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="uri"
                  className="text-[12px] font-medium text-text-secondary flex items-center justify-between">
                  Connection URI
                  {uriError && (
                    <span className="text-red-500 flex items-center gap-1 text-[11px]">
                      <ShieldAlert size={10} /> Invalid URI
                    </span>
                  )}
                </label>
                <div className="relative flex items-center">
                  <LinkIcon
                    size={14}
                    className={`absolute left-3 transition-colors ${uriError ? "text-red-500" : "text-text-tertiary"}`}
                  />
                  <input
                    id="uri"
                    type="text"
                    placeholder={activeProvider.uriPlaceholder}
                    value={uri}
                    onChange={handleUriChange}
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    className={`w-full h-9 rounded-lg pl-8 pr-3 text-[13px] outline-none font-mono transition-colors border ${
                      uriError
                        ? "bg-red-500/5 border-red-500 text-red-500 placeholder:text-red-500/50 focus:ring-2 focus:ring-red-500/10"
                        : "bg-surface-2 border-border text-text-primary placeholder:text-text-tertiary/70 focus:bg-surface-1 focus:border-coral focus:ring-2 focus:ring-coral/10"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {connect.isError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-[12px]">
                <ShieldAlert size={14} className="shrink-0" />
                <span className="truncate">
                  {connect.error instanceof Error
                    ? connect.error.message
                    : "Connection failed."}
                </span>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleConnect}
              disabled={connect.isPending || !uri.trim() || !projectName.trim()}
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg text-[13px] font-medium text-white bg-coral hover:bg-coral-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed border-none active:scale-[0.98]">
              {connect.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Connecting…
                </>
              ) : (
                <>
                  Connect
                  <ArrowRight size={14} aria-hidden />
                </>
              )}
            </button>
          </div>

          <RecentProjects />

          {/* Footer Note */}
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-text-tertiary">
            <HardDrive size={12} className="text-teal" />
            Projects are stored locally on your machine
          </div>
        </div>
      </main>
    </>
  );
}
