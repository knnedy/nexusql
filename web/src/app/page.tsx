"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Database,
  FolderOpen,
  HardDrive,
  Loader2,
  Moon,
  ArrowRight,
  Sun,
  Clock,
} from "lucide-react";
import {
  PROVIDERS,
  type DatabaseProvider,
  type ProviderMeta,
} from "@/lib/types";

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
    uri: "mysql://staging:5432/app",
    provider: "mysql" as DatabaseProvider,
    lastOpenedAt: "2024-01-14T08:00:00Z",
  },
  {
    id: "3",
    name: "Local Dev",
    uri: "sqlite:///home/user/dev.db",
    provider: "sqlite" as DatabaseProvider,
    lastOpenedAt: "2024-01-13T16:45:00Z",
  },
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Sub-components

function TopNav() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 h-12"
      style={{
        background: "var(--surface-1)",
        borderBottom: "0.5px solid var(--border)",
      }}>
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ background: "var(--coral)" }}>
          <Database size={13} color="#fff" aria-hidden />
        </div>
        <span
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          NexusQL
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/projects")}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm transition-colors"
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-2)";
          }}>
          <FolderOpen size={14} aria-hidden />
          All projects
        </button>

        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-2)";
          }}
          aria-label="Toggle theme">
          {!mounted ? (
            <div className="w-3.75 h-3.75" />
          ) : resolvedTheme === "dark" ? (
            <Sun size={15} aria-hidden />
          ) : (
            <Moon size={15} aria-hidden />
          )}
        </button>
      </div>
    </nav>
  );
}

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
      onClick={() => onSelect()}
      className="relative flex flex-col gap-1.5 rounded-lg px-3 py-3 text-left transition-colors w-full"
      style={{
        border: selected
          ? "1.5px solid var(--coral)"
          : "0.5px solid var(--border)",
        background: selected ? "var(--coral-subtle)" : "var(--surface-2)",
        cursor: "pointer",
        opacity: 1,
      }}>
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: selected ? "var(--coral)" : "var(--border-strong)",
          }}
        />
        <span
          className="text-sm font-semibold"
          style={{ color: selected ? "var(--coral)" : "var(--text-primary)" }}>
          {provider.label}
        </span>
      </div>

      <span
        className="text-xs leading-tight"
        style={{
          color: selected ? "var(--coral)" : "var(--text-tertiary)",
          fontFamily: "var(--font-geist-mono)",
          opacity: selected ? 0.75 : 1,
        }}>
        {provider.uriPrefixes.join(" · ")}
      </span>
    </button>
  );
}

function ProviderBadge({ provider }: { provider: DatabaseProvider }) {
  // add other colors for th providers
  const isTeal = provider === "postgres";
  const isBlue = provider === "mysql";

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium shrink-0"
      style={{
        background: isTeal
          ? "var(--badge-teal-bg)"
          : isBlue
            ? "var(--badge-blue-bg)"
            : "var(--badge-gray-bg)",
        color: isTeal
          ? "var(--badge-teal-text)"
          : isBlue
            ? "var(--badge-blue-text)"
            : "var(--badge-gray-text)",
      }}>
      {provider}
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [selectedProvider, setSelectedProvider] =
    useState<DatabaseProvider>("postgres");
  const [projectName, setProjectName] = useState("");
  const [uri, setUri] = useState("");
  const [uriError, setUriError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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
    // Phase 2 — replace with: connect.mutate({ uri, name: projectName, provider: selectedProvider })
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      router.push("/canvas");
    }, 800);
  }

  function handleRecentProject(projectId: string) {
    // Phase 2 — wire to useConnect + useUpdateLastOpened
    void projectId;
    router.push("/canvas");
  }

  return (
    <>
      <TopNav />

      <main
        className="flex flex-col items-center justify-center min-h-screen px-4 pt-16"
        style={{ background: "var(--canvas-bg)" }}>
        <div className="w-full max-w-md flex flex-col gap-6">
          {/* Hero */}
          <div className="text-center">
            <h1
              className="text-2xl font-semibold"
              style={{
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}>
              Connect a database
            </h1>
            <p
              className="text-sm mt-1.5"
              style={{ color: "var(--text-secondary)" }}>
              Paste your URI and start exploring your schema
            </p>
          </div>

          {/* Connection card */}
          <div
            className="rounded-xl p-5 flex flex-col gap-5"
            style={{
              background: "var(--node-bg)",
              border: "0.5px solid var(--border)",
            }}>
            {/* Provider selector */}
            <div className="flex flex-col gap-2">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}>
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

            {/* Project name */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-name"
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}>
                Project name
              </label>
              <input
                id="project-name"
                type="text"
                placeholder="e.g. Production DB"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "0.5px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
            </div>

            {/* URI input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="uri"
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}>
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
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: `0.5px solid ${uriError ? "#EF4444" : "var(--border)"}`,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-geist-mono)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = uriError
                    ? "#EF4444"
                    : "var(--border-strong)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = uriError
                    ? "#EF4444"
                    : "var(--border)";
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
              className="flex items-center justify-center gap-2 w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                background: "var(--coral)",
                color: "#fff",
                cursor: isConnecting ? "not-allowed" : "pointer",
                opacity: isConnecting ? 0.8 : 1,
                border: "none",
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

          {/* Recent projects */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-0.5">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-tertiary)" }}>
                Recent projects
              </span>
              <button
                onClick={() => router.push("/projects")}
                className="flex items-center gap-1 text-sm transition-colors"
                style={{
                  color: "var(--coral)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}>
                View all
                <ArrowRight size={12} aria-hidden />
              </button>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "0.5px solid var(--border)" }}>
              {MOCK_RECENT_PROJECTS.map((project, index) => (
                <button
                  key={project.id}
                  onClick={() => handleRecentProject(project.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background: "var(--node-bg)",
                    borderTop:
                      index === 0
                        ? "none"
                        : "0.5px solid var(--node-row-border)",
                    cursor: "pointer",
                    border: index === 0 ? "none" : undefined,
                    borderTopColor:
                      index === 0 ? "transparent" : "var(--node-row-border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--node-bg)";
                  }}>
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                    style={{ background: "var(--surface-3)" }}>
                    <Database
                      size={13}
                      style={{ color: "var(--text-tertiary)" }}
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
                      <Clock size={11} aria-hidden />
                      {formatRelativeTime(project.lastOpenedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-center gap-1.5 text-xs pb-4"
            style={{ color: "var(--text-tertiary)" }}>
            <HardDrive size={12} aria-hidden />
            Projects are stored locally on your machine
          </div>
        </div>
      </main>
    </>
  );
}
