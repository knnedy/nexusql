"use client";

import { useState } from "react";
import {
  HardDrive,
  Loader2,
  ArrowRight,
  Database,
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
      className={`group relative flex flex-col gap-1.5 rounded-lg p-2.5 text-left transition-all duration-200 cursor-pointer outline-none overflow-hidden ${
        selected
          ? "bg-surface-1 border-coral/50 shadow-[0_2px_10px_-2px_rgba(255,107,107,0.1)] ring-1 ring-coral/20"
          : "bg-surface-2 border-border/60 hover:bg-surface-3 hover:border-border"
      }`}>
      {selected && (
        <div className="absolute top-0 right-0 w-12 h-12 bg-coral/10 blur-xl rounded-full -mr-6 -mt-6 pointer-events-none" />
      )}

      <div className="flex items-center justify-between w-full relative z-10">
        <span
          className={`text-[13px] font-medium ${
            selected ? "text-coral" : "text-text-primary"
          }`}>
          {provider.label}
        </span>
        <div
          className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
            selected
              ? "border-coral bg-surface-1 shadow-[0_0_6px_rgba(255,107,107,0.3)]"
              : "border-border-strong bg-surface-2 group-hover:border-text-tertiary"
          }`}
        />
      </div>
      <span
        className={`text-[11px] leading-none font-mono relative z-10 ${
          selected ? "text-coral/80" : "text-text-tertiary"
        }`}>
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
      <main className="flex flex-col items-center justify-center min-h-screen pt-16 pb-12 px-4 bg-canvas-bg selection:bg-coral/20">
        <div className="w-full max-w-120 flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-1.5 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-1 border border-border shadow-sm mb-1">
              <Database size={18} className="text-coral" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
              Connect Database
            </h1>
            <p className="text-[13px] text-text-secondary">
              Paste your connection string to generate your schema.
            </p>
          </div>

          {/* Main Card */}
          <div className="rounded-xl p-5 flex flex-col gap-5 bg-surface-1 border border-border shadow-sm">
            {/* Provider Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-medium text-text-secondary">
                Database Engine
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
                      setUriError(null);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-name"
                  className="text-[12px] font-medium text-text-secondary flex items-center justify-between">
                  Project Name
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
                    className={`w-full h-9 rounded-lg pl-8 pr-3 text-[13px] outline-none transition-colors ${
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
                    className={`w-full h-9 rounded-lg pl-8 pr-3 text-[13px] outline-none font-mono transition-colors ${
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
              className="flex items-center justify-center gap-1.5 w-full h-9 mt-1 rounded-lg text-[13px] font-medium text-white bg-coral hover:bg-coral-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed border-none active:scale-[0.98]">
              {connect.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Connecting...
                </>
              ) : (
                <>
                  Connect Database
                  <ArrowRight size={14} aria-hidden />
                </>
              )}
            </button>
          </div>

          <RecentProjects />

          {/* Footer Note */}
          <div className="flex items-center justify-center pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-1/50 border border-border/50 text-[11px] text-text-tertiary">
              <HardDrive size={12} className="text-teal" />
              Projects are stored locally on your machine
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
