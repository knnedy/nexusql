"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  FolderOpen,
  Loader2,
  ArrowRight,
  HardDrive,
  Clock,
} from "lucide-react";
import { useConnect } from "@/lib/queries";
import { MOCK_PROVIDER } from "@/lib/mock-schema";
import type { DatabaseProvider } from "@/lib/types";

// Mock recent projects — replaced by useProjects() in Phase 2
const MOCK_RECENT_PROJECTS = [
  {
    id: "1",
    name: "Production DB",
    uri: "postgres://prod:5432/app",
    provider: "postgres" as DatabaseProvider,
    lastOpenedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    name: "Staging DB",
    uri: "postgres://staging:5432/app",
    provider: "postgres" as DatabaseProvider,
    lastOpenedAt: "2024-01-14T08:00:00Z",
  },
  {
    id: "3",
    name: "Local Dev",
    uri: "sqlite:///home/user/dev.db",
    provider: "sqlite" as DatabaseProvider,
    lastOpenedAt: "2024-01-13T16:45:00Z",
  },
] as const;

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ProviderBadge({ provider }: { provider: DatabaseProvider }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        background:
          provider === "postgres"
            ? "var(--badge-teal-bg)"
            : "var(--badge-gray-bg)",
        color:
          provider === "postgres"
            ? "var(--badge-teal-text)"
            : "var(--badge-gray-text)",
      }}>
      <Database size={9} aria-hidden />
      {provider}
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const connect = useConnect();

  const [uri, setUri] = useState("");
  const [projectName, setProjectName] = useState("");
  const [uriError, setUriError] = useState<string | null>(null);

  function validateUri(value: string): boolean {
    if (!value.trim()) {
      setUriError("Connection URI is required");
      return false;
    }
    if (
      !value.startsWith("postgres://") &&
      !value.startsWith("postgresql://") &&
      !value.startsWith("sqlite://")
    ) {
      setUriError("URI must start with postgres:// or sqlite://");
      return false;
    }
    setUriError(null);
    return true;
  }

  function handleConnect() {
    if (!validateUri(uri)) return;
    // Phase 2 — replace with real connect mutation
    // connect.mutate({ uri, name: projectName });
    router.push("/canvas");
  }

  function handleRecentProject(projectUri: string) {
    // Phase 2 — wire to useConnect + useUpdateLastOpened
    router.push("/canvas");
  }

  const isConnecting = connect.isPending;

  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen px-4 py-12"
      style={{ background: "var(--canvas-bg)" }}>
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl mb-1"
            style={{
              background: "var(--coral)",
              boxShadow:
                "0 2px 12px color-mix(in srgb, var(--coral) 35%, transparent)",
            }}>
            <Database size={18} color="#fff" aria-hidden />
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            NexusQL
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Visualize your database schema instantly
          </p>
        </div>

        {/* Connection card */}
        <div
          className="rounded-xl p-5 flex flex-col gap-4"
          style={{
            background: "var(--node-bg)",
            border: "1px solid var(--border)",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
          }}>
          {/* Project name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-name"
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}>
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              placeholder="e.g. Production DB"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* URI input */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="uri"
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}>
              Connection URI
            </label>
            <input
              id="uri"
              type="text"
              placeholder="postgres://user:pass@localhost:5432/dbname"
              value={uri}
              onChange={(e) => {
                setUri(e.target.value);
                if (uriError) validateUri(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: "var(--surface-2)",
                border: `1px solid ${uriError ? "#EF4444" : "var(--border)"}`,
                color: "var(--text-primary)",
                fontFamily: "var(--font-geist-mono)",
              }}
            />
            {uriError && (
              <p className="text-xs" style={{ color: "#EF4444" }}>
                {uriError}
              </p>
            )}
          </div>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center justify-center gap-2 w-full rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            style={{
              background: "var(--coral)",
              color: "#fff",
              cursor: isConnecting ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!isConnecting)
                e.currentTarget.style.background = "var(--coral-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--coral)";
            }}>
            {isConnecting ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />{" "}
                Connecting…
              </>
            ) : (
              <>
                <ArrowRight size={14} aria-hidden /> Connect
              </>
            )}
          </button>
        </div>

        {/* Recent projects */}
        <div className="flex flex-col gap-2">
          <p
            className="text-xs font-medium px-1"
            style={{ color: "var(--text-tertiary)" }}>
            Recent projects
          </p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}>
            {MOCK_RECENT_PROJECTS.map((project, index) => (
              <button
                key={project.id}
                onClick={() => handleRecentProject(project.uri)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  background: "var(--node-bg)",
                  borderTop:
                    index === 0 ? "none" : "1px solid var(--node-row-border)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--node-bg)";
                }}>
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                  style={{ background: "var(--surface-3)" }}>
                  <Database
                    size={13}
                    style={{ color: "var(--text-secondary)" }}
                    aria-hidden
                  />
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}>
                    {project.name}
                  </span>
                  <span
                    className="text-xs truncate"
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-geist-mono)",
                    }}>
                    {project.uri}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ProviderBadge provider={project.provider} />
                  <span
                    className="flex items-center gap-1 text-xs"
                    style={{ color: "var(--text-tertiary)" }}>
                    <Clock size={10} aria-hidden />
                    {formatRelativeTime(project.lastOpenedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer nudge */}
        <div className="flex items-center justify-between px-1">
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--text-tertiary)" }}>
            <HardDrive size={11} aria-hidden />
            <span>Projects are stored locally on your machine</span>
          </div>
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{
              color: "var(--text-tertiary)",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}>
            <FolderOpen size={11} aria-hidden />
            Manage projects
          </button>
        </div>
      </div>
    </main>
  );
}
